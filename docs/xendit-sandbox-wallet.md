# Xendit sandbox demo wallet

This integration exists to demonstrate a mobile payment flow in the Poker Room portfolio app. It is **sandbox-only**:

- Xendit Test Mode API key is required. The Edge Functions reject keys that are not prefixed with `xnd_development_`.
- Wallet credits are virtual, non-transferable, non-redeemable, and have no cash value.
- There are no withdrawals, cash-outs, prizes, peer-to-peer transfers, or real-money game settlements.
- The Hold'em and Chinese Poker game stacks remain separate from this demo-credit balance. This feature demonstrates payment checkout, wallet persistence, webhook verification, and idempotent ledger updates.
- Never place Xendit secret keys or Supabase service-role keys in the React Native app or root mobile `.env`.

## Payment flow

1. The signed-in Supabase user chooses one of the fixed demo packages: PHP 50, 100, 250, or 500.
2. `create-wallet-topup` validates the caller's Supabase JWT, inserts a pending top-up, then creates a Xendit Payment Session using `POST /sessions`.
3. The mobile app opens Xendit's hosted checkout URL.
4. Xendit sends `payment_session.completed` to `xendit-webhook`.
5. The webhook validates `x-callback-token`, retrieves the Payment Session from Xendit, checks session ID, reference, status, session type, PHP currency, PH country, and exact amount.
6. A Postgres function locks the top-up and wallet, credits the wallet, appends a ledger row, and marks the top-up complete in one transaction. Repeated callbacks do not credit twice.
7. The app refreshes wallet state when returning to the foreground or when the user taps Refresh.

The conversion is fixed at **PHP 1 = 100 demo credits**. The client cannot choose a credit conversion or an arbitrary amount.

## 1. Apply the database migration

Start local Supabase and apply migrations:

```sh
bunx supabase start
bunx supabase db reset
```

For a hosted development Supabase project, link the project, inspect the pending migration, then apply it:

```sh
bunx supabase link --project-ref <project-ref>
bunx supabase db push --dry-run --remote
bunx supabase db push --remote
```

Do not run this against production without reviewing the schema and the demo-only constraints first.

## 2. Create Xendit Test Mode credentials

In Xendit Dashboard, switch to **Test Mode**, then open **Settings → Developers → API Keys** and create a **Secret API Key** with the minimum Money-in / payment-session write permission required.

Use the Test Mode key only. Test Mode transactions use virtual funds and do not interact with banking networks. The function rejects non-development key prefixes.

## 3. Configure Supabase Edge Function secrets

For local development, create `supabase/functions/.env` (this file is ignored by Git):

```dotenv
XENDIT_SECRET_KEY=xnd_development_replace_me
XENDIT_WEBHOOK_TOKEN=replace_with_xendit_callback_verification_token
```

Supabase automatically injects `SUPABASE_URL` plus either the legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` values or the newer `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` JSON dictionaries. These functions now support both formats. The secret/service-role key is used only inside Edge Functions. Gateway JWT verification is disabled for the checkout function because it verifies the supplied JWT through Supabase Auth itself; never remove that in-function validation.

Restart local Supabase after changing the local function environment:

```sh
bunx supabase stop
bunx supabase start
```

For hosted development, add `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN` under **Supabase Dashboard → Edge Functions → Secrets**. The `XENDIT_WEBHOOK_TOKEN` value must exactly match the callback verification token shown by Xendit in the webhook settings (the value sent in the `X-CALLBACK-TOKEN` request header). Do not use the Xendit API key as the callback token. You can also upload both values using a protected local env file:

```sh
bunx supabase secrets set --env-file <path-to-private-env-file>
```

Do not commit that private env file.

## 4. Deploy the Edge Functions

Deploy the authenticated checkout endpoint:

```sh
bunx supabase functions deploy create-wallet-topup
```

Deploy the webhook endpoint. The repository sets gateway `verify_jwt = false` for both endpoints. The checkout function validates the Supabase bearer token with Auth `getUser`; the webhook validates Xendit's callback verification token. Keep both application-level checks enabled:

```sh
bunx supabase functions deploy xendit-webhook
```

For local function testing:

```sh
bunx supabase functions serve create-wallet-topup
bunx supabase functions serve xendit-webhook --no-verify-jwt
```

## 5. Configure Xendit webhooks

In Xendit Test Mode Dashboard, open **Settings → Webhooks** and register the Payment Session events:

- **Payment Session – Completed**
- **Payment Session – Expired**

For hosted Supabase, use:

```text
https://<project-ref>.supabase.co/functions/v1/xendit-webhook
```

For local testing, expose the local Supabase API port (54321) through a temporary HTTPS tunnel and use:

```text
https://<temporary-tunnel-host>/functions/v1/xendit-webhook
```

Copy the Xendit callback verification token into `XENDIT_WEBHOOK_TOKEN` in the matching Supabase environment. The webhook checks the `x-callback-token` header. Never disable this check.

## 6. Configure the mobile app

The React Native app still needs only the Supabase URL and publishable key in its existing `.env`:

```dotenv
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_PUBLISHABLE_KEY=replace-with-local-publishable-key
```

Do **not** add `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY` to this file. Rebuild/relaunch the native app after changing `react-native-config` values.

## 7. Test the flow

1. In Xendit's **Test and save** webhook test, the example event may have `session_type: SAVE`. The function now authenticates the callback and replies with HTTP 200 and `ignored: true`; SAVE events are not wallet payments and must never credit wallet credits.
2. Launch the app and wait for anonymous Supabase authentication to finish.
3. Open **Demo Wallet** from the lobby.
4. Select a package; the app opens Xendit hosted checkout.
5. Complete a simulated payment using Xendit's Test Mode instructions.
6. Confirm Xendit sends `payment_session.completed` to the webhook.
7. Return to the app and refresh. The top-up should be `COMPLETED` and the wallet balance should increase exactly once.
8. Replay the same webhook from Xendit Dashboard or call it again with the same event; the balance must not increase again.

If the checkout opens but the wallet remains unchanged, verify the webhook URL, callback token, deployed function secrets, and function logs. The mobile return to the app is not treated as proof of payment; only the verified webhook can credit the wallet.

## Relevant API references

- [Xendit Create a Session](https://docs.xendit.co/apidocs/create-session)
- [Xendit Get the status of a session](https://docs.xendit.co/apidocs/get-session)
- [Xendit Payment Session webhook](https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session)
- [Xendit webhook handling and duplicate delivery](https://docs.xendit.co/v1/docs/handling-webhooks)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Function configuration](https://supabase.com/docs/guides/functions/function-configuration)
