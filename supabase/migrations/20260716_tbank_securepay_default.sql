alter table if exists public.payment_provider_settings
  alter column api_url set default 'https://securepay.tinkoff.ru/v2/Init';

update public.payment_provider_settings
set api_url = 'https://securepay.tinkoff.ru/v2/Init',
    updated_at = now()
where provider = 'tbank'
  and api_url in (
    'https://rest-api-test.tinkoff.ru/v2/Init',
    'https://rest-api-test.tbank.ru/v2/Init'
  );

notify pgrst, 'reload schema';
