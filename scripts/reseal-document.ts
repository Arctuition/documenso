/**
 * Usage:
 *   npm run with:env -- npx tsx scripts/reseal-document.ts <documentId>
 */
import { sealDocument } from '../packages/lib/server-only/document/seal-document';

const documentId = Number(process.argv[2]);

if (!documentId || isNaN(documentId)) {
  console.error('Usage: reseal-document.ts <documentId>');
  process.exit(1);
}

const main = async () => {
  console.log(`Resealing document ${documentId}...`);
  await sealDocument({ documentId, isResealing: true, sendEmail: true });
  console.log(`Document ${documentId} sealed and webhooks triggered successfully.`);
};

main().catch((err) => {
  console.error('Failed to seal document:', err);
  process.exit(1);
});
