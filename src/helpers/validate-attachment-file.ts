import { existsSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

// Xero rejects attachments larger than 25 MB.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Validate that a local file is suitable to upload as a Xero attachment.
 * Returns a human-readable error message, or null if the file is valid.
 */
export function validateAttachmentFile(filePath: string): string | null {
  if (!isAbsolute(filePath)) {
    return `File path must be absolute: "${filePath}"`;
  }
  if (!existsSync(filePath)) {
    return `File not found: "${filePath}"`;
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    return `Path is not a file: "${filePath}"`;
  }
  if (stats.size === 0) {
    return `File is empty: "${filePath}"`;
  }
  if (stats.size > MAX_ATTACHMENT_BYTES) {
    return `File is ${(stats.size / 1024 / 1024).toFixed(1)} MB, which exceeds Xero's 25 MB attachment limit: "${filePath}"`;
  }
  return null;
}
