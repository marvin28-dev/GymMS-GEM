// Once per run, before any API test: bring the test database up to the schema
import { createRequire } from 'node:module';

const { prepareTestDatabase } = createRequire(import.meta.url)('../../support/testDb.cjs');

export default function setup() {
  prepareTestDatabase();
}
