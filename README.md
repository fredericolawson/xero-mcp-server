# Xero MCP Server — Enhanced Fork

Talk to your [Xero](https://www.xero.com/) accounts in plain English. This connects Xero to Claude (or any AI assistant that supports MCP) so you can look up invoices, create bills with the supplier's PDF attached, chase overdue payments, and break down what makes up an account — just by asking.

It's an enhanced fork of the official [`xeroapi/xero-mcp-server`](https://github.com/XeroAPI/xero-mcp-server) with extra tools built for real bookkeeping workflows. [See what it adds ↓](#what-this-fork-adds-over-the-official-xero-mcp)

## Getting started

Connecting Xero to Claude Desktop takes three steps and about ten minutes. You only do it once.

### 1. Get your Xero credentials

You'll need a **Client ID** and **Client Secret** from Xero:

1. Go to the [Xero Developer portal](https://developer.xero.com/) and create a **Custom Connection**, following Xero's [step-by-step guide](https://developer.xero.com/documentation/guides/oauth2/custom-connections/).
2. When it asks which permissions to grant, add **all** of the scopes listed under [Required scopes](#required-scopes) below.
3. Xero gives you a **Client ID** and **Client Secret** — keep them handy for the next step.

> Don't have a Xero account yet? [Sign up free](https://www.xero.com/au/signup/). A **Demo Company** (top-left dropdown once you're logged in) comes pre-loaded with sample data so you can experiment safely.

### 2. Connect it to Claude Desktop

Open Claude Desktop, go to **Settings → Developer → Edit Config**, and add the `xero` block below — pasting in the Client ID and Secret from step 1:

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "github:fredericolawson/xero-mcp-server"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

If the file already has other entries under `mcpServers`, just add `"xero": { … }` alongside them.

### 3. Restart and start asking

Quit and reopen Claude Desktop. Xero connects automatically and its tools appear in a new chat. Try one of the [example prompts](#example-things-to-ask) below.

> **Updating later:** new versions are picked up by clearing the cache and restarting Claude Desktop:
> ```bash
> rm -rf ~/.npm/_npx
> ```
> Your Client ID and Secret stay put — you don't repeat the setup.

## Example things to ask

- "Which invoices are overdue, and who owes us the most?"
- "What did we spend on shipping last quarter?"
- "Create a £450 bill from Acme Ltd dated today and attach /Users/me/Downloads/acme.pdf"
- "Show me every transaction posted to General Expenses in May."
- "List our draft bills so I can review them before approving."

---

> Everything below is reference material and developer setup — you don't need it for everyday use.

## What this fork adds over the official Xero MCP

### New tools

| Tool | What it does | Gap in the official MCP it fills |
|------|--------------|----------------------------------|
| `get-contact` | Fetch a **single contact's full record** by ID — addresses, phones, contact persons, outstanding/overdue balances, payment terms, tax details and default account codes. | Upstream only has a lightweight `list-contacts`; there's no way to pull one contact's full detail. |
| `void-invoice` | **Void/cancel an invoice or bill**: an approved (AUTHORISED) invoice → `VOIDED`; a `DRAFT`/`SUBMITTED` one → `DELETED`. Blocks cleanly if payments are applied. | Upstream has no void or delete path for invoices. |
| `delete-bank-transaction` | **Delete a Spend Money / Receive Money transaction** (sets its status to `DELETED`). Guards against bank transfers (which the API can't delete) and surfaces a clear "un-reconcile first" error when needed. | Upstream exposes create/list/update for bank transactions but no delete. |
| `create-purchase-order` / `list-purchase-orders` / `update-purchase-order` | **Raise and manage purchase orders** — the procurement step that precedes a bill. Create as DRAFT/SUBMITTED/AUTHORISED, filter by status and date, and update or cancel (DELETED). | Upstream has no purchase order support at all. |
| `upload-attachment` / `list-attachments` / `get-attachment` | **Attach, list and download files on records that already exist** — bills/invoices, bank transactions, contacts, credit notes, manual journals and purchase orders. | Upstream can only attach a file to an invoice *at creation time* (and can't read attachments back). |
| `allocate-credit-note` | **Apply a credit note to an invoice or bill**, reducing the amount owing. | Upstream can create a credit note but never allocate it, leaving the credit stranded. |
| `delete-payment` | **Reverse a payment**, crediting the amount back to the linked invoice. | Upstream has no way to undo a payment. |
| `list-repeating-invoices` | **List recurring invoice/bill templates** and their schedules. | Upstream has no repeating-invoice support. |
| `list-account-transactions` | **Decompose an account into its transactions** — lists the individual line items posted to one account over a period (from invoices/bills, spend/receive money, credit notes and manual journals), with a net GL movement. | Upstream only exposes account *totals* via the summary reports; there's no way to see the transactions that make up an account balance. |

### Enhanced existing tools

| Tool | Parameters this fork adds (on top of the upstream ones) |
|------|---------------------------------------------------------|
| `create-invoice` | `currencyCode` (multi-currency bills), `dueDate`, `status` (`DRAFT`/`SUBMITTED`/`AUTHORISED` — create approved bills directly, skipping the manual draft-approval step), and `attachmentPath` (upload a local file, e.g. a supplier PDF, onto the new bill **in the same call**; the file is validated *before* the invoice is created, so a bad path never leaves an orphaned bill). |
| `list-invoices` | `statuses`, `where` (arbitrary Xero filter expressions, e.g. `Type=="ACCPAY"`), and `order`. (Upstream already supports `page`, `contactIds`, `invoiceNumbers`.) |
| `list-contacts` | `where`, `order`, `includeArchived`, `summaryOnly=false` (full-detail mode with addresses/phones/balances/payment terms), and `pageSize`, with bounded pagination. (Upstream supports `page` and `searchTerm`.) |
| `update-contact` | `defaultCurrency` — set a contact's default currency via the API, so new invoices/bills inherit it. |

Together these turn the server into an end-to-end **bill-processing pipeline**: look up a contact, dedup against existing bills by invoice number, create an AUTHORISED multi-currency bill with the source PDF attached in one call, and void/delete entries that were booked in error.

## Available MCP Commands

Tools marked ✨ are **new in this fork**; tools marked ➕ are **enhanced** beyond the official server (see [What this fork adds](#what-this-fork-adds-over-the-official-xero-mcp) for details).

- `list-accounts`: Retrieve a list of accounts
- ➕ `list-contacts`: Retrieve a list of contacts (adds `where`, `order`, `includeArchived`, `pageSize`, and `summaryOnly=false` for full detail)
- ✨ `get-contact`: Retrieve a single contact by ID, including addresses, phones, contact persons, balances and payment terms
- `list-credit-notes`: Retrieve a list of credit notes
- ➕ `list-invoices`: Retrieve a list of invoices (adds `statuses`, a `where` expression, and `order`; upstream `contactIds`/`invoiceNumbers` still supported)
- `list-items`: Retrieve a list of items
- `list-manual-journals`: Retrieve a list of manual journals
- `list-organisation-details`: Retrieve details about an organisation
- `list-profit-and-loss`: Retrieve a profit and loss report
- `list-quotes`: Retrieve a list of quotes
- `list-tax-rates`: Retrieve a list of tax rates
- `list-payments`: Retrieve a list of payments
- `list-trial-balance`: Retrieve a trial balance report
- `list-bank-transactions`: Retrieve a list of bank account transactions
- `list-payroll-employees`: Retrieve a list of Payroll Employees
- `list-report-balance-sheet`: Retrieve a balance sheet report
- `list-payroll-employee-leave`: Retrieve a Payroll Employee's leave records
- `list-payroll-employee-leave-balances`: Retrieve a Payroll Employee's leave balances
- `list-payroll-employee-leave-types`: Retrieve a list of Payroll leave types
- `list-payroll-leave-periods`: Retrieve a list of a Payroll Employee's leave periods
- `list-payroll-leave-types`: Retrieve a list of all available leave types in Xero Payroll
- `list-timesheets`: Retrieve a list of Payroll Timesheets
- `list-aged-receivables-by-contact`: Retrieve aged receivables for a contact
- `list-aged-payables-by-contact`: Retrieve aged payables for a contact
- `list-contact-groups`: Retrieve a list of contact groups
- `list-tracking-categories`: Retrieve a list of tracking categories
- ✨ `list-purchase-orders`: Retrieve a list of purchase orders (filter by `status` and issue-date range)
- ✨ `list-repeating-invoices`: Retrieve recurring invoice/bill templates and their schedules
- ✨ `list-attachments`: List the files attached to a record (invoice/bill, bank transaction, contact, credit note, manual journal, or purchase order)
- ✨ `get-attachment`: Download a named attachment from a record to a local file
- ✨ `list-account-transactions`: Decompose a single account into the individual line items posted to it over a period (from invoices/bills, spend/receive money, credit notes and manual journals), with a net GL movement. A document-level stand-in for the GL — won't perfectly tie to the P&L (system-generated postings like FX/rounding aren't captured)
- `create-bank-transaction`: Create a new bank transaction
- `create-contact`: Create a new contact
- `create-credit-note`: Create a new credit note
- ➕ `create-invoice`: Create a new invoice (adds `currencyCode`, `dueDate`, `status` — DRAFT/SUBMITTED/AUTHORISED — and `attachmentPath` to upload a local file, e.g. the supplier's PDF, onto the new bill; `attachmentPath` requires the `accounting.attachments` scope)
- `create-item`: Create a new item
- `create-manual-journal`: Create a new manual journal
- `create-payment`: Create a new payment
- `create-quote`: Create a new quote
- `create-payroll-timesheet`: Create a new Payroll Timesheet
- `create-tracking-category`: Create a new tracking category
- `create-tracking-option`: Create a new tracking option
- ✨ `create-purchase-order`: Create a new purchase order (DRAFT/SUBMITTED/AUTHORISED)
- ✨ `allocate-credit-note`: Apply (allocate) a credit note to an invoice or bill
- ✨ `upload-attachment`: Upload a local file as an attachment to an existing record (invoice/bill, bank transaction, contact, credit note, manual journal, or purchase order); requires the `accounting.attachments` scope
- `update-bank-transaction`: Update an existing bank transaction
- ➕ `update-contact`: Update an existing contact (adds `defaultCurrency`)
- `update-invoice`: Update an existing draft invoice
- ✨ `void-invoice`: Void an approved invoice/bill (or delete a draft/submitted one)
- ✨ `update-purchase-order`: Update an existing purchase order (or cancel it by setting status to DELETED)
- `update-item`: Update an existing item
- `update-manual-journal`: Update an existing manual journal
- `update-quote`: Update an existing draft quote
- `update-credit-note`: Update an existing draft credit note
- `update-tracking-category`: Update an existing tracking category
- `update-tracking-options`: Update tracking options
- `update-payroll-timesheet-line`: Update a line on an existing Payroll Timesheet
- `approve-payroll-timesheet`: Approve a Payroll Timesheet
- `revert-payroll-timesheet`: Revert an approved Payroll Timesheet
- `add-payroll-timesheet-line`: Add a new line on an existing Payroll Timesheet
- `delete-payroll-timesheet`: Delete an existing Payroll Timesheet
- ✨ `delete-bank-transaction`: Delete a Spend Money / Receive Money bank transaction (sets its status to DELETED; transfers and reconciled transactions are handled in the Xero UI)
- ✨ `delete-payment`: Reverse (delete) a payment, crediting the amount back to the linked invoice
- `get-payroll-timesheet`: Retrieve an existing Payroll Timesheet

For detailed protocol documentation, see the [MCP Protocol Specification](https://modelcontextprotocol.io/).

## Configuration reference

### Required scopes

When you create your Custom Connection (step 1 above), Xero asks which permissions to grant. Custom connections use **granular scopes** — add all of these ([SCOPES_V2](src/clients/xero-client.ts#L93-L112)):

```
accounting.invoices
accounting.attachments
accounting.payments
accounting.banktransactions
accounting.manualjournals
accounting.reports.aged.read
accounting.reports.balancesheet.read
accounting.reports.profitandloss.read
accounting.reports.trialbalance.read
accounting.contacts
accounting.settings
payroll.settings
payroll.employees
payroll.timesheets
```

> **Note:** Connections created before Apr 29, 2026 used a legacy *bundled* scope set ([SCOPES_V1](src/clients/xero-client.ts#L82-L90): `accounting.transactions`, `accounting.reports.read`, etc.). Those broad scopes are deprecated and no longer offered for new connections, so use the granular set above. The server requests the legacy set first and automatically falls back to the granular set, so both kinds of connection work — but new setups will only ever satisfy the granular set.
>
> You can override these by setting the `XERO_SCOPES` environment variable to a space-separated list of scopes.
>
> **Fork-specific:** the `attachmentPath` option on `create-invoice` and the `upload-attachment` / `list-attachments` / `get-attachment` tools need **`accounting.attachments`**. The purchase-order tools, `list-repeating-invoices` and `list-account-transactions` rely on the transaction scopes (`accounting.invoices` / `accounting.banktransactions` / `accounting.manualjournals`). All of these are in the granular set above. Note that credit notes have no granular scope, so `list-account-transactions` skips them and says so in its output.

> **Payroll:** to use Payroll-specific queries, the organisation's region must be either NZ or UK.

### Using a bearer token (advanced)

Instead of a client id and secret, you can authenticate with a bearer token — useful if you need to support multiple Xero accounts at runtime and let the MCP client run an auth flow (such as PKCE):

```json
{
  "mcpServers": {
    "xero": {
      "command": "npx",
      "args": ["-y", "github:fredericolawson/xero-mcp-server"],
      "env": {
        "XERO_CLIENT_BEARER_TOKEN": "your_bearer_token"
      }
    }
  }
}
```

`XERO_CLIENT_BEARER_TOKEN` takes precedence over `XERO_CLIENT_ID` if both are defined. When obtaining a bearer token, request the appropriate scopes:

> **Note:** Some scopes are being deprecated in favour of more granular scopes. See the [Xero OAuth 2.0 Scopes documentation](https://developer.xero.com/documentation/guides/oauth2/scopes/) for details on deprecation timelines.

```
accounting.invoices
accounting.invoices.read
accounting.attachments        # required for create-invoice attachmentPath (this fork)
accounting.payments
accounting.payments.read
accounting.banktransactions
accounting.banktransactions.read
accounting.manualjournals
accounting.manualjournals.read
accounting.reports.aged.read
accounting.reports.balancesheet.read
accounting.reports.profitandloss.read
accounting.reports.trialbalance.read
accounting.contacts
accounting.settings
payroll.settings
payroll.employees
payroll.timesheets
```

### Running from a local build

The `npx` config in [Getting started](#getting-started) needs nothing installed. Build locally only when you're developing against the code. Clone, build, and point your MCP client at the compiled entry file:

```bash
git clone https://github.com/fredericolawson/xero-mcp-server.git
cd xero-mcp-server
npm install
npm run build      # outputs dist/index.js
```

Then in Claude Desktop's config, point `args` at the built file:

```json
{
  "mcpServers": {
    "xero": {
      "command": "node",
      "args": ["/absolute/path/to/xero-mcp-server/dist/index.js"],
      "env": {
        "XERO_CLIENT_ID": "your_client_id_here",
        "XERO_CLIENT_SECRET": "your_client_secret_here",
        "XERO_SCOPES": "accounting.invoices accounting.attachments accounting.contacts accounting.banktransactions accounting.settings"
      }
    }
  }
}
```

`XERO_SCOPES` is optional; if omitted, the default scopes are used. On Windows, escape backslashes in the path, e.g. `"C:\\projects\\xero-mcp-server\\dist\\index.js"`. If you use [nvm](https://github.com/nvm-sh/nvm), set `command` to the full path of the `node` binary.

> **Heads-up:** this fork isn't published to npm under its own name, so don't install it via `npx @xeroapi/xero-mcp-server` — that pulls the official upstream package, not this one. Use the `github:fredericolawson/xero-mcp-server` spec or a local build.

## Features

- Xero OAuth2 authentication (custom connections **and** bearer token)
- Contact, invoice, bank transaction, and Chart of Accounts management
- Multi-currency invoicing with PDF attachments
- Reports: P&L, balance sheet, trial balance, aged payables/receivables
- Payroll (NZ/UK): employees, leave, timesheets
- MCP protocol compliance

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- A Xero developer account with API credentials

## Docs and Links

- [Official upstream project](https://github.com/XeroAPI/xero-mcp-server) (this fork tracks it as the `upstream` git remote)
- [Xero Public API Documentation](https://developer.xero.com/documentation/api/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero OpenAPI Specs](https://github.com/XeroAPI/Xero-OpenAPI)
- [Xero-Node Public API SDK Docs](https://xeroapi.github.io/xero-node/accounting)
- [Developer Documentation](https://developer.xero.com/)

## For Developers

### Installation

```bash
npm install   # or: pnpm install
```

### Build

```bash
npm run build   # or: pnpm build
```

### Test & lint

```bash
npm test        # vitest
npm run lint    # eslint
```

### Keeping in sync with upstream

This fork tracks the official repo as the `upstream` remote:

```bash
git remote add upstream https://github.com/XeroAPI/xero-mcp-server.git   # one-time
git fetch upstream
git rebase upstream/main    # replay this fork's commits on top of the latest official release
```

## License

MIT

## Security

Please do not commit your `.env` file or any sensitive credentials to version control (it is included in `.gitignore` as a safe default).
