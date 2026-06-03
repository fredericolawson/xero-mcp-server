import { z } from "zod";

import { getXeroContact } from "../../handlers/get-xero-contact.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { formatContact } from "../../helpers/format-contact.js";

const GetContactTool = CreateXeroTool(
  "get-contact",
  `Retrieve a single contact from Xero by its contact ID.
Returns the full contact record — including addresses, phone numbers, contact persons, \
outstanding/overdue balances, payment terms, tax details and default account codes — \
which are not included in the lightweight list-contacts response.`,
  {
    contactId: z
      .string()
      .describe("The Xero contact ID (GUID) of the contact to retrieve."),
  },
  async ({ contactId }) => {
    const response = await getXeroContact(contactId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving contact: ${response.error}`,
          },
        ],
      };
    }

    const contact = response.result;

    if (!contact) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No contact found with ID: ${contactId}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: formatContact(contact),
        },
      ],
    };
  },
);

export default GetContactTool;
