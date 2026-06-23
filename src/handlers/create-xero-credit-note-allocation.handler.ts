import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Allocation } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface CreateCreditNoteAllocationParams {
  creditNoteId: string;
  invoiceId: string;
  amount: number;
  date?: string;
}

async function createCreditNoteAllocation({
  creditNoteId,
  invoiceId,
  amount,
  date,
}: CreateCreditNoteAllocationParams): Promise<Allocation | undefined> {
  await xeroClient.authenticate();

  const allocation: Allocation = {
    invoice: { invoiceID: invoiceId },
    amount: amount,
    date: date || new Date().toISOString().split("T")[0],
  };

  const response = await xeroClient.accountingApi.createCreditNoteAllocation(
    xeroClient.tenantId,
    creditNoteId,
    { allocations: [allocation] },
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(),
  );
  return response.body.allocations?.[0];
}

/**
 * Allocate (apply) a credit note to an invoice or bill in Xero, reducing the
 * amount owing on that invoice by the allocated amount.
 */
export async function createXeroCreditNoteAllocation(
  params: CreateCreditNoteAllocationParams,
): Promise<XeroClientResponse<Allocation>> {
  try {
    const allocation = await createCreditNoteAllocation(params);

    if (!allocation) {
      throw new Error("Credit note allocation failed.");
    }

    return { result: allocation, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
