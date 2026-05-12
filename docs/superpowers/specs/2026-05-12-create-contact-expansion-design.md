# Design: Expand `create-contact` Tool

**Date:** 2026-05-12  
**Status:** Approved

## Problem

`create-contact` exposes only 9 fields. When Claude is asked to create a company contact with a contact person or email address, it has no structured fields to use — it falls back to stuffing data into `note` (unstructured) or creates a separate person contact (data garbage).

Root cause: the tool schema does not expose `emailAddresses`, `phoneNumbers`, `addresses`, or `company.contactPersons`.

## Goal

Expand `create-contact` to expose all fields the Lexware API supports for `POST /v1/contacts`, matching parity with `update-contact`.

## Approach: Direct Expansion (no shared builder)

Expand `create-contact` in place. No abstraction extracted.

Rationale: `update-contact` has get-before-put merge logic throughout (preserving existing arrays, merging partial fields). `create-contact` is a clean POST with no existing data — the handlers are structurally different enough that a shared builder would need two modes and add more complexity than it saves.

## Changes

### File

`src/index.ts` — `create-contact` block (lines 575–618).

### Schema additions (26 new parameters)

All optional. All match the `update-contact` schema exactly.

**Billing address:**
- `billingStreet` — street and house number
- `billingZip` — postal code
- `billingCity` — city
- `billingCountryCode` — ISO 3166-1 alpha-2 (2 chars), e.g. `"DE"`
- `billingSupplement` — optional address supplement

**Shipping address:**
- `shippingStreet`, `shippingZip`, `shippingCity`, `shippingCountryCode`, `shippingSupplement`

**Email addresses (max 1 per type — API limit):**
- `emailBusiness`, `emailOffice`, `emailPrivate`, `emailOther`

**Phone numbers (max 1 per type — API limit):**
- `phoneBusiness`, `phoneOffice`, `phoneMobile`, `phonePrivate`, `phoneFax`, `phoneOther`

**Contact persons (max 1 — API limit):**
- `contactPersons`: array of objects with `salutation` (optional), `firstName` (optional), `lastName` (required), `primary` (boolean, optional), `emailAddress` (optional), `phoneNumber` (optional)

### Handler changes

Build nested API payload directly from params. No get-before-put needed (new contact, no existing data).

```ts
// Addresses
const hasBillingFields = billingStreet !== undefined || billingZip !== undefined
  || billingCity !== undefined || billingCountryCode !== undefined || billingSupplement !== undefined;
const hasShippingFields = /* same pattern */;

const addressesPayload = {
  ...(hasBillingFields ? { billing: [{
    ...(billingSupplement !== undefined ? { supplement: billingSupplement } : {}),
    ...(billingStreet !== undefined ? { street: billingStreet } : {}),
    ...(billingZip !== undefined ? { zip: billingZip } : {}),
    ...(billingCity !== undefined ? { city: billingCity } : {}),
    ...(billingCountryCode !== undefined ? { countryCode: billingCountryCode } : {}),
  }] } : {}),
  ...(hasShippingFields ? { shipping: [{ /* same */ }] } : {}),
};

// Emails
const emailAddressesPayload = {
  ...(emailBusiness !== undefined ? { business: [emailBusiness] } : {}),
  ...(emailOffice !== undefined ? { office: [emailOffice] } : {}),
  ...(emailPrivate !== undefined ? { private: [emailPrivate] } : {}),
  ...(emailOther !== undefined ? { other: [emailOther] } : {}),
};

// Phones — same pattern for business/office/mobile/private/fax/other

// Company
const companyPayload = companyName !== undefined ? {
  name: companyName,
  ...(taxNumber !== undefined ? { taxNumber } : {}),
  ...(vatRegistrationId !== undefined ? { vatRegistrationId } : {}),
  ...(contactPersons !== undefined ? { contactPersons } : {}),
} : undefined;
```

Only include non-empty nested objects in the final POST body (omit `addresses`, `emailAddresses`, `phoneNumbers` keys entirely if no relevant params were passed).

### Tool description update

From:
> "Create a new contact in Lexware Office. Provide companyName for a company contact, or firstName/lastName for a person. Set customer and/or vendor to true."

To:
> "Create a new contact in Lexware Office. For company contacts: provide companyName and optionally contactPersons (max. 1) with emailAddress. For person contacts: provide firstName/lastName. Supports billing/shipping address, email addresses (business/office/private/other), and phone numbers. Set customer and/or vendor to true. API limit: max. one entry per email/phone list, max. one contactPerson."

## Acceptance Criteria

1. Company contact + contact person → `company.contactPersons[0].emailAddress` populated, not `note`
2. Company contact + `emailBusiness` → `emailAddresses.business[0]` populated
3. Company contact + billing address → `addresses.billing[0]` populated
4. Person contact + `phoneMobile` → `phoneNumbers.mobile[0]` populated
5. All fields in one call → correct nested payload, no API error
6. Existing minimal calls (companyName only, lastName only) → unchanged behavior

## Out of Scope

- `update-contact` — no changes needed (already has full field coverage)
- `allowTaxFreeInvoices` — present in `update-contact` but not applicable to `create-contact` (no existing role state to amend)
