import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { fileSchema } from "./fileSchema.js";
import { privateFileJSON } from "../services/storage.js";

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 120,
    },

    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
      maxlength: 120,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    /*
      Never selected by default, so no query can leak it accidentally.
    */
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    avatar: { type: fileSchema, default: () => ({}) },

    isActive: { type: Boolean, default: true },

    sessionVersion: { type: String, default: "", select: false },

    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* Belt and braces: strip the hash from any serialised output. */
const hideSecrets = (doc, ret) => {
  delete ret.passwordHash;
  delete ret.sessionVersion;
  delete ret.__v;
  return ret;
};

adminSchema.set("toObject", { transform: hideSecrets });

adminSchema.set("toJSON", {
  transform(doc, ret) {
    hideSecrets(doc, ret);
    ret.avatar = privateFileJSON(ret.avatar, `admins/${ret._id}/avatar`);
    return ret;
  },
});

adminSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
  this.invalidateSessions();
};

adminSchema.methods.invalidateSessions = function invalidateSessions() {
  this.sessionVersion = randomUUID();
};

adminSchema.methods.verifyPassword = function verifyPassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

export const Admin = mongoose.model("Admin", adminSchema);
