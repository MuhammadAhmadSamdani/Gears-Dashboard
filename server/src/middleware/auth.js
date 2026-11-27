import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { Admin } from "../models/Admin.js";
import { AdminSession } from "../models/AdminSession.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const startSession = async (admin) => {
  const sessionId = randomUUID();
  const token = jwt.sign({ version: admin.sessionVersion || "" }, env.jwtSecret, {
    algorithm: "HS256",
    subject: String(admin._id),
    jwtid: sessionId,
    expiresIn: env.jwtExpiresIn,
  });
  const expiresAt = new Date(jwt.decode(token).exp * 1000);
  await AdminSession.create({ _id: sessionId, expiresAt });
  return { token, maxAge: expiresAt.getTime() - Date.now() };
};

export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction || env.cookieCrossSite,
  sameSite: env.cookieCrossSite ? "none" : "lax",
  partitioned: env.cookieCrossSite,
  path: "/",
});

const readSession = (req) => {
  const token = req.cookies?.[env.cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    return payload.jti && typeof payload.version === "string" ? payload : null;
  } catch {
    return null;
  }
};

export const endSession = async (req) => {
  const session = readSession(req);
  if (session) await AdminSession.deleteOne({ _id: session.jti });
};

export const requireAuth = asyncHandler(async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const session = readSession(req);
  if (!session) throw ApiError.unauthorized();

  const [admin, activeSession] = await Promise.all([
    Admin.findById(session.sub).select("+sessionVersion"),
    AdminSession.exists({ _id: session.jti, expiresAt: { $gt: new Date() } }),
  ]);
  if (!admin || !activeSession || (admin.sessionVersion || "") !== session.version) {
    throw ApiError.unauthorized("Session expired. Please sign in again.");
  }
  if (!admin.isActive) {
    throw ApiError.forbidden("This account has been deactivated");
  }

  req.admin = admin;
  next();
});
