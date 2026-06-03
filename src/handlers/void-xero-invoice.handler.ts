import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function fetchInvoice(invoiceId: string): Promise<Invoice | undefined> {
  const response = await xeroClient.accountingApi.getInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    undefined, // unitdp
    getClientHeaders(),
  );
  return response.body.invoices?.[0];
}

async function setInvoiceStatus(
  invoiceId: string,
  status: Invoice.StatusEnum,
): Promise<Invoice | undefined> {
  // A status-only update voids (AUTHORISED -> VOIDED) or deletes
  // (DRAFT/SUBMITTED -> DELETED) the invoice without touching line items.
  const response = await xeroClient.accountingApi.updateInvoice(
    xeroClient.tenantId,
    invoiceId, // invoiceId
    {
      invoices: [{ status }],
    }, // invoices
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  return response.body.invoices?.[0];
}

/**
 * Void (or, for drafts, delete) an invoice or bill in Xero.
 *
 * Xero voids an AUTHORISED invoice by transitioning it to VOIDED, and cancels a
 * DRAFT/SUBMITTED invoice by transitioning it to DELETED. An invoice with
 * payments applied cannot be voided until the payments are removed in Xero.
 */
export async function voidXeroInvoice(
  invoiceId: string,
): Promise<XeroClientResponse<Invoice>> {
  try {
    await xeroClient.authenticate();

    const existing = await fetchInvoice(invoiceId);
    if (!existing) {
      return {
        result: null,
        isError: true,
        error: `No invoice found with ID: ${invoiceId}`,
      };
    }

    const status = existing.status;

    // Already in a terminal cancelled state — nothing to do.
    if (
      status === Invoice.StatusEnum.VOIDED ||
      status === Invoice.StatusEnum.DELETED
    ) {
      return { result: existing, isError: false, error: null };
    }

    // Paid / part-paid invoices can't be voided until payments are removed.
    const amountPaid = existing.amountPaid ?? 0;
    if (status === Invoice.StatusEnum.PAID || amountPaid > 0) {
      return {
        result: null,
        isError: true,
        error:
          `Cannot void invoice ${existing.invoiceNumber ?? invoiceId} because it has payments applied ` +
          `(amount paid: ${amountPaid}). Remove the payment(s) in Xero first, then void.`,
      };
    }

    // AUTHORISED -> VOIDED; DRAFT/SUBMITTED -> DELETED.
    let targetStatus: Invoice.StatusEnum;
    if (status === Invoice.StatusEnum.AUTHORISED) {
      targetStatus = Invoice.StatusEnum.VOIDED;
    } else if (
      status === Invoice.StatusEnum.DRAFT ||
      status === Invoice.StatusEnum.SUBMITTED
    ) {
      targetStatus = Invoice.StatusEnum.DELETED;
    } else {
      return {
        result: null,
        isError: true,
        error: `Cannot void an invoice with status ${status}.`,
      };
    }

    const updated = await setInvoiceStatus(invoiceId, targetStatus);
    if (!updated) {
      throw new Error("Failed to void the invoice.");
    }

    return { result: updated, isError: false, error: null };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
