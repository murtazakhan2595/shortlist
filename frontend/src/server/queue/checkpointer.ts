import "server-only";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";
import { getServerEnv } from "@/server/env";

// Where LangGraph saves a graph's state between queued steps (PLAN.md section 3, Agent framework).
// The tables are in the langgraph schema, created by a migration (supabase/migrations/*_writer.sql),
// so setup() is never called here.

const CHECKPOINT_SCHEMA = "langgraph";

// A worker call runs one step, so a couple of connections is plenty; the pooler shares them.
const MAX_CONNECTIONS = 2;

let checkpointer: PostgresSaver | undefined;

export function getCheckpointer(): PostgresSaver {
  if (!checkpointer) {
    const connectionString = getServerEnv().SUPABASE_DB_URL;
    if (!connectionString) throw new Error("SUPABASE_DB_URL is not set, but a step runs a LangGraph graph");

    const pool = new pg.Pool({ connectionString, max: MAX_CONNECTIONS });
    checkpointer = new PostgresSaver(pool, undefined, { schema: CHECKPOINT_SCHEMA });
  }
  return checkpointer;
}
