import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Payment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function deletePayment(paymentId: string): Promise<Payment | undefined> {
  await xeroClient.authenticate();

  // Xero "deletes" a payment by transitioning it to DELETED, which reverses it
  // and restores the amount owing on the linked invoice.
  const response = await xeroClient.accountingApi.deletePayment(
    xeroClient.tenantId,
    paymentId,
    { status: "DELETED" },
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  return response.body.payments?.[0];
}

/**
 * Reverse (delete) a payment in Xero.
 *
 * The amount paid is credited back to the linked invoice. A payment that has
 * already been reconciled against a bank statement line cannot be deleted via
 * the API — Xero returns an error, which is surfaced to the caller.
 */
export async function deleteXeroPayment(
  paymentId: string,
): Promise<XeroClientResponse<Payment>> {
  try {
    const payment = await deletePayment(paymentId);

    if (!payment) {
      throw new Error("Payment deletion failed.");
    }

    return { result: payment, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
