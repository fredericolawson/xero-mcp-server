import { xeroClient } from "../clients/xero-client.js";
import { Contact } from "xero-node";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface ListContactsOptions {
  page?: number;
  searchTerm?: string;
  where?: string;
  order?: string;
  includeArchived?: boolean;
  summaryOnly?: boolean;
  pageSize?: number;
}

async function getContacts({
  page,
  searchTerm,
  where,
  order,
  includeArchived,
  summaryOnly = true,
  pageSize,
}: ListContactsOptions): Promise<Contact[]> {
  await xeroClient.authenticate();

  // When requesting the full ("heavy") response, force pagination so a single
  // call can't accidentally pull every contact at once. Without a page the Xero
  // Contacts endpoint returns ALL contacts, which with summaryOnly=false can be
  // many megabytes. Defaulting to page 1 keeps the response bounded.
  const effectivePage = !summaryOnly && page === undefined ? 1 : page;

  const contacts = await xeroClient.accountingApi.getContacts(
    xeroClient.tenantId,
    undefined, // ifModifiedSince
    where, // where
    order, // order
    undefined, // iDs
    effectivePage, // page
    includeArchived, // includeArchived
    summaryOnly, // summaryOnly
    searchTerm, // searchTerm
    pageSize, // pageSize
    getClientHeaders(),
  );
  return contacts.body.contacts ?? [];
}

/**
 * List contacts from Xero with optional filtering, ordering and pagination.
 *
 * By default this returns the lightweight (summaryOnly) response for speed.
 * Pass summaryOnly=false to include heavier fields — addresses, phones,
 * balances and payment terms — for each contact.
 */
export async function listXeroContacts(
  options: ListContactsOptions = {},
): Promise<XeroClientResponse<Contact[]>> {
  try {
    const contacts = await getContacts(options);

    return {
      result: contacts,
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
