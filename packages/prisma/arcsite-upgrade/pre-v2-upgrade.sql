-- ArcSite: run on the v1.10 database right before `prisma migrate deploy` to v2.
--
-- Upstream's 20250522054050_add_organisations migration only creates an organisation for personal
-- teams and for teams/users with a Subscription. With billing disabled our "ArcSite" team has no
-- Subscription, so it never gets an organisation and the migration fails with
-- `null value in column "organisationId" of relation "OrganisationGroup"`
-- (https://github.com/documenso/documenso/issues/1880).
--
-- Give every team without a subscription a placeholder ACTIVE subscription so the migration puts it
-- in its own organisation. post-v2-upgrade.sql removes the placeholders afterwards.
BEGIN;

UPDATE "Team" t
SET "customerId" = 'arcsite_no_billing_team_' || t."id"
WHERE t."customerId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."teamId" = t."id");

INSERT INTO "Subscription" ("status", "planId", "priceId", "teamId", "updatedAt")
SELECT 'ACTIVE', 'arcsite_no_billing_team_' || t."id", 'arcsite_no_billing', t."id", NOW()
FROM "Team" t
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."teamId" = t."id");

SELECT t."id", t."name", t."customerId", s."planId"
FROM "Team" t
JOIN "Subscription" s ON s."teamId" = t."id"
ORDER BY t."id";

COMMIT;
