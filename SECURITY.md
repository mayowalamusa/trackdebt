# Track Debt Security

## Reporting a vulnerability

Please do not publish exploit details, customer records, screenshots containing private data, access tokens, or secrets in a public issue. Report suspected vulnerabilities privately to the project maintainer at **mytrackdebt@gmail.com** with the affected feature, impact, and steps to reproduce using only accounts and data you control. Do not access or alter other people's data.

## Security controls and limits

- Business-logo uploads accept only JPEG, PNG, and WebP; reject other MIME types, files over 5 MiB, mismatched file signatures, and excessive image dimensions.
- Accepted logos are decoded and re-encoded as PNG at a maximum 1024-pixel longest edge. The original uploaded bytes and metadata are not stored as the logo.
- These browser-side controls are defense in depth, not a substitute for server-side validation. Browser image decoders are complex; no upload pipeline can guarantee that every malicious file is harmless.
- Dependency audits and application test/build checks run in GitHub Actions. Audit findings must be triaged and dependencies updated; a green build alone is not a security certification.
- Cloud data must be protected by Supabase Row Level Security policies that enforce the authenticated user's ownership on every relevant table and storage object. Never expose a Supabase service-role key or payment-provider secret in client code or Git history.
- Do not make customer data, receipts, backups, or other private business files publicly accessible by default.

## Release verification checklist

Before a production release:
1. Review GitHub Actions results and resolve high/critical production dependency advisories.
2. Test with two separate test accounts that one account cannot read, update, or delete the other account's customers, transactions, reminders, or subscription records.
3. Verify unauthenticated requests cannot read or change protected cloud records and that authorization is enforced server-side, not only by hiding UI controls.
4. Review Supabase RLS policies and Storage bucket policies in the live project. A code commit does not automatically apply or verify dashboard settings or database policies.
5. Check that secrets are stored only in approved server-side secret stores and rotate any secret that may have been exposed.

This document describes safeguards and verification requirements; it is not a claim that Track Debt has passed an independent penetration test.
