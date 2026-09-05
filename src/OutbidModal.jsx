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
import { COUNTRY_OPTIONS } from "./countries";

// Quick lookup from a saved country name (e.g. "Nepal") back to its
// ISO 3166-1 alpha-2 code (e.g. "NP"), needed to pre-fill Paddle checkout.
const countryNameToCode = Object.fromEntries(
  COUNTRY_OPTIONS.map((c) => [c.name, c.code])
);

// Steps: "signin" -> "profile" -> "checkout" -> "waiting" -> "upload" -> "done"
//
// IMPORTANT: this modal no longer writes to `titles` or `bids` itself.
// Those writes only happen server-side, inside the Paddle webhook
// (/api/paddle-webhook), after Paddle confirms the payment actually
// captured. The client-side "checkout.completed" event is NOT proof of
// payment -- it's just Paddle's UI telling us its overlay finished; it
// can fire from stale state or be spoofed via devtools. So instead of
// writing the DB here, we wait for HomePage's realtime subscription to
// see the title's row actually change (driven by the webhook) and
// treat THAT as confirmation.
export default function OutbidModal({ selectedTitle, onClose, onComplete }) {
  const [step, setStep] = useState("loading");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [quote, setQuote] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

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
  const [waitTimedOut, setWaitTimedOut] = useState(false);
  const fileInputRef = useRef(null);

  const nextBid = selectedTitle.price + 5;

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
      if (event?.name === "checkout.completed") {
        const completedId =
          event?.data?.transaction_id || event?.data?.id;
        if (
          !transactionIdRef.current ||
          !completedId ||
          completedId === transactionIdRef.current
        ) {
          setPaying(false);
          setError(null);
          // Do NOT move to "upload" here and do NOT write the DB.
          // This event only means Paddle's overlay finished -- the
          // actual payment confirmation comes from the webhook, which
          // we wait for below.
          setStep("waiting");

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

  // While waiting for Paddle's server-to-server webhook to actually
  // apply the win, watch this title's row for the change. HomePage
  // already keeps `titles` live via a realtime subscription and passes
  // the freshest copy down as `selectedTitle`, so we just watch for it
  // to reflect this user + this bid amount.
  useEffect(() => {
    if (step !== "waiting") return;

    setWaitTimedOut(false);

    if (
      selectedTitle.holder_user_id === user?.id &&
      selectedTitle.price === nextBid
    ) {
      setStep("upload");
      return;
    }

    const timeout = setTimeout(() => setWaitTimedOut(true), 20000);
    return () => clearTimeout(timeout);
  }, [step, selectedTitle, user, nextBid]);

  const handlePay = async () => {
    setError(null);
    setPaying(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const countryCode = countryNameToCode[country] || null;

      const response = await fetch("/api/create-bid-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          titleId: selectedTitle.id,
          countryCode,
        }),
      });

      const result = await response.json();

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

      transactionIdRef.current = result.transactionId;
      setTransactionId(result.transactionId);

      await openPaddleTransactionCheckout(result.transactionId, {
        email: user.email,
        countryCode,
      });

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
      console.error("Background removal failed:", err);
      setError("Couldn't remove the background. Try again or use a pre-cut image.");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    processImage(file, skipBackgroundRemoval);
  };

  const handleSkipBackgroundRemovalChange = (e) => {
    const checked = e.target.checked;
    setSkipBackgroundRemoval(checked);
    if (rawFile) {
      processImage(rawFile, checked);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const fileToUpload = cutoutBlob || rawFile;
      const imageUrl = await uploadTitleImage(
        selectedTitle.id,
        fileToUpload
      );

      // Only the image upload is a client-side write at this point --
      // price/holder/bids were already applied by the webhook before
      // we ever reached this step. This just attaches the photo to
      // the title this user now legitimately holds.
      await onComplete({ imageUrl });

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
              <select
                className="modal-input"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="" disabled>
                  Select your country
                </option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.label}
                  </option>
                ))}
              </select>
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

        {step === "waiting" && (
          <>
            <h2 className="modal-title">Confirming your payment...</h2>
            <p className="modal-sub">
              Hang tight — we're verifying your payment with Paddle. This
              usually only takes a few seconds.
            </p>
            {waitTimedOut && (
              <p className="modal-error">
                This is taking longer than expected. Your payment may still
                be processing — please don't pay again. If this title
                doesn't update in a minute or two, contact support with
                your transaction ID.
              </p>
            )}
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