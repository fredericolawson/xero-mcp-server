import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Invoice } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface ListInvoicesOptions {
  page?: number;
  contactIds?: string[];
  invoiceNumbers?: string[];
  statuses?: string[];
  where?: string;
  order?: string;
}

async function getInvoices({
  page = 1,
  contactIds,
  invoiceNumbers,
  statuses,
  where,
  order = "UpdatedDateUTC DESC",
}: ListInvoicesOptions): Promise<Invoice[]> {
  await xeroClient.authenticate();

  const invoices = await xeroClient.accountingApi.getInvoices(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where, // where
    order, // order
    undefined, // iDs
    invoiceNumbers, // invoiceNumbers
    contactIds, // contactIDs
    statuses, // statuses
    page,
    false, // includeArchived
    false, // createdByMyApp
    undefined, // unitdp
    false, // summaryOnly
    10, // pageSize
    undefined, // searchTerm
    getClientHeaders(),
  );
  return invoices.body.invoices ?? [];
}

/**
 * List invoices from Xero with optional filtering by contact, invoice number,
 * status, a Xero 'where' expression, and ordering.
 */
export async function listXeroInvoices(
  options: ListInvoicesOptions = {},
): Promise<XeroClientResponse<Invoice[]>> {
  try {
    const invoices = await getInvoices(options);

    return {
      result: invoices,
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
