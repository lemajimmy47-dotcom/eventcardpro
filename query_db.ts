import { config } from "dotenv";
config({ override: true });
import { executeQuery } from "./src/db/cloudsql-core";

async function main() {
  const result = await executeQuery("test", async (client) => {
    return await client.query("SELECT * FROM events_list");
  });
  console.log(result.rows);
}
main().catch(console.error);
