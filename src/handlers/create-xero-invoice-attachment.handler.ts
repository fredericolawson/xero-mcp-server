import { createReadStream } from "node:fs";
import { basename } from "node:path";

import { Attachment } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { validateAttachmentFile } from "../helpers/validate-attachment-file.js";
import { XeroClientResponse } from "../types/tool-response.js";

async function createInvoiceAttachment(
  invoiceId: string,
  filePath: string,
): Promise<Attachment | undefined> {
  // Validate the file locally before authenticating or calling Xero, so
  // problems surface as clear, actionable errors rather than API failures.
  const validationError = validateAttachmentFile(filePath);
  if (validationError) {
    throw new Error(validationError);
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
