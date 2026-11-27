import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_ROOT = env.nodeEnv === "test" && process.env.GEARS_TEST_UPLOAD_ROOT
  ? path.resolve(process.env.GEARS_TEST_UPLOAD_ROOT)
  : path.resolve(here, "../../uploads");
const privateFolders = new Set(["avatars", "documents", "inventory", "registrations"]);

/* ------------------------------------------------------------------
   SAFE NAMES
   The client filename is never trusted: it is only used to derive an
   extension, and the stored name is generated server side.
------------------------------------------------------------------ */

const EXTENSION_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
};

const safeExtension = (file) => {
  const fromMime = EXTENSION_BY_MIME[file.mimetype];
  if (fromMime) return fromMime;

  const raw = path.extname(file.originalname || "").toLowerCase();
  return /^\.[a-z0-9]{1,6}$/.test(raw) ? raw : "";
};

const generateName = (file) =>
  `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExtension(
    file
  )}`;

const sanitiseOriginalName = (name = "") =>
  path
    .basename(String(name))
    .replace(/[^\w.\- ]+/g, "_")
    .slice(0, 150);

/* ------------------------------------------------------------------
   LOCAL DRIVER
------------------------------------------------------------------ */

const localDriver = {
  async save(file, folder = "misc") {
    const dir = path.join(UPLOAD_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });

    const fileName = generateName(file);
    await fs.writeFile(path.join(dir, fileName), file.buffer);

    const relative = `${folder}/${fileName}`;

    return {
      url: `${env.publicApiUrl}/uploads/${relative}`,
      publicId: relative,
      provider: "local",
      originalName: sanitiseOriginalName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
    };
  },

  async remove(publicId) {
    if (!publicId) return;

    /* Refuse anything that could escape the uploads directory. */
    const target = path.resolve(UPLOAD_ROOT, publicId);
    if (!target.startsWith(UPLOAD_ROOT + path.sep)) return;

    await fs.rm(target, { force: true });
  },
};

/* ------------------------------------------------------------------
   CLOUDINARY DRIVER
------------------------------------------------------------------ */

let cloudinaryClient = null;

const getCloudinary = async () => {
  if (cloudinaryClient) return cloudinaryClient;

  const { v2 } = await import("cloudinary");

  v2.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });

  cloudinaryClient = v2;
  return cloudinaryClient;
};

const cloudinaryDriver = {
  async save(file, folder = "misc") {
    const client = await getCloudinary();

    const isImage = file.mimetype.startsWith("image/");
    const deliveryType = privateFolders.has(folder) ? "authenticated" : "upload";

    const uploaded = await new Promise((resolve, reject) => {
      const stream = client.uploader.upload_stream(
        {
          folder: `${env.cloudinary.folder}/${folder}`,
          resource_type: isImage ? "image" : "raw",
          type: deliveryType,
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );

      stream.end(file.buffer);
    });

    return {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      provider: "cloudinary",
      deliveryType,
      format: uploaded.format || "",
      originalName: sanitiseOriginalName(file.originalname),
      mimeType: file.mimetype,
      size: file.size,
    };
  },

  async remove(publicId, mimeType = "", deliveryType = "upload") {
    if (!publicId) return;

    const client = await getCloudinary();

    await client.uploader.destroy(publicId, {
      resource_type: mimeType.startsWith("image/") ? "image" : "raw",
      type: deliveryType,
      invalidate: true,
    });
  },
};

/* ------------------------------------------------------------------
   PUBLIC API
------------------------------------------------------------------ */

const useCloudinary =
  env.storageDriver === "cloudinary" &&
  Boolean(
    env.cloudinary.cloudName &&
      env.cloudinary.apiKey &&
      env.cloudinary.apiSecret
  );

if (env.storageDriver === "cloudinary" && !useCloudinary) {
  console.warn(
    "[storage] STORAGE_DRIVER=cloudinary but credentials are incomplete - falling back to local disk storage."
  );
}

const driver = useCloudinary ? cloudinaryDriver : localDriver;

export const privateFileUrl = (file, endpoint) =>
  file?.publicId ? `${env.publicApiUrl}/api/${endpoint}` : "";

export const privateFileJSON = (file, endpoint) => ({
  url: privateFileUrl(file, endpoint),
  originalName: file?.originalName,
  mimeType: file?.mimeType,
  size: file?.size,
});

export const servePrivateFile = async (res, file, attachment = false) => {
  const unavailable = ApiError.notFound("The stored file is no longer available");
  if (!file?.publicId) throw unavailable;

  const fileName = file.originalName || path.basename(file.publicId);
  if (file.provider === "cloudinary") {
    const client = await getCloudinary();
    const isImage = file.mimeType.startsWith("image/");
    const source = client.utils.private_download_url(
      file.publicId,
      isImage ? file.format || safeExtension({ mimetype: file.mimeType }).slice(1) : "",
      {
        type: file.deliveryType || "upload",
        resource_type: isImage ? "image" : "raw",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }
    );
    const upstream = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      throw unavailable;
    }
    if (attachment) res.attachment(fileName);
    res.type(file.mimeType || "application/octet-stream");
    await pipeline(Readable.fromWeb(upstream.body), res);
    return;
  }

  const target = path.resolve(UPLOAD_ROOT, file.publicId);
  if (!target.startsWith(UPLOAD_ROOT + path.sep)) throw unavailable;
  if (attachment) res.attachment(fileName);
  res.type(file.mimeType || "application/octet-stream");
  await new Promise((resolve, reject) => {
    res.sendFile(target, { cacheControl: false }, (error) => {
      if (!error) resolve();
      else reject(error.code === "ENOENT" ? unavailable : error);
    });
  });
};

export const storage = {
  driverName: useCloudinary ? "cloudinary" : "local",

  saveFile: (file, folder) => driver.save(file, folder),

  /*
    Deleting stored files must never break the request that triggered
    it, so failures are logged rather than thrown.
  */
  async removeFile(fileRef) {
    if (!fileRef?.publicId) return;

    try {
      const target =
        fileRef.provider === "cloudinary" ? cloudinaryDriver : localDriver;

      await target.remove(fileRef.publicId, fileRef.mimeType || "", fileRef.deliveryType || "upload");
    } catch (error) {
      console.error(
        `[storage] failed to remove ${fileRef.publicId}:`,
        error.message
      );
    }
  },
};
