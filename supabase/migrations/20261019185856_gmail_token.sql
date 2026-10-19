-- The owner's Gmail refresh token, kept in Supabase Vault (PLAN.md item 2.3, AGENTS.md rule 9).
--
-- The Vault schema is not exposed through the API, so server code reaches it through these two functions.
-- Only the service role (server code with the secret key) may call them: the browser never sees the token.
-- The token allows only gmail.compose; server/gmail/gmail.ts refuses one with any other permission.

create function public.save_gmail_token(token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select id into existing from vault.secrets where name = 'gmail_refresh_token';
  if existing is null then
    perform vault.create_secret(token, 'gmail_refresh_token', 'Gmail refresh token, gmail.compose only');
  else
    perform vault.update_secret(existing, token);
  end if;
end;
$$;

-- Null until the owner connects Gmail.
create function public.gmail_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gmail_refresh_token';
$$;

-- New functions in public are callable by everyone by default.
revoke execute on function public.save_gmail_token(text), public.gmail_token() from public, anon, authenticated;
grant execute on function public.save_gmail_token(text), public.gmail_token() to service_role;
