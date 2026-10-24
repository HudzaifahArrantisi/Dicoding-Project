import { join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

// Resolve upload directories relative to apps/api directory
const API_ROOT = resolve(import.meta.dir, "../..");
export const UPLOADS_DIR = resolve(API_ROOT, "uploads");
export const RECEIPTS_DIR = resolve(UPLOADS_DIR, "receipts");
export const PROFILES_DIR = resolve(UPLOADS_DIR, "profiles");

// Ensure target directories exist on startup
if (!existsSync(RECEIPTS_DIR)) {
  mkdirSync(RECEIPTS_DIR, { recursive: true });
}
if (!existsSync(PROFILES_DIR)) {
  mkdirSync(PROFILES_DIR, { recursive: true });
}

export type UploadFolder = "receipts" | "profiles";

/**
 * Saves a File or Blob instance (from FormData) directly to the server's uploads folder.
 */
export async function saveUploadedFile(
  file: File | Blob,
  folder: UploadFolder,
  prefix: string,
): Promise<{ path: string; filename: string }> {
  const targetDir = folder === "receipts" ? RECEIPTS_DIR : PROFILES_DIR;

  let ext = "jpg";
  if (file.type === "image/png") ext = "png";
  else if (file.type === "image/webp") ext = "webp";
  else if (file.type === "image/jpeg") ext = "jpg";

  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const filename = `${safePrefix}-${Date.now()}-${randomSuffix}.${ext}`;
  const filePath = join(targetDir, filename);

  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(filePath, arrayBuffer);

  return {
    path: `/uploads/${folder}/${filename}`,
    filename,
  };
}

/**
 * Converts a base64 Data URL into a file on disk and returns the relative upload path.
 * Guarantees that raw base64 strings are never stored into the database.
 */
export async function saveBase64Image(
  dataUrl: string,
  folder: UploadFolder,
  prefix: string,
): Promise<{ path: string; filename: string }> {
  const match = /^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Format base64 gambar tidak valid");
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  let ext = "jpg";
  if (mimeType === "image/png") ext = "png";
  else if (mimeType === "image/webp") ext = "webp";

  const targetDir = folder === "receipts" ? RECEIPTS_DIR : PROFILES_DIR;
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const filename = `${safePrefix}-${Date.now()}-${randomSuffix}.${ext}`;
  const filePath = join(targetDir, filename);

  await Bun.write(filePath, buffer);

  return {
    path: `/uploads/${folder}/${filename}`,
    filename,
  };
}
