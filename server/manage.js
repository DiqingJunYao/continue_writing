import { createPool, migrate, one, rows, writeTransaction } from "./db.js";
import { cleanId } from "./model.js";
import { seed } from "./seed.js";

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (!["migrate", "seed", "set-admin"].includes(command)) {
    throw new Error("Use npm run migrate, npm run seed, or npm run set-admin -- USER_ID.");
  }
  const pool = createPool();
  try {
    if (command === "migrate") {
      await migrate(pool);
      console.log("Branchline schema is ready.");
    } else if (command === "seed") {
      await seed(pool);
      console.log("Branchline example stories are ready.");
    } else {
      const uid = cleanId(argument, "User ID");
      await writeTransaction(pool, async (db) => {
        if (!await one(db, "SELECT 1 AS linked FROM oauthAccounts WHERE userId = ? LIMIT 1", [uid])) {
          throw new Error("Choose a user who has already signed in with Google or Facebook.");
        }
        await rows(db, "UPDATE app_state SET adminId = ? WHERE id = 1", [uid]);
      });
      console.log(`Branchline administrator set to ${uid}.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Branchline setup failed: ${error.code || error.message}`);
  process.exitCode = 1;
});
