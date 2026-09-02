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

let paddlePromise = null;

export function getPaddleProductId(titleName) {
  return PADDLE_PRODUCTS[titleName] || null;
}

export function initializePaddle(eventCallback) {
  if (paddlePromise) {
    // Already initialized (e.g. from a prior modal open, or React
    // StrictMode's double-invoke in dev) — Paddle.Initialize() can only
    // run once, so make sure this call's callback still gets wired up
    // via Update, otherwise checkout.completed would go nowhere.
    if (eventCallback && window.Paddle?.Update) {
      window.Paddle.Update({ eventCallback });
    }
    return paddlePromise;
  }

  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

  if (!token) {
    return Promise.reject(
      new Error(
        "Missing VITE_PADDLE_CLIENT_TOKEN. Add your Paddle Sandbox client-side token to .env."
      )
    );
  }

  if (!token.startsWith("test_")) {
    return Promise.reject(
      new Error("This frontend is configured for Paddle Sandbox. Your client-side token must start with test_.")
    );
  }

  if (!window.Paddle) {
    return Promise.reject(
      new Error("Paddle.js has not loaded. Check the Paddle script in index.html.")
    );
  }

  try {
    window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({
      token,
      eventCallback,
    });
    paddlePromise = Promise.resolve(window.Paddle);
    return paddlePromise;
  } catch (error) {
    paddlePromise = null;
    return Promise.reject(error);
  }
}

export async function setPaddleEventCallback(eventCallback) {
  const paddle = await initializePaddle();
  if (typeof paddle.Update === "function") {
    paddle.Update({ eventCallback });
  }
  return paddle;
}

// Used after the backend creates a dynamic transaction for the bid.
export async function openPaddleTransactionCheckout(transactionId) {
  if (!transactionId) {
    throw new Error("A Paddle transaction ID is required to open checkout.");
  }

  const paddle = await initializePaddle();

  paddle.Checkout.open({
    transactionId,
  });
}