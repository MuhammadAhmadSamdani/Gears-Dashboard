import { Admin } from "../models/Admin.js";
import { Inventory } from "../models/Inventory.js";
import { Registration } from "../models/Registration.js";
import { servePrivateFile } from "../services/storage.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const serveImage = (model, field) => asyncHandler(async (req, res) => {
  const record = await model.findById(req.params.id).select(field);
  await servePrivateFile(res, record?.[field]);
});

export const registrationPicture = serveImage(Registration, "picture");
export const inventoryImage = serveImage(Inventory, "image");
export const adminAvatar = serveImage(Admin, "avatar");
