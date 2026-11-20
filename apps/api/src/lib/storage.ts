/**
 * Penyimpanan berkas unggahan: resi pengiriman dan foto profil.
 *
 * Dua runtime dilayani berkas ini:
 *   - Bun   — menulis ke disk di apps/api/uploads/
 *   - Workers — TIDAK punya disk; perlu R2 (belum terpasang)
 *
 * Penulisan disk sengaja ditunda sampai fungsi dipanggil, bukan saat modul
 * dimuat. `mkdirSync` di level modul membuat impor gagal di Workers sebelum
 * satu permintaan pun dilayani.
 */

import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

export type UploadFolder = "receipts" | "profiles";

/** Runtime tanpa filesystem. Diisi saat R2 dipasang. */
const hasFileSystem = typeof Bun !== "undefined" && typeof Bun.write === "function";

/**
 * Ditelusuri saat dipanggil, bukan saat modul dimuat.
 *
 * import.meta.dir tidak ada di Cloudflare Workers, dan mengevaluasinya di
 * tingkat modul membuat seluruh aplikasi gagal diimpor — bukan hanya fitur
 * unggahan.
 */
function uploadsRoot(): string {
  if (typeof import.meta.dir !== "string") return "/uploads";
  return resolve(import.meta.dir, "../../uploads");
}

export function uploadsDir(): string {
  return uploadsRoot();
}

export function receiptsDir(): string {
  return join(uploadsRoot(), "receipts");
}

export function profilesDir(): string {
  return join(uploadsRoot(), "profiles");
}

function targetDir(folder: UploadFolder): string {
  return folder === "receipts" ? receiptsDir() : profilesDir();
}

/** Membuat folder tujuan saat dibutuhkan, bukan saat modul dimuat. */
function ensureDir(folder: UploadFolder): string {
  const dir = targetDir(folder);
  if (!hasFileSystem) {
    throw new Error(
      "Runtime ini tidak punya filesystem. Unggahan berkas memerlukan binding R2.",
    );
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function buildFilename(prefix: string, ext: string, suffix: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safePrefix}-${Date.now()}-${suffix}.${ext}`;
}

/**
 * Saves a File or Blob instance (from FormData) directly to the server's uploads folder.
 */
export async function saveUploadedFile(
  file: File | Blob,
  folder: UploadFolder,
  prefix: string,
): Promise<{ path: string; filename: string }> {
  const dir = ensureDir(folder);
  const ext = extensionFor(file.type);
  const filename = buildFilename(prefix, ext, randomHex());
  const arrayBuffer = await file.arrayBuffer();
  await Bun.write(join(dir, filename), arrayBuffer);

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

  const dir = ensureDir(folder);
  const filename = buildFilename(prefix, extensionFor(match[1]), randomHex());
  await Bun.write(join(dir, filename), Buffer.from(match[2], "base64"));

  return {
    path: `/uploads/${folder}/${filename}`,
    filename,
  };
}

/** Byte acak dalam heksadesimal, lewat crypto global agar tidak butuh node:crypto. */
function randomHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
