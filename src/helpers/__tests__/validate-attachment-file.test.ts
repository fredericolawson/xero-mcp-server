import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAttachmentFile, MAX_ATTACHMENT_BYTES } from "../validate-attachment-file.js";

describe("validateAttachmentFile", () => {
  let dir: string;
  let validFile: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "xero-attachment-test-"));
    validFile = join(dir, "bill.pdf");
    writeFileSync(validFile, "%PDF-1.4 test content");
    writeFileSync(join(dir, "empty.pdf"), "");
    mkdirSync(join(dir, "a-directory"));
    // Sparse file: reports a size over the limit without writing 25 MB to disk.
    const oversized = join(dir, "oversized.pdf");
    writeFileSync(oversized, "x");
    truncateSync(oversized, MAX_ATTACHMENT_BYTES + 1);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a normal file", () => {
    expect(validateAttachmentFile(validFile)).toBeNull();
  });

  it("rejects a relative path", () => {
    expect(validateAttachmentFile("bill.pdf")).toMatch(/absolute/);
  });

  it("rejects a missing file", () => {
    expect(validateAttachmentFile(join(dir, "missing.pdf"))).toMatch(/not found/i);
  });

  it("rejects a directory", () => {
    expect(validateAttachmentFile(join(dir, "a-directory"))).toMatch(/not a file/i);
  });

  it("rejects an empty file", () => {
    expect(validateAttachmentFile(join(dir, "empty.pdf"))).toMatch(/empty/i);
  });

  it("rejects a file over Xero's 25 MB limit", () => {
    expect(validateAttachmentFile(join(dir, "oversized.pdf"))).toMatch(/25 MB/);
  });
});
