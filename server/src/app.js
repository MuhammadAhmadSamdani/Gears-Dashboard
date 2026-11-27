import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";

import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { UPLOAD_ROOT, storage } from "./services/storage.js";
import { ApiError } from "./utils/ApiError.js";

const PUBLIC_UPLOAD_FOLDERS = ["alumni", "core-team", "gallery", "home", "leadership", "presidents"];
const allowedOrigins = new Set(
  [...env.clientUrls, env.publicApiUrl].map((url) => new URL(url).origin)
);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const createApp = () => {
  const app = express();

  app.set("trust proxy", env.trustProxyHops || false);

  app.use(
    helmet({
      /*
        Uploaded images are embedded by the frontend on a different
        origin, so they must not be blocked as cross-origin resources.
      */
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  /*
    Only the configured frontend origins may call the API with
    credentials. Same-origin and server-to-server calls (no Origin
    header) are allowed through.
  */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(ApiError.forbidden("Request origin is not allowed"));
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    })
  );

  app.use("/api", (req, _res, next) => {
    const site = req.get("Sec-Fetch-Site");
    const destination = req.get("Sec-Fetch-Dest");
    const crossOrigin = site === "cross-site" || site === "same-site";
    const checkReferer = !req.get("Origin") && crossOrigin &&
      (!safeMethods.has(req.method) || destination === "image");
    if (!checkReferer) return next();

    try {
      if (allowedOrigins.has(new URL(req.get("Referer")).origin)) return next();
    } catch {
      // A missing or invalid referrer cannot establish the request's origin.
    }
    next(ApiError.forbidden("Request origin is not allowed"));
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser());

  for (const folder of PUBLIC_UPLOAD_FOLDERS) {
    app.use(`/uploads/${folder}`, express.static(path.join(UPLOAD_ROOT, folder), {
      maxAge: "7d",
      index: false,
      dotfiles: "deny",
      redirect: false,
    }));
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      success: true,
      status: "ok",
      storage: storage.driverName,
      time: new Date().toISOString(),
    });
  });

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
