import { createReadStream, writeFileSync } from "node:fs";
import { basename, isAbsolute } from "node:path";

import { Attachment } from "xero-node";

import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { validateAttachmentFile } from "../helpers/validate-attachment-file.js";
import { XeroClientResponse } from "../types/tool-response.js";

/**
 * Xero entities that support file attachments via the Accounting API. The
 * string values match how the LLM will refer to each entity and keep the
 * tool surface small (one set of tools for every attachable type).
 */
export const ATTACHABLE_ENTITY_TYPES = [
  "invoices",
  "banktransactions",
  "contacts",
  "creditnotes",
  "manualjournals",
  "purchaseorders",
] as const;

export type AttachableEntityType = (typeof ATTACHABLE_ENTITY_TYPES)[number];

async function uploadAttachment(
  entityType: AttachableEntityType,
  entityId: string,
  filePath: string,
): Promise<Attachment | undefined> {
  // Validate locally before authenticating so a bad path fails cleanly.
  const validationError = validateAttachmentFile(filePath);
  if (validationError) {
    throw new Error(validationError);
  }

  await xeroClient.authenticate();

  const tenantId = xeroClient.tenantId;
  const fileName = basename(filePath);
  const body = createReadStream(filePath);
  const headers = getClientHeaders();

  switch (entityType) {
    case "invoices": {
      const response =
        await xeroClient.accountingApi.createInvoiceAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          false, // includeOnline
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
    case "creditnotes": {
      const response =
        await xeroClient.accountingApi.createCreditNoteAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          false, // includeOnline
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
    case "banktransactions": {
      const response =
        await xeroClient.accountingApi.createBankTransactionAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
    case "contacts": {
      const response =
        await xeroClient.accountingApi.createContactAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
    case "manualjournals": {
      const response =
        await xeroClient.accountingApi.createManualJournalAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
    case "purchaseorders": {
      const response =
        await xeroClient.accountingApi.createPurchaseOrderAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          body,
          undefined, // idempotencyKey
          headers,
        );
      return response.body.attachments?.[0];
    }
  }
}

async function listAttachments(
  entityType: AttachableEntityType,
  entityId: string,
): Promise<Attachment[]> {
  await xeroClient.authenticate();

  const tenantId = xeroClient.tenantId;
  const headers = getClientHeaders();

  switch (entityType) {
    case "invoices":
      return (
        (
          await xeroClient.accountingApi.getInvoiceAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
    case "creditnotes":
      return (
        (
          await xeroClient.accountingApi.getCreditNoteAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
    case "banktransactions":
      return (
        (
          await xeroClient.accountingApi.getBankTransactionAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
    case "contacts":
      return (
        (
          await xeroClient.accountingApi.getContactAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
    case "manualjournals":
      return (
        (
          await xeroClient.accountingApi.getManualJournalAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
    case "purchaseorders":
      return (
        (
          await xeroClient.accountingApi.getPurchaseOrderAttachments(
            tenantId,
            entityId,
            headers,
          )
        ).body.attachments ?? []
      );
  }
}

async function downloadAttachment(
  entityType: AttachableEntityType,
  entityId: string,
  fileName: string,
  contentType: string,
): Promise<Buffer> {
  await xeroClient.authenticate();

  const tenantId = xeroClient.tenantId;
  const headers = getClientHeaders();

  switch (entityType) {
    case "invoices":
      return (
        await xeroClient.accountingApi.getInvoiceAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
    case "creditnotes":
      return (
        await xeroClient.accountingApi.getCreditNoteAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
    case "banktransactions":
      return (
        await xeroClient.accountingApi.getBankTransactionAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
    case "contacts":
      return (
        await xeroClient.accountingApi.getContactAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
    case "manualjournals":
      return (
        await xeroClient.accountingApi.getManualJournalAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
    case "purchaseorders":
      return (
        await xeroClient.accountingApi.getPurchaseOrderAttachmentByFileName(
          tenantId,
          entityId,
          fileName,
          contentType,
          headers,
        )
      ).body;
  }
}

/**
 * Attach a local file (e.g. a supplier's PDF) to an existing Xero entity.
 *
 * Unlike create-invoice's attachmentPath, this works on entities that already
 * exist — bills, bank transactions, contacts, credit notes, manual journals
 * and purchase orders.
 */
export async function uploadXeroAttachment(
  entityType: AttachableEntityType,
  entityId: string,
  filePath: string,
): Promise<XeroClientResponse<Attachment>> {
  try {
    const attachment = await uploadAttachment(entityType, entityId, filePath);

    if (!attachment) {
      throw new Error("Attachment upload failed.");
    }

    return { result: attachment, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

/**
 * List the attachments currently held against an existing Xero entity.
 */
export async function listXeroAttachments(
  entityType: AttachableEntityType,
  entityId: string,
): Promise<XeroClientResponse<Attachment[]>> {
  try {
    const attachments = await listAttachments(entityType, entityId);
    return { result: attachments, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}

/**
 * Download a named attachment from a Xero entity and write it to a local file.
 *
 * The attachment's MIME type is looked up from the entity's attachment list so
 * the caller only needs to supply the file name, not the content type.
 */
export async function getXeroAttachment(
  entityType: AttachableEntityType,
  entityId: string,
  fileName: string,
  destinationPath: string,
): Promise<XeroClientResponse<{ destinationPath: string; bytes: number }>> {
  try {
    if (!isAbsolute(destinationPath)) {
      throw new Error(
        `Destination path must be absolute: "${destinationPath}"`,
      );
    }

    const attachments = await listAttachments(entityType, entityId);
    const match = attachments.find(
      (a) => a.fileName?.toLowerCase() === fileName.toLowerCase(),
    );

    if (!match || !match.fileName) {
      const available = attachments
        .map((a) => a.fileName)
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `No attachment named "${fileName}" found on this ${entityType} record.` +
          (available ? ` Available: ${available}.` : " It has no attachments."),
      );
    }

    const buffer = await downloadAttachment(
      entityType,
      entityId,
      match.fileName,
      match.mimeType || "application/octet-stream",
    );

    writeFileSync(destinationPath, buffer);

    return {
      result: { destinationPath, bytes: buffer.length },
      isError: false,
      error: null,
    };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
