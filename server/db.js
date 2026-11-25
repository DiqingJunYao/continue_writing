import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

export function createPool(env = process.env) {
  let url;
  try {
    url = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("Set DATABASE_URL to a valid mysql:// connection URL.");
  }
  if (url.protocol !== "mysql:" || !url.hostname || !url.username || url.pathname.length < 2 || url.search || url.hash) {
    throw new Error("DATABASE_URL must specify a MySQL host, user, and database.");
  }
  return mysql.createPool({
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ...(env.DATABASE_TLS === "true" ? { ssl: { rejectUnauthorized: true, verifyIdentity: true } } : {}),
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
    connectionLimit: 10,
    queueLimit: 100,
  });
}

export async function rows(db, sql, params = []) {
  const [result] = await db.execute(sql, params);
  return result;
}

export async function one(db, sql, params = []) {
  return (await rows(db, sql, params))[0] ?? null;
}

export function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value.replace(" ", "T") + "Z").toISOString();
}

export function clientDates(row) {
  const result = { ...row };
  for (const key of ["createdAt", "updatedAt", "readAt"]) {
    if (key in result) result[key] = isoDate(result[key]);
  }
  return result;
}

async function transaction(pool, work, write) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET SESSION time_zone = '+00:00'");
    if (write) {
      await connection.beginTransaction();
      await one(connection, "SELECT id FROM app_state WHERE id = 1 FOR UPDATE");
    } else {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    }
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Serialize application writes so authorization, counters and account erasure
// agree across simultaneous requests, including multiple server processes.
export function writeTransaction(pool, work) {
  return transaction(pool, work, true);
}

export function readTransaction(pool, work) {
  return transaction(pool, work, false);
}

export async function migrate(pool) {
  const connection = await pool.getConnection();
  try {
    const { name } = await one(connection, "SELECT DATABASE() AS name");
    const lock = createHash("sha256").update(`branchline:${name}`).digest("hex");
    const { acquired } = await one(connection, "SELECT GET_LOCK(?, 15) AS acquired", [lock]);
    if (acquired !== 1) throw new Error("Could not acquire the Branchline schema lock.");
    try {
      const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
      for (const statement of schema.split(";").map((sql) => sql.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
    } finally {
      await one(connection, "SELECT RELEASE_LOCK(?)", [lock]);
    }
  } finally {
    connection.release();
  }
}
