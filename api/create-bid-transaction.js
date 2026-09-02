import { createClient } from "@supabase/supabase-js";

const PADDLE_PRODUCTS = {
  "CEO OF SEX": "pro_01m1chf6e5srhab6xsbvc3ckfk",
  "SUPREME LEADER OF WADIYA": "pro_01m1chmspdtv642x0az8eyxmr3",
  "DIH LORD": "pro_01m1chqbk99wadpc7r5m1hyx7t",
  "BONNIE BLUE'S FAVOURITE": "pro_01m1chs88eskaa9m30r83d6avw",
  "CHARLIE KIRK'S REINCARNATION": "pro_01m1chtw5bxv5qj0fc29zjhpmb",
  "THE PROPHET OF GOONERS": "pro_01m1chxdbzeawn6g5mzy54y7nh",
  "CEO OF THE CHADS": "pro_01m1chyyqrth71afrqr7cstzbh",
  "MAN WITH GOLDEN BALLS": "pro_01m1cj0gtfczj1s7a248ahrt46",
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PADDLE_API_KEY = process.env.PADDLE_API_KEY;

function json(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      error: "Method not allowed",
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PADDLE_API_KEY) {
    console.error("Missing server environment variables.");
    return json(res, 500, {
      error: "Server payment configuration is incomplete.",
    });
  }

  try {
    // --------------------------------------------------
    // 1. Authenticate the user
    // --------------------------------------------------

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return json(res, 401, {
        error: "Authentication required.",
      });
    }

    const accessToken = authHeader.substring(7);

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.error("Supabase authentication error:", userError);

      return json(res, 401, {
        error: "Invalid or expired session.",
      });
    }

    // --------------------------------------------------
    // 2. Validate title ID
    // --------------------------------------------------

    const { titleId } = req.body || {};
    const numericTitleId = Number(titleId);

    if (!Number.isInteger(numericTitleId)) {
      return json(res, 400, {
        error: "Invalid title ID.",
      });
    }

    // --------------------------------------------------
    // 3. Get authoritative title data from Supabase
    // --------------------------------------------------

    const {
      data: title,
      error: titleError,
    } = await supabase
      .from("titles")
      .select("id, title, price, holder_user_id")
      .eq("id", numericTitleId)
      .single();

    if (titleError || !title) {
      console.error("Title lookup error:", titleError);

      return json(res, 404, {
        error: "Title not found.",
      });
    }

    // --------------------------------------------------
    // 4. Make sure this title has a Paddle product
    // --------------------------------------------------

    const productId = PADDLE_PRODUCTS[title.title];

    if (!productId) {
      return json(res, 400, {
        error: `No Paddle product is mapped to "${title.title}".`,
      });
    }

    // --------------------------------------------------
    // 5. Calculate the bid
    // --------------------------------------------------

    const currentPrice = Number(title.price);

    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      return json(res, 400, {
        error: "The title has an invalid current price.",
      });
    }

    const nextBid = currentPrice + 5;
    const amountInCents = Math.round(nextBid * 100);

    // --------------------------------------------------
    // 6. Create Paddle transaction
    // --------------------------------------------------

    const paddleResponse = await fetch(
      "https://sandbox-api.paddle.com/transactions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          items: [
            {
              quantity: 1,

              price: {
                product_id: productId,

                description: `Bid for ${title.title}`,

                name: title.title,

                unit_price: {
                  amount: String(amountInCents),
                  currency_code: "USD",
                },

                tax_mode: "account_setting",
              },
            },
          ],

          currency_code: "USD",

          custom_data: {
            app_user_id: user.id,
            title_id: numericTitleId,
            title_name: title.title,
            bid_amount: nextBid,
          },
        }),
      }
    );

    const paddleBody = await paddleResponse.json();

    // --------------------------------------------------
    // 7. Handle Paddle errors
    // --------------------------------------------------

    if (!paddleResponse.ok) {
      console.error(
        "Paddle transaction creation failed:",
        JSON.stringify(paddleBody, null, 2)
      );

      return json(res, 502, {
        error:
          paddleBody?.error?.detail ||
          paddleBody?.error?.message ||
          "Paddle could not create the transaction.",
      });
    }

    // --------------------------------------------------
    // 8. Return transaction ID to frontend
    // --------------------------------------------------

    return json(res, 200, {
      transactionId: paddleBody.data.id,
      amount: nextBid,
      titleId: numericTitleId,
    });
  } catch (error) {
    console.error(
      "create-bid-transaction error:",
      error
    );

    return json(res, 500, {
      error: "Unable to prepare the payment.",
    });
  }
}