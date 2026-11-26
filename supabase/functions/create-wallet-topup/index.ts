import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const PACKAGES: Record<number, number> = {
  50: 5_000,
  100: 10_000,
  250: 25_000,
  500: 50_000,
};

function getNamedKey(environmentVariable: string): string | null {
  const raw = Deno.env.get(environmentVariable);
  if (!raw) return null;

  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = keys.default;
    return typeof defaultKey === "string" && defaultKey.length > 0
      ? defaultKey
      : null;
  } catch {
    return null;
  }
}

function getSupabasePublishableKey(): string | null {
  return (
    Deno.env.get("SUPABASE_ANON_KEY") ??
    getNamedKey("SUPABASE_PUBLISHABLE_KEYS")
  );
}

function getSupabaseSecretKey(): string | null {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    getNamedKey("SUPABASE_SECRET_KEYS")
  );
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken || accessToken === authorization) {
    return jsonResponse({ error: "Authentication required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = getSupabasePublishableKey();
  const serviceRoleKey = getSupabaseSecretKey();
  const xenditSecretKey = Deno.env.get("XENDIT_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !xenditSecretKey) {
    const missingConfiguration = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !anonKey ? "SUPABASE_PUBLISHABLE_KEYS (or SUPABASE_ANON_KEY)" : null,
      !serviceRoleKey ? "SUPABASE_SECRET_KEYS (or SUPABASE_SERVICE_ROLE_KEY)" : null,
      !xenditSecretKey ? "XENDIT_SECRET_KEY" : null,
    ].filter((value): value is string => Boolean(value));
    console.error("Wallet checkout missing environment variables:", missingConfiguration.join(", "));
    return jsonResponse({
      error: "Wallet payment service is not configured.",
      missingConfiguration,
    }, 503);
  }

  // This portfolio integration deliberately refuses live credentials.
  if (!xenditSecretKey.startsWith("xnd_development_")) {
    return jsonResponse({ error: "Demo wallet accepts Xendit Test Mode keys only." }, 503);
  }

  let body: { amountPhp?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const amountPhp = Number(body.amountPhp);
  const credits = PACKAGES[amountPhp];
  if (!Number.isInteger(amountPhp) || !credits) {
    return jsonResponse({ error: "Choose a supported demo package." }, 400);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid or expired Supabase session." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = userData.user.id;
  const referenceId = `poker_demo_${crypto.randomUUID().replaceAll("-", "")}`;

  const { error: walletError } = await admin
    .from("wallets")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (walletError) {
    console.error("Could not ensure wallet:", walletError.message);
    return jsonResponse({ error: "Unable to prepare demo wallet." }, 500);
  }

  const { data: topup, error: topupError } = await admin
    .from("wallet_topups")
    .insert({
      user_id: userId,
      reference_id: referenceId,
      amount_php: amountPhp,
      credits,
      status: "pending",
    })
    .select("id")
    .single();

  if (topupError || !topup) {
    console.error("Could not create top-up:", topupError?.message);
    return jsonResponse({ error: "Unable to create wallet top-up." }, 500);
  }

  let xenditResponse: Response;
  let session: Record<string, unknown>;

  try {
    xenditResponse = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${xenditSecretKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference_id: referenceId,
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        capture_method: "AUTOMATIC",
        amount: amountPhp,
        currency: "PHP",
        country: "PH",
        locale: "en",
        allow_save_payment_method: "DISABLED",
        description: "Poker Room portfolio demo credits",
        metadata: {
          wallet_topup_id: topup.id,
          app: "poker-room-portfolio-demo",
        },
      }),
    });

    session = await xenditResponse.json().catch(() => ({})) as Record<string, unknown>;
  } catch (requestError) {
    const reason = requestError instanceof Error ? requestError.message : "Unknown network error";
    console.error("Xendit API request failed:", reason);

    const { error: updateError } = await admin
      .from("wallet_topups")
      .update({ status: "failed" })
      .eq("id", topup.id);

    if (updateError) console.error("Could not mark failed top-up:", updateError.message);

    return jsonResponse({
      error: "Could not reach Xendit. Check Edge Function outbound network access and try again.",
    }, 502);
  }

  const paymentSessionId = session.payment_session_id;
  const checkoutUrl = session.payment_link_url;

  if (
    !xenditResponse.ok ||
    typeof paymentSessionId !== "string" ||
    typeof checkoutUrl !== "string"
  ) {
    const providerCode =
      typeof session.error_code === "string" ? session.error_code : "INVALID_XENDIT_RESPONSE";
    const providerMessage =
      typeof session.message === "string"
        ? session.message
        : "Xendit did not return a payment_session_id and payment_link_url.";

    const { error: updateError } = await admin
      .from("wallet_topups")
      .update({ status: "failed" })
      .eq("id", topup.id);

    if (updateError) console.error("Could not mark failed top-up:", updateError.message);

    console.error("Xendit session creation failed:", {
      status: xenditResponse.status,
      code: providerCode,
      message: providerMessage,
    });

    return jsonResponse({
      error: "Xendit could not create checkout.",
      provider: {
        status: xenditResponse.status,
        code: providerCode,
        message: providerMessage,
      },
    }, 502);
  }

  const { error: updateError } = await admin
    .from("wallet_topups")
    .update({
      xendit_session_id: paymentSessionId,
      checkout_url: checkoutUrl,
    })
    .eq("id", topup.id);

  if (updateError) {
    console.error("Could not persist Xendit session:", updateError.message);
    return jsonResponse({ error: "Checkout was created but could not be saved. Contact the app administrator." }, 500);
  }

  return jsonResponse({
    topupId: topup.id,
    checkoutUrl,
    amountPhp,
    credits,
  });
});
