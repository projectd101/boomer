import { createClient } from "@supabase/supabase-js";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// --------------------------------------------------------------------
// This is the ONLY place a title's holder/price/bids row may change.
// Paddle calls this server-to-server after it has actually captured
// payment. The signature check below proves the request really came
// from Paddle and wasn't forged or replayed by a client. Never trust
// a client-side "checkout.completed" event for anything that grants
// value -- see OutbidModal.jsx, which now only waits for this webhook
// to land instead of writing the DB itself.
// --------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

// Vercel-specific: disable the default body parser so we get the RAW
// request body. Signature verification breaks if the body is parsed
// and re-serialized first -- whitespace/key-order changes invalidate
// the HMAC even though the JSON "looks" identical.
export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !PADDLE_API_KEY ||
    !PADDLE_WEBHOOK_SECRET
  ) {
    console.error("Missing server environment variables for Paddle webhook.");
    return res.status(500).json({ error: "Server misconfigured." });
  }

  const signature = req.headers["paddle-signature"];
  const rawBody = await readRawBody(req);

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: Environment.sandbox, // flip to Environment.production for live
  });

  let event;
  try {
    // unmarshal() verifies the Paddle-Signature HMAC AND parses the
    // event in one call. Throws if the signature doesn't match --
    // that's what stops a forged request from reaching the code below.
    event = paddle.webhooks.unmarshal(rawBody, PADDLE_WEBHOOK_SECRET, signature);
  } catch (err) {
    console.error("Paddle webhook signature verification failed:", err);
    return res.status(401).json({ error: "Invalid signature." });
  }

  // We only act on successful payment capture. Every other event type
  // is acknowledged (200) so Paddle doesn't keep retrying it, but
  // ignored.
  if (event.eventType !== "transaction.completed") {
    return res.status(200).json({ received: true, ignored: event.eventType });
  }

  const transaction = event.data;
  const customData = transaction?.customData || {};

  const titleId = Number(customData.title_id);
  const userId = customData.app_user_id;
  const bidAmount = Number(customData.bid_amount);

  if (
    !Number.isInteger(titleId) ||
    !userId ||
    !Number.isFinite(bidAmount) ||
    bidAmount <= 0
  ) {
    console.error("Paddle webhook: malformed custom_data on transaction", {
      transactionId: transaction?.id,
      customData,
    });
    // Acknowledge so Paddle stops retrying a payload that will never
    // become valid, but don't touch the database.
    return res.status(200).json({ received: true, error: "Malformed custom_data." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency: Paddle may deliver the same event more than once
  // (retries, duplicate delivery). Record the transaction id up front
  // and bail out if we've already processed it, so a title can't be
  // double-charged into a higher price or double-inserted into bids.
  const { data: existing, error: existingError } = await supabase
    .from("processed_paddle_transactions")
    .select("transaction_id")
    .eq("transaction_id", transaction.id)
    .maybeSingle();

  if (existingError) {
    console.error("Idempotency check failed:", existingError);
    return res.status(500).json({ error: "Idempotency check failed." });
  }

  if (existing) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Re-read the authoritative current price and re-validate the bid
  // server-side -- the price could have moved between checkout
  // creation and payment completion if someone else won it first.
  const { data: title, error: titleError } = await supabase
    .from("titles")
    .select("id, title, price")
    .eq("id", titleId)
    .single();

  if (titleError || !title) {
    console.error("Paddle webhook: title lookup failed", titleError);
    return res.status(200).json({ received: true, error: "Title not found." });
  }

  if (bidAmount <= title.price) {
    // Someone else already outbid this title while this payment was
    // in flight. We still record the transaction as processed (so it
    // doesn't retry), but we do NOT grant the title. In production
    // you very likely want to issue a refund here via the Paddle API.
    console.warn(
      `Paddle webhook: bid ${bidAmount} no longer beats current price ${title.price} for title ${titleId}. Refund needed.`
    );

    await supabase.from("processed_paddle_transactions").insert({
      transaction_id: transaction.id,
      title_id: titleId,
      user_id: userId,
      amount: bidAmount,
      outcome: "stale_price_needs_refund",
    });

    return res.status(200).json({ received: true, outcome: "stale_price" });
  }

  // Pull the bidder's profile for the public display fields.
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("display_name, country, address, favourite_quote")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("Paddle webhook: profile lookup failed", profileError);
    return res.status(200).json({ received: true, error: "Profile not found." });
  }

  const { error: updateError } = await supabase
    .from("titles")
    .update({
      holder: profile.display_name,
      price: bidAmount,
      holder_country: profile.country,
      holder_address: profile.address,
      holder_quote: profile.favourite_quote,
      holder_user_id: userId,
      reign_started_at: new Date().toISOString(),
      aura: 0,
    })
    .eq("id", titleId)
    .eq("price", title.price); // optimistic concurrency: only apply if price hasn't moved since we read it

  if (updateError) {
    console.error("Paddle webhook: title update failed", updateError);
    return res.status(500).json({ error: "Could not update title." });
  }

  const { error: bidError } = await supabase.from("bids").insert({
    title_id: titleId,
    user_id: userId,
    bidder: profile.display_name,
    amount: bidAmount,
    country: profile.country,
    address: profile.address,
    favourite_quote: profile.favourite_quote,
  });

  if (bidError) {
    console.error("Paddle webhook: bid insert failed", bidError);
    // Title already updated at this point -- log loudly for manual
    // reconciliation rather than failing the whole webhook (Paddle
    // would just retry and we'd hit the idempotency guard above).
  }

  await supabase.from("processed_paddle_transactions").insert({
    transaction_id: transaction.id,
    title_id: titleId,
    user_id: userId,
    amount: bidAmount,
    outcome: "applied",
  });

  return res.status(200).json({ received: true, outcome: "applied" });
}
