import { useEffect, useRef, useState } from "react";
import {
  initializePaddle,
  openPaddleTransactionCheckout,
} from "./paddle";
import {
  supabase,
  signInWithGoogle,
  getUserProfile,
  isProfileComplete,
  upsertUserProfile,
  uploadTitleImage,
} from "./supabaseClient";

// Steps: "signin" -> "profile" -> "checkout" -> "upload" -> "done"
export default function OutbidModal({ selectedTitle, onClose, onComplete }) {
  const [step, setStep] = useState("loading");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Profile form fields
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [quote, setQuote] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Upload state
  const [rawFile, setRawFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [skipBackgroundRemoval, setSkipBackgroundRemoval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const transactionIdRef = useRef(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const nextBid = selectedTitle.price + 5;

  // On mount: check current session. If already signed in with a complete
  // profile, skip straight to checkout.
  useEffect(() => {
    let active = true;

    async function init() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!currentUser) {
        setStep("signin");
        return;
      }

      setUser(currentUser);
      const existingProfile = await getUserProfile(currentUser.id);
      if (!active) return;

      setProfile(existingProfile);

      if (isProfileComplete(existingProfile)) {
        setDisplayName(existingProfile.display_name);
        setCountry(existingProfile.country);
        setAddress(existingProfile.address);
        setQuote(existingProfile.favourite_quote);
        setStep("checkout");
      } else {
        setDisplayName(existingProfile?.display_name || "");
        setStep("profile");
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      // Page will redirect to Google and back; nothing else to do here.
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || !country.trim() || !address.trim() || !quote.trim()) {
      setError("Please fill in every field.");
      return;
    }

    setSavingProfile(true);
    setError(null);
    try {
      const updated = await upsertUserProfile(user.id, {
        display_name: displayName.trim(),
        country: country.trim(),
        address: address.trim(),
        favourite_quote: quote.trim(),
      });
      setProfile(updated);
      setStep("checkout");
    } catch (err) {
      setError(err.message || "Couldn't save your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    initializePaddle((event) => {
      // Fires for every Paddle checkout event: checkout.loaded,
      // checkout.customer.created, checkout.completed, checkout.closed, etc.
      if (event?.name === "checkout.completed") {
        // Only react if this completion matches the transaction we opened,
        // so a stale/duplicate event can't fire us into the wrong step.
        const completedId =
          event?.data?.transaction_id || event?.data?.id;
        if (
          !transactionIdRef.current ||
          !completedId ||
          completedId === transactionIdRef.current
        ) {
          setPaying(false);
          setError(null);
          setStep("upload");

          // Auto-dismiss Paddle's "transaction completed" screen instead
          // of waiting for the person to click its close (X) button.
          // A short delay lets Paddle finish its own completion animation
          // first so the close doesn't look abrupt.
          setTimeout(() => {
            try {
              window.Paddle?.Checkout?.close?.();
            } catch (err) {
              console.error("Failed to auto-close Paddle checkout:", err);
            }
          }, 1500);
        }
      }

      if (event?.name === "checkout.error") {
        setPaying(false);
        setError("Paddle checkout error. Please try again.");
      }
    }).catch((err) => {
      console.error("Paddle initialization failed:", err);
    });
  }, []);

const handlePay = async () => {
  setError(null);
  setPaying(true);

  try {
    // Make sure the user is still authenticated.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("Your session expired. Please sign in again.");
    }

    // Ask our Vercel backend to create the transaction.
    // The backend calculates the authoritative bid amount.
    const response = await fetch("/api/create-bid-transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        titleId: selectedTitle.id,
      }),
    });

    const result = await response.json();

    console.log("Bid transaction response:", result);

    if (!response.ok) {
      throw new Error(
        result?.error || "Couldn't prepare the Paddle transaction."
      );
    }

    if (!result?.transactionId) {
      throw new Error(
        "The server did not return a Paddle transaction ID."
      );
    }

    // Remember the transaction so we can match Paddle's
    // checkout.completed event later.
    transactionIdRef.current = result.transactionId;
    setTransactionId(result.transactionId);

    // Open the actual Paddle Sandbox checkout.
    await openPaddleTransactionCheckout(result.transactionId);

    setPaying(false);
  } catch (err) {
    console.error("Paddle checkout setup failed:", err);
    setPaying(false);
    setError(err.message || "Couldn't open Paddle checkout.");
  }
};


 const processImage = async (file, skipRemoval) => {
  setError(null);
  setProcessing(false);
  setCutoutBlob(null);

  if (skipRemoval) {
    // Already transparent — use the original file directly.
    setCutoutBlob(file);
    return;
  }

  setProcessing(true);

  try {
    const { removeBackground } = await import(
      "@imgly/background-removal"
    );

    const blob = await removeBackground(file);
    setCutoutBlob(blob);
  } catch (err) {
    console.error(err);

    setError(
      "Background removal failed — you can still submit the original image."
    );
  } finally {
    setProcessing(false);
  }
};

const handleFileChange = async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  setError(null);
  setRawFile(file);
  setPreviewUrl(URL.createObjectURL(file));

  await processImage(file, skipBackgroundRemoval);
};

const handleSkipBackgroundRemovalChange = async (e) => {
  const checked = e.target.checked;

  setSkipBackgroundRemoval(checked);

  if (!rawFile) return;

  await processImage(rawFile, checked);
};

  const handleSubmit = async () => {
    if (!rawFile) return;

    setError(null);
    setSubmitting(true);

    try {
      const fileToUpload = cutoutBlob || rawFile;
      const imageUrl = await uploadTitleImage(
        selectedTitle.id,
        fileToUpload
      );

      await onComplete({
        userId: user.id,
        bidder: displayName,
        amount: nextBid,
        country,
        address,
        favouriteQuote: quote,
        imageUrl,
      });

      setStep("done");
    } catch (err) {
      console.error("Submit failed:", err);
      setError(err.message || "Couldn't submit your image.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <p className="modal-eyebrow">
          #{String(selectedTitle.id).padStart(2, "0")} · {selectedTitle.title}
        </p>

        {step === "loading" && <p className="modal-sub">Loading...</p>}

        {step === "signin" && (
          <>
            <h2 className="modal-title">Sign in to bid</h2>
            <p className="modal-sub">
              Sign in with Google to place your bid and take this title.
            </p>
            <button className="modal-google-btn" onClick={handleGoogleSignIn}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.9c1.7-1.57 2.7-3.88 2.7-6.64z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.27c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34C2.44 15.98 5.48 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.95 10.69A5.4 5.4 0 013.68 9c0-.59.1-1.16.27-1.69V4.97H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.03l2.99-2.34z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"
                />
              </svg>
              Sign in with Google
            </button>
            {error && <p className="modal-error">{error}</p>}
          </>
        )}

        {step === "profile" && (
          <>
            <h2 className="modal-title">Complete your profile</h2>
            <p className="modal-sub">
              This info will be shown publicly on the live bidding bar once
              you take a title.
            </p>
            <form onSubmit={handleSaveProfile}>
              <input
                className="modal-input"
                type="text"
                placeholder="Display name / handle"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                className="modal-input"
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
              <input
                className="modal-input"
                type="text"
                placeholder="Address (city, region shown publicly)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <input
                className="modal-input"
                type="text"
                placeholder="Favourite quote"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
              />
              {error && <p className="modal-error">{error}</p>}
              <button
                className="modal-primary-btn"
                type="submit"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "checkout" && (
          <>
            <h2 className="modal-title">Confirm your bid</h2>
            <div className="modal-row">
              <span>Bidding as</span>
              <strong>{displayName}</strong>
            </div>
            <div className="modal-row">
              <span>New price</span>
              <strong>${nextBid.toLocaleString()}</strong>
            </div>
            <p className="modal-sub small">
              Secure Paddle checkout is being prepared for this bid.
            </p>
            {error && <p className="modal-error">{error}</p>}
            <button
              className="modal-primary-btn"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? "Preparing secure checkout..." : `Pay $${nextBid.toLocaleString()} & continue`}
            </button>
          </>
        )}

        {step === "upload" && (
          <>
            <h2 className="modal-title">Upload your image</h2>
            <p className="modal-sub">
              For best results, upload a full-body photo that's already cut
              out (transparent PNG). We'll auto-remove the background for
              you, but a pre-cut sticker-style image will always look
              cleanest.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />

            <button
              className="modal-upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              {rawFile ? "Choose a different image" : "Choose image"}
            </button>
            <label className="transparent-image-checkbox">
  <input
    type="checkbox"
    checked={skipBackgroundRemoval}
    onChange={handleSkipBackgroundRemovalChange}
  />

  <span className="transparent-checkbox-box">
    {skipBackgroundRemoval ? "✓" : ""}
  </span>

  <span className="transparent-checkbox-text">
    <strong>Image already has transparent background</strong>
    <small>
      Skip automatic background removal
    </small>
  </span>
</label>

            {previewUrl && (
              <div className="modal-preview">
                <div className="modal-preview-col">
                  <span className="modal-preview-label">Original</span>
                  <img src={previewUrl} alt="Original upload" />
                </div>
                <div className="modal-preview-col">
                  <span className="modal-preview-label">
  {processing
    ? "Processing..."
    : skipBackgroundRemoval
    ? "Transparent image"
    : "Cutout preview"}
</span>
                  {processing ? (
  <div className="modal-preview-loading">✂️</div>
) : cutoutBlob ? (
  <img
    src={
      skipBackgroundRemoval
        ? previewUrl
        : URL.createObjectURL(cutoutBlob)
    }
    alt={
      skipBackgroundRemoval
        ? "Transparent image preview"
        : "Cutout preview"
    }
  />
) : (
  <div className="modal-preview-loading">—</div>
)}
                </div>
              </div>
            )}

            {error && <p className="modal-error">{error}</p>}

            <button
              className="modal-primary-btn"
              onClick={handleSubmit}
              disabled={!rawFile || processing || submitting}
            >
              {submitting ? "Submitting..." : "Confirm & take the title"}
            </button>
          </>
        )}

        {step === "done" && (
          <>
            <h2 className="modal-title">You're legendary now 🏆</h2>
            <p className="modal-sub">
              You are the new holder of "{selectedTitle.title}".
            </p>
            <button className="modal-primary-btn" onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}