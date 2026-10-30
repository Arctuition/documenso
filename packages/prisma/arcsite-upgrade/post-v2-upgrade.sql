-- ArcSite: run on the v2 database right after `prisma migrate deploy`.
-- Usage: psql -v last_document_id=<Document_id_seq.last_value recorded before migrating> -f post-v2-upgrade.sql
BEGIN;

-- Drop the placeholder subscriptions added by pre-v2-upgrade.sql.
DELETE FROM "Subscription" WHERE "planId" LIKE 'arcsite_no_billing_team_%';

UPDATE "Organisation"
SET "customerId" = NULL
WHERE "customerId" LIKE 'arcsite_no_billing_team_%';

-- A hard-deleted newest document must not get its id handed out again.
UPDATE "Counter"
SET "value" = GREATEST("value", :last_document_id)
WHERE "id" = 'document';

SELECT o."id", o."type", o."name", o."customerId",
  (SELECT count(*) FROM "Team" t WHERE t."organisationId" = o."id") AS teams,
  (SELECT count(*) FROM "OrganisationMember" m WHERE m."organisationId" = o."id") AS members
FROM "Organisation" o
ORDER BY o."createdAt";

SELECT "id", "value" FROM "Counter" ORDER BY "id";

COMMIT;
