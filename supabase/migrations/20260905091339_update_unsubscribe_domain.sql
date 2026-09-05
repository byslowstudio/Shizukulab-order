-- Keep every customer-facing unsubscribe link on the consolidated Slow Studio deployment.
-- The functions already exist in production; replacing only the old origin preserves their logic.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'send_shizuku_order_email',
        'send_marketing_campaign_email',
        'send_customer_order_confirmation'
      )
      and position('slow-studio-demo.vercel.app' in pg_get_functiondef(p.oid)) > 0
  loop
    execute replace(
      function_row.definition,
      'https://slow-studio-demo.vercel.app/unsubscribe?token=',
      'https://byslowstudio.vercel.app/unsubscribe?token='
    );
  end loop;
end
$migration$;
