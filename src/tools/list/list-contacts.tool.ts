import { listXeroContacts } from "../../handlers/list-xero-contacts.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatContact } from "../../helpers/format-contact.js";
import { z } from "zod";

const ListContactsTool = CreateXeroTool(
  "list-contacts",
  "List all contacts in Xero. This includes Suppliers and Customers.",
  {
    page: z.number().optional().describe("Optional page number (starts at 1) for pagination. If omitted, ALL matching contacts are returned in a single response — the Xero Contacts endpoint only paginates when this is set (full-detail mode, summaryOnly=false, defaults to page 1). If a full page is returned, call again with the next page number."),
    searchTerm: z.string().optional().describe("Search parameter that performs a case-insensitive text search across the Name, FirstName, LastName, ContactNumber and EmailAddress fields. Cannot be combined with the 'where' filter."),
    where: z.string().optional().describe("Optional Xero 'where' filter expression to narrow results by any field, e.g. `ContactStatus==\"ACTIVE\"`, `IsCustomer==true`, or `EmailAddress!=null&&EmailAddress.StartsWith(\"acme\")`. Cannot be combined with searchTerm."),
    order: z.string().optional().describe("Optional field to order the results by, e.g. `Name` or `Name DESC`."),
    includeArchived: z.boolean().optional().describe("If true, contacts with a status of ARCHIVED are included in the response. Defaults to false."),
    summaryOnly: z.boolean().optional().describe("Defaults to true for a fast, lightweight response. Set to false to include heavier fields such as addresses, phones, balances and payment terms for each contact. When false, results are paginated (page 1 by default) to keep the response size bounded."),
    pageSize: z.number().optional().describe("Number of contacts per page (maximum 200, defaults to 100). Only takes effect when 'page' is also set — otherwise it is ignored and all contacts are returned."),
  },
  async (params) => {
    const { page, summaryOnly } = params;
    const response = await listXeroContacts(params);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing contacts: ${response.error}`,
          },
        ],
      };
    }

    const contacts = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${contacts?.length || 0} contacts${page ? ` (page ${page})` : ''}:`,
        },
        ...(contacts?.map((contact) => ({
          type: "text" as const,
          text:
            summaryOnly === false
              ? formatContact(contact)
              : [
                  `Contact: ${contact.name}`,
                  `ID: ${contact.contactID}`,
                  contact.firstName ? `First Name: ${contact.firstName}` : null,
                  contact.lastName ? `Last Name: ${contact.lastName}` : null,
                  contact.emailAddress
                    ? `Email: ${contact.emailAddress}`
                    : "No email",
                  contact.accountNumber
                    ? `Account Number: ${contact.accountNumber}`
                    : null,
                  contact.accountsReceivableTaxType
                    ? `AR Tax Type: ${contact.accountsReceivableTaxType}`
                    : null,
                  contact.accountsPayableTaxType
                    ? `AP Tax Type: ${contact.accountsPayableTaxType}`
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
                  contact.updatedDateUTC
                    ? `Last Updated: ${contact.updatedDateUTC}`
                    : null,
                  `Status: ${contact.contactStatus || "Unknown"}`,
                  contact.contactGroups?.length
                    ? `Groups: ${contact.contactGroups.map((g) => g.name).join(", ")}`
                    : null,
                  contact.hasAttachments ? "Has Attachments: Yes" : null,
                  contact.hasValidationErrors ? "Has Validation Errors: Yes" : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListContactsTool;
