/**
 * migrate.js — LEGACY MySQL migration script (no longer needed)
 *
 * The project now uses MongoDB via Mongoose. Mongoose handles schema
 * changes automatically through model definitions — no manual migrations
 * are required for adding new fields.
 *
 * If you need to backfill data in existing documents, write a one-off
 * script that connects via Mongoose and uses updateMany() instead.
 */
console.log('This project uses MongoDB. No SQL migrations are needed.');
console.log('Schema changes are handled automatically by Mongoose models.');
process.exit(0);
