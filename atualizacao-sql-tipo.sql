-- Rode UMA vez no SQL Editor do Supabase se você já tinha aplicado o SQL anterior.
-- Habilita corrigir o tipo (receita/despesa/transferência) de um lançamento na tela.
create or replace function public.fa_tx_update_kind(p_token text, p_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
declare u public.fa_users;
begin
  u := public.fa_auth(p_token, 'write');
  if p_kind not in ('income', 'expense', 'transfer') then raise exception 'TIPO_INVALIDO'; end if;
  update public.fa_transactions set kind = p_kind where id = p_id;
end $$;

revoke all on function public.fa_tx_update_kind(text, uuid, text) from public, anon, authenticated;
grant execute on function public.fa_tx_update_kind(text, uuid, text) to anon, authenticated;
