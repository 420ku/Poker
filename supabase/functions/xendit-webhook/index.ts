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

Deno.serve(async request => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const callbackToken = request.headers.get("x-callback-token") ?? "";
  const expectedToken = Deno.env.get("XENDIT_WEBHOOK_TOKEN") ?? "";
  const xenditSecretKey = Deno.env.get("XENDIT_SECRET_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!expectedToken || !xenditSecretKey || !supabaseUrl || !serviceRoleKey) {
    console.error("Xendit webhook environment is incomplete.");
    return jsonResponse({ error: "Webhook is not configured." }, 500);
  }
  if (!xenditSecretKey.startsWith("xnd_development_")) {
    return jsonResponse({ error: "Demo webhook accepts Test Mode keys only." }, 503);
  }
  if (!callbackToken || !constantTimeEquals(callbackToken, expectedToken)) {
    return jsonResponse({ error: "Unauthorized webhook." }, 401);
  }

  let payload: {
    event?: string;
    data?: {
      reference_id?: string;
      payment_session_id?: string;
    };
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid webhook JSON." }, 400);
  }

  const event = payload.event;
  const referenceId = payload.data?.reference_id;
  const sessionId = payload.data?.payment_session_id;

  if (!referenceId || !sessionId) {
    return jsonResponse({ error: "Missing session reference." }, 400);
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

  if (event !== "payment_session.completed") {
    return jsonResponse({ received: true, ignored: true });
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
    return jsonResponse({ error: "Unknown top-up reference." }, 404);
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
