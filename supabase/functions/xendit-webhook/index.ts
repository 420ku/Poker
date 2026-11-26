import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEquals(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

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

function getSupabaseSecretKey(): string | null {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    getNamedKey("SUPABASE_SECRET_KEYS")
  );
}

Deno.serve(async request => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  // Authenticate Xendit before trusting the JSON body. Do not require database
  // or Xendit API credentials merely to acknowledge dashboard test events.
  const callbackToken = request.headers.get("x-callback-token") ?? "";
  const expectedToken = Deno.env.get("XENDIT_WEBHOOK_TOKEN") ?? "";

  if (!expectedToken) {
    console.error("Missing XENDIT_WEBHOOK_TOKEN Edge Function secret.");
    return jsonResponse({
      error: "Webhook is not configured. Set XENDIT_WEBHOOK_TOKEN in Supabase Edge Function Secrets.",
    }, 503);
  }

  if (!callbackToken || !constantTimeEquals(callbackToken, expectedToken)) {
    return jsonResponse({ error: "Unauthorized webhook." }, 401);
  }

  let payload: {
    event?: string;
    data?: {
      id?: string;
      reference_id?: string;
      payment_session_id?: string;
      session_type?: string;
    };
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid webhook JSON." }, 400);
  }

  const event = payload.event;
  const sessionData = payload.data;

  if (
    event !== "payment_session.completed" &&
    event !== "payment_session.expired"
  ) {
    return jsonResponse({ received: true, ignored: true });
  }

  // Xendit's Dashboard "Test and save" example sends SAVE sessions. They only
  // test webhook delivery; only PAY sessions created by this wallet can credit.
  if (sessionData?.session_type !== "PAY") {
    return jsonResponse({
      received: true,
      ignored: true,
      reason: "Only PAY sessions are used by the demo wallet.",
    });
  }

  const referenceId = sessionData.reference_id;
  // Current Xendit docs use payment_session_id. Accept data.id as compatibility
  // for older/alternate dashboard test payload shapes.
  const sessionId = sessionData.payment_session_id ?? sessionData.id;

  if (!referenceId || !sessionId) {
    return jsonResponse({ error: "Missing payment session reference." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getSupabaseSecretKey();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase URL or secret API key is missing in Edge Function environment.");
    return jsonResponse({
      error: "Wallet database is not configured. Check Supabase URL and Secret API Key availability in Edge Functions.",
    }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event === "payment_session.expired") {
    const { error } = await admin
      .from("wallet_topups")
      .update({ status: "expired" })
      .eq("reference_id", referenceId)
      .eq("xendit_session_id", sessionId)
      .eq("status", "pending");

    if (error) {
      console.error("Could not expire top-up:", error.message);
      return jsonResponse({ error: "Could not update top-up." }, 500);
    }

    return jsonResponse({ received: true });
  }

  const xenditSecretKey = Deno.env.get("XENDIT_SECRET_KEY") ?? "";
  if (!xenditSecretKey) {
    console.error("Missing XENDIT_SECRET_KEY Edge Function secret.");
    return jsonResponse({
      error: "Payment verification is not configured. Set XENDIT_SECRET_KEY in Supabase Edge Function Secrets.",
    }, 503);
  }

  if (!xenditSecretKey.startsWith("xnd_development_")) {
    return jsonResponse({ error: "Demo webhook accepts Xendit Test Mode keys only." }, 503);
  }

  const { data: topup, error: topupError } = await admin
    .from("wallet_topups")
    .select("id, amount_php, credits, status, reference_id, xendit_session_id")
    .eq("reference_id", referenceId)
    .eq("xendit_session_id", sessionId)
    .maybeSingle();

  if (topupError) {
    console.error("Could not load top-up:", topupError.message);
    return jsonResponse({ error: "Unable to load top-up." }, 500);
  }

  if (!topup) {
    // Xendit may retry unrelated or old test events. They must never create
    // wallet entries, and acknowledging them prevents pointless retries.
    return jsonResponse({ received: true, ignored: true });
  }

  if (topup.status === "completed") {
    return jsonResponse({ received: true, alreadyCredited: true });
  }

  // Do not trust callback amount/status alone. Re-fetch the session from Xendit.
  const sessionResponse = await fetch(
    `https://api.xendit.co/sessions/${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${xenditSecretKey}:`)}`,
      },
    },
  );

  const session = await sessionResponse.json().catch(() => ({}));

  if (!sessionResponse.ok) {
    console.error("Could not verify Xendit session:", sessionResponse.status);
    return jsonResponse({ error: "Unable to verify Xendit session." }, 502);
  }

  if (
    session.payment_session_id !== sessionId ||
    session.reference_id !== referenceId ||
    session.status !== "COMPLETED" ||
    session.session_type !== "PAY" ||
    session.mode !== "PAYMENT_LINK" ||
    session.currency !== "PHP" ||
    session.country !== "PH" ||
    Number(session.amount) !== Number(topup.amount_php) ||
    !session.payment_id
  ) {
    console.error("Xendit session does not match pending top-up:", referenceId);
    return jsonResponse({ error: "Payment does not match top-up." }, 409);
  }

  const { error: creditError } = await admin.rpc("complete_wallet_topup", {
    p_topup_id: topup.id,
    p_payment_id: session.payment_id,
  });

  if (creditError) {
    console.error("Could not credit wallet:", creditError.message);
    return jsonResponse({ error: "Could not credit wallet." }, 500);
  }

  return jsonResponse({ received: true, credited: true });
});
