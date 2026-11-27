const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run user-owned database work with a transaction-local RLS identity.
 * The Neon HTTP driver executes the query batch in one PostgreSQL transaction.
 */
export async function withUserTransaction(sql,userId,queries){
  const id=String(userId||'');
  if(!UUID.test(id))throw Object.assign(new Error('invalid_user_scope'),{status:500});
  if(!sql||typeof sql.transaction!=='function')throw Object.assign(new Error('database_transactions_unavailable'),{status:503});
  if(!Array.isArray(queries)||queries.length===0)throw Object.assign(new Error('database_queries_required'),{status:500});
  const results=await sql.transaction([
    sql`SELECT set_config('app.user_id', ${id}, true)`,
    ...queries
  ]);
  if(!Array.isArray(results)||results.length!==queries.length+1)
    throw Object.assign(new Error('invalid_database_transaction_result'),{status:500});
  return results.slice(1);
}
