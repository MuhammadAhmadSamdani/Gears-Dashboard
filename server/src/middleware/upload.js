import multer from "multer";
import { extname } from "node:path";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const jpeg = Buffer.from("ffd8ff", "hex");
const png = Buffer.from("89504e470d0a1a0a", "hex");
const ole = Buffer.from("d0cf11e0a1b11ae1", "hex");
const zip = Buffer.from("504b0304", "hex");
const startsWith = (buffer, signature) => buffer.subarray(0, signature.length).equals(signature);
const isAvif = (buffer) => {
  if (buffer.length < 16 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const boxSize = buffer.readUInt32BE(0);
  if (boxSize < 16 || boxSize > buffer.length) return false;
  const avifBrand = (offset) => ["avif", "avis"].includes(buffer.toString("ascii", offset, offset + 4));
  if (avifBrand(8)) return true;
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    if (avifBrand(offset)) return true;
  }
  return false;
};

const imageTypes = {
  "image/jpeg": [/^\.jpe?g$/, (buffer) => startsWith(buffer, jpeg)],
  "image/png": [/^\.png$/, (buffer) => startsWith(buffer, png)],
  "image/webp": [/^\.webp$/, (buffer) =>
    buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP"],
  "image/avif": [/^\.avif$/, isAvif],
};

const documentTypes = {
  "application/pdf": [/^\.pdf$/, (buffer) => buffer.toString("ascii", 0, 5) === "%PDF-"],
  "application/msword": [/^\.doc$/, (buffer) => startsWith(buffer, ole)],
  "application/vnd.ms-excel": [/^\.xls$/, (buffer) => startsWith(buffer, ole)],
  "application/vnd.ms-powerpoint": [/^\.ppt$/, (buffer) => startsWith(buffer, ole)],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    [/^\.docx$/, (buffer) => startsWith(buffer, zip)],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    [/^\.xlsx$/, (buffer) => startsWith(buffer, zip)],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    [/^\.pptx$/, (buffer) => startsWith(buffer, zip)],
};

/*
  Files are held in memory and handed to the storage driver, so nothing
  untrusted is ever written to disk under a client-controlled name.
  Check the claimed type and extension before buffering, then check the file header.
*/
const makeUploader = (types, limit, label, maxFiles = 1) => {
  const invalid = () => ApiError.badRequest(`Unsupported file type. Allowed ${label}.`);
  const uploader = multer({
    storage: multer.memoryStorage(),

    limits: { fileSize: limit, files: maxFiles, fields: 24, fieldSize: 65536 },

    fileFilter: (_req, file, callback) => {
      const type = Object.hasOwn(types, file.mimetype) && types[file.mimetype];
      if (!type || !type[0].test(extname(file.originalname).toLowerCase())) {
        return callback(invalid());
      }
      return callback(null, true);
    },
  });

  const validate = (parse) => (req, res, next) => {
    parse(req, res, (error) => {
      if (error) return next(error);
      const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
      if (files.some((file) => !types[file.mimetype][1](file.buffer))) return next(invalid());
      return next();
    });
  };

  return {
    single: (name) => validate(uploader.single(name)),
    fields: (fields) => validate(uploader.fields(fields)),
  };
};

export const uploadImage = makeUploader(
  imageTypes,
  env.maxImageSize,
  "images: JPG, PNG, WEBP, AVIF"
);

export const uploadDocument = makeUploader(
  documentTypes,
  env.maxDocumentSize,
  "documents: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX"
);

/*
  Accepts the two image fields used by core team and leadership.
  Uses its own multer instance with files: 2 so both `image` and
  `homeImage` can be uploaded in a single multipart request.
*/
const uploadTeamImagesMulter = makeUploader(
  imageTypes,
  env.maxImageSize,
  "images: JPG, PNG, WEBP, AVIF",
  2
);

export const uploadTeamImages = uploadTeamImagesMulter.fields([
  { name: "image", maxCount: 1 },
  { name: "homeImage", maxCount: 1 },
]);
