import { Contact } from "xero-node";

/**
 * Formats a Xero Contact into a detailed, human-readable multi-line string.
 *
 * Surfaces the full ("heavy") contact object — addresses, phones, contact
 * persons, outstanding/overdue balances, payment terms, tax details and
 * accounting defaults — that the Xero API only returns when summaryOnly is not
 * set (e.g. when fetching a single contact, or listing with summaryOnly=false).
 * Empty fields are omitted.
 */
export function formatContact(contact: Contact): string {
  const lines: (string | null)[] = [
    `Contact: ${contact.name}`,
    `ID: ${contact.contactID}`,
    contact.contactStatus ? `Status: ${contact.contactStatus}` : null,
    contact.firstName ? `First Name: ${contact.firstName}` : null,
    contact.lastName ? `Last Name: ${contact.lastName}` : null,
    contact.emailAddress ? `Email: ${contact.emailAddress}` : null,
    contact.website ? `Website: ${contact.website}` : null,
    // Identifiers
    contact.contactNumber ? `Contact Number: ${contact.contactNumber}` : null,
    contact.accountNumber ? `Account Number: ${contact.accountNumber}` : null,
    contact.companyNumber ? `Company Number: ${contact.companyNumber}` : null,
    contact.taxNumber
      ? `Tax Number: ${contact.taxNumber}${
          contact.taxNumberType ? ` (${contact.taxNumberType})` : ""
        }`
      : null,
    `Type: ${
      [
        contact.isCustomer ? "Customer" : null,
        contact.isSupplier ? "Supplier" : null,
      ]
        .filter(Boolean)
        .join(", ") || "Unknown"
    }`,
    contact.defaultCurrency
      ? `Default Currency: ${contact.defaultCurrency}`
      : null,
    // Tax types
    contact.accountsReceivableTaxType
      ? `AR Tax Type: ${contact.accountsReceivableTaxType}`
      : null,
    contact.accountsPayableTaxType
      ? `AP Tax Type: ${contact.accountsPayableTaxType}`
      : null,
    // Default account codes
    contact.salesDefaultAccountCode
      ? `Sales Default Account: ${contact.salesDefaultAccountCode}`
      : null,
    contact.purchasesDefaultAccountCode
      ? `Purchases Default Account: ${contact.purchasesDefaultAccountCode}`
      : null,
  ];

  // Balances — only present when summaryOnly is not set
  const ar = contact.balances?.accountsReceivable;
  if (ar) {
    lines.push(
      `Accounts Receivable: outstanding ${ar.outstanding ?? 0}, overdue ${
        ar.overdue ?? 0
      }`,
    );
  }
  const ap = contact.balances?.accountsPayable;
  if (ap) {
    lines.push(
      `Accounts Payable: outstanding ${ap.outstanding ?? 0}, overdue ${
        ap.overdue ?? 0
      }`,
    );
  }

  // Payment terms
  const billTerm = contact.paymentTerms?.bills;
  const salesTerm = contact.paymentTerms?.sales;
  if (billTerm?.day != null || salesTerm?.day != null) {
    const terms: string[] = [];
    if (billTerm?.day != null) {
      terms.push(`bills due day ${billTerm.day} (${billTerm.type})`);
    }
    if (salesTerm?.day != null) {
      terms.push(`sales due day ${salesTerm.day} (${salesTerm.type})`);
    }
    lines.push(`Payment Terms: ${terms.join("; ")}`);
  }

  // Phones
  for (const phone of contact.phones ?? []) {
    if (!phone.phoneNumber?.trim()) continue;
    const number = [
      phone.phoneCountryCode,
      phone.phoneAreaCode,
      phone.phoneNumber,
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`Phone (${phone.phoneType ?? "DEFAULT"}): ${number}`);
  }

  // Addresses
  for (const address of contact.addresses ?? []) {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      address.addressLine3,
      address.addressLine4,
      address.city,
      address.region,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    if (parts.length === 0) continue;
    lines.push(`Address (${address.addressType ?? "STREET"}): ${parts.join(", ")}`);
  }

  // Contact persons
  for (const person of contact.contactPersons ?? []) {
    const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
    lines.push(
      `Contact Person: ${name || "(unnamed)"}${
        person.emailAddress ? ` <${person.emailAddress}>` : ""
      }`,
    );
  }

  // Banking & discounts
  if (contact.bankAccountDetails) {
    lines.push(`Bank Account: ${contact.bankAccountDetails}`);
  }
  if (contact.discount != null) {
    lines.push(`Default Discount: ${contact.discount}%`);
  }

  // Groups & metadata
  if (contact.contactGroups?.length) {
    lines.push(`Groups: ${contact.contactGroups.map((g) => g.name).join(", ")}`);
  }
  if (contact.hasAttachments) lines.push("Has Attachments: Yes");
  if (contact.hasValidationErrors) lines.push("Has Validation Errors: Yes");
  if (contact.updatedDateUTC) {
    lines.push(`Last Updated: ${contact.updatedDateUTC}`);
  }

  return lines.filter(Boolean).join("\n");
}
