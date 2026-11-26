import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const PACKAGES: Record<number, number> = {
  50: 5_000,
  100: 10_000,
  250: 25_000,
  500: 50_000,
};

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const xenditSecretKey = Deno.env.get("XENDIT_SECRET_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !xenditSecretKey) {
    return jsonResponse({ error: "Wallet payment service is not configured." }, 500);
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

  const xenditResponse = await fetch("https://api.xendit.co/sessions", {
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
      customer: {
        reference_id: `pkr${crypto.randomUUID().replaceAll("-", "")}`,
        type: "INDIVIDUAL",
        individual_detail: {
          given_names: "PokerRoomDemoPlayer",
        },
      },
      description: "Poker Room portfolio demo credits",
      metadata: {
        wallet_topup_id: topup.id,
        app: "poker-room-portfolio-demo",
      },
    }),
  });

  const session = await xenditResponse.json().catch(() => ({}));
  if (!xenditResponse.ok || !session.payment_session_id || !session.payment_link_url) {
    await admin
      .from("wallet_topups")
      .update({ status: "failed" })
      .eq("id", topup.id);
    console.error("Xendit session creation failed:", JSON.stringify(session));
    return jsonResponse({ error: "Xendit could not create checkout. Check Test Mode API permissions." }, 502);
  }

  const { error: updateError } = await admin
    .from("wallet_topups")
    .update({
      xendit_session_id: session.payment_session_id,
      checkout_url: session.payment_link_url,
    })
    .eq("id", topup.id);

  if (updateError) {
    console.error("Could not persist Xendit session:", updateError.message);
    return jsonResponse({ error: "Checkout was created but could not be saved. Contact the app administrator." }, 500);
  }

  return jsonResponse({
    topupId: topup.id,
    checkoutUrl: session.payment_link_url,
    amountPhp,
    credits,
  });
});
