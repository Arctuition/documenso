# ArcSite customizations

This fork tracks upstream Documenso. Everything ArcSite changes on top of upstream is listed here so
the next upstream merge knows what to keep. Code comments mark each change with `ArcSite:`.

Current base: upstream `v2.21.0` (previous fork was based on `v1.10.0-rc.3`).

## cloudservice integration (must stay compatible)

cloudservice (`arcservice/services/documenso.py`) only uses API v1 with a raw token in `Authorization`:

| Call | Notes |
| --- | --- |
| `POST /api/v1/documents` | recipients carry `signingOrder` 0/1 and a per-recipient `redirectUrl`; `meta` is `{signingOrder: SEQUENTIAL, distributionMethod: NONE}` |
| `PUT <uploadUrl>` | raw PDF to the presigned S3 URL |
| `POST /api/v1/documents/{id}/fields` | array of SIGNATURE / INITIALS / DATE fields in percentages |
| `POST /api/v1/documents/{id}/send` | `{sendEmail: false, sendCompletionEmails: false}` |
| `GET /api/v1/documents/{id}`, `/download`, `DELETE /api/v1/documents/{id}` | reads `status`, `recipients[].id/signingStatus`, `downloadUrl` |
| Webhook | reads `event`, `payload.id`, `payload.Recipient[].id` |
| Signing link | stored `signingUrl` plus `?lang=`; the sales link is shown in an iframe in arcsite_web |

## Changes

### API and data

- **Per-recipient `redirectUrl`**: `Recipient.redirectUrl` column (migration
  `20250401032950_add_redirect_url_field_to_recipients`, keep the name, prod already applied it),
  accepted by API v1 `createDocument`, saved in `setDocumentRecipients`, exposed on
  `ZRecipientLiteSchema`. After signing, and when opening an already signed link, the signer goes to
  `recipient.redirectUrl`, then `documentMeta.redirectUrl`, then `/sign/{token}/complete`
  (V1 page, V2 complete dialog, both signing loaders).
- **Signing links never expire by default**: `resolveExpiresAt(null)` returns `null` and new
  organisations default to `{ disabled: true }`. Upstream defaults to 3 months, which would break
  stored cloudservice links. Organisations can still opt in from settings.

### Language

- `?lang=xx` on any page sets the UI language for that request without overwriting the `lang`
  cookie (`apps/remix/app/utils/get-request-language.server.ts`, `root.tsx`, `entry.server.tsx`).
- `formatSigningLink(token, language)` appends `?lang=` with the document language; every
  "copy signing link" UI passes `documentMeta.language` (document list rows now include it).
- The signature disclosure links to ArcSite's terms (French: `modalites-et-conditions`).
- Fork translations (mostly French) were carried over into `packages/lib/translations/*/web.po`.

### Signing page (V1 envelopes, which API v1 creates)

- Fixed compact header with the title and a "Next field (n)" / "Finish" button
  (`document-signing-next-field.tsx`); the signing sidebar, mobile widget and reject button are gone.
- Full-width PDF, no "Page x of y" labels.
- Date fields are signed automatically when the page opens.
- Signature field: bottom sheet on mobile; clicking a signed field shows Change / Clear; an existing
  signature is reused for other fields; uploaded signatures are disabled; thicker drawn strokes.
- Field text shrinks to fit small fields (`use-fit-text.ts`, `packages/ui/components/field/field-fit-text.tsx`),
  and empty fields keep a 44px tap target. Fit text only transitions colour: upstream's `duration-200`
  also animated font-size, so measurements read stale sizes and always shrank to the minimum.
- Typed signatures stay on one line and shrink to fit instead of wrapping out of the field.
- Fields other recipients already filled (e.g. the customer's date when sales signs) also stay on one
  line and shrink to fit, with `px-0.5` instead of `px-2`: `FieldContent` `fitInsertedText`, turned on
  by `DocumentReadOnlyFields`. Upstream wrapped them and clipped the second line.
- The document starts right below the fixed header (spacing follows the header's real height) and
  uses slimmer side gutters on phones.
- Mobile signature sheet: drag handle, taller pad (`SignaturePad` `contentClassName`), Sign/Cancel
  pinned to the bottom above the home indicator, bigger "Clear Signature" tap target; the field hint
  says "Tap" on phones.
- "Type" signature tab is labelled "Type Signature"; recipients can't hide completed fields.

### PDF

- When sealing V1 envelopes, date fields signed with no timezone (or UTC) get a ` UTC` suffix
  (`get-date-field-text-for-pdf.ts`).

### Look and feel

- Always light theme, blue primary (`216 70% 59%`), grey page background and overlays
  (`--gray-background-bg-dark`), smaller card radius on mobile.

### Build and deploy

- `npm run build` / `start` only build and run the remix app. `npm run build:prod` sets
  `NEXT_PUBLIC_ASSET_URL` (Vite `base`) to CloudFront and `CDN_S3_BUCKET`, and
  `apps/remix/.bin/build.sh` syncs hashed assets to that bucket.
- No `prebuild` in `@documenso/prisma`; commitlint hook disabled; `certificate.p12` and
  `ecosystem.config.cjs` are git-ignored.

## Upgrade checklist (v1.10 → v2.21)

1. Stop the app and back up the database. The `add_envelopes` migration moves documents into
   `Envelope` and drops the `Document` / `Template` tables; it can't be rolled back.
2. Record `SELECT last_value FROM "Document_id_seq";`, then run
   `packages/prisma/arcsite-upgrade/pre-v2-upgrade.sql`. Upstream's `add_organisations` migration
   only creates organisations for personal teams and teams/users with a `Subscription`; with billing
   off the "ArcSite" team has none and the migration fails on `OrganisationGroup.organisationId`
   ([upstream #1880](https://github.com/documenso/documenso/issues/1880)). The script adds a
   placeholder subscription per such team.
3. `npm run prisma:migrate-deploy`, then
   `psql -v last_document_id=<last_value> -f packages/prisma/arcsite-upgrade/post-v2-upgrade.sql`. It
   removes the placeholders and bumps `Counter` so a hard-deleted newest document's id can't be
   handed out again.
4. Runtime: Node >= 24, npm >= 11.17. Prisma 6 and React 19 come with the upgrade.
5. Env: `NEXT_PUBLIC_WEBAPP_URL` must be the exact public https origin (tRPC now checks `Origin`),
   `NEXT_PUBLIC_UPLOAD_TRANSPORT=s3`, nginx must keep sending `X-Forwarded-For` (rate limits are
   per IP: 1000/min for `/api/v1`, 100/min for `/api/trpc`).
6. Webhooks to private addresses are now blocked. Check `SELECT "webhookUrl" FROM "Webhook";`; if the
   cloudservice host resolves to a private IP from the Documenso box, add it to
   `NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS`. Webhook calls now time out after 10s and don't follow
   redirects.
7. Rehearse on a copy of prod, then run cloudservice's flow end to end: create → upload → fields →
   send → sign (customer and sales, `?lang=fr`, iframe) → redirect → webhook → download.
