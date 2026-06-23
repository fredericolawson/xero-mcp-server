import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { RepeatingInvoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface ListRepeatingInvoicesOptions {
  where?: string;
  order?: string;
}

async function getRepeatingInvoices({
  where,
  order,
}: ListRepeatingInvoicesOptions): Promise<RepeatingInvoice[]> {
  await xeroClient.authenticate();

  const response = await xeroClient.accountingApi.getRepeatingInvoices(
    xeroClient.tenantId,
    where, // where
    order, // order
    getClientHeaders(),
  );
  return response.body.repeatingInvoices ?? [];
}

/**
 * List repeating (recurring) invoice templates from Xero, with optional
 * 'where' filtering and ordering.
 */
export async function listXeroRepeatingInvoices(
  options: ListRepeatingInvoicesOptions = {},
): Promise<XeroClientResponse<RepeatingInvoice[]>> {
  try {
    const repeatingInvoices = await getRepeatingInvoices(options);
    return { result: repeatingInvoices, isError: false, error: null };
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
