import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const AdminSession = mongoose.model("AdminSession", sessionSchema);
