import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';
async function run() {
  console.time("fetchFullStateFromDB");
  await fetchFullStateFromDB();
  console.timeEnd("fetchFullStateFromDB");
}
run();
