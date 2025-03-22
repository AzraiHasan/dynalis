-- Create a secure function to execute DDL
create or replace function execute_ddl(sql_statement text)
returns void
language plpgsql
security definer
as $$
begin
  execute sql_statement;
end;
$$;

-- Grant execute permission to service role only
revoke all on function execute_ddl(text) from public;
grant execute on function execute_ddl(text) to service_role;