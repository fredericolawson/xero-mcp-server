import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, isAbsolute } from "node:path";

import { Attachment } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";

// Xero rejects attachments larger than 25 MB.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

async function createInvoiceAttachment(
  invoiceId: string,
  filePath: string,
): Promise<Attachment | undefined> {
  // Validate the file locally before authenticating or calling Xero, so
  // problems surface as clear, actionable errors rather than API failures.
  if (!isAbsolute(filePath)) {
    throw new Error(`File path must be absolute: "${filePath}"`);
  }
  if (!existsSync(filePath)) {
    throw new Error(`File not found: "${filePath}"`);
  }
  const stats = statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: "${filePath}"`);
  }
  if (stats.size === 0) {
    throw new Error(`File is empty: "${filePath}"`);
  }
  if (stats.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `File is ${(stats.size / 1024 / 1024).toFixed(1)} MB, which exceeds Xero's 25 MB attachment limit: "${filePath}"`,
    );
  }

  await xeroClient.authenticate();

  const fileName = basename(filePath);
  const body = createReadStream(filePath);

  const response =
    await xeroClient.accountingApi.createInvoiceAttachmentByFileName(
      xeroClient.tenantId,
      invoiceId,
      fileName,
      body,
      false, // includeOnline — only relevant to customer-facing sales invoices
      undefined, // idempotencyKey
      getClientHeaders(),
    );

  return response.body.attachments?.[0];
}

/**
 * Attach a local file (e.g. the source PDF) to an existing Xero invoice or bill.
 *
 * The file's bytes are uploaded directly to Xero — no hosting or public URL is
 * required. The invoice must already exist (attachments are keyed by invoice ID).
 */
export async function createXeroInvoiceAttachment(
  invoiceId: string,
  filePath: string,
): Promise<XeroClientResponse<Attachment | null>> {
  try {
    const attachment = await createInvoiceAttachment(invoiceId, filePath);

    if (!attachment) {
      throw new Error("Attachment upload failed.");
    }

    return {
      result: attachment,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
