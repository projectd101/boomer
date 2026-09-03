import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  supabase,
  signOut,
  getUserProfile,
  isProfileComplete,
  upsertUserProfile,
} from "./supabaseClient";
import Header from "./Header";
import Footer from "./Footer";
import { COUNTRY_OPTIONS } from "./countries";

export default function Layout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [liveViewers, setLiveViewers] = useState(
    () => 40 + Math.floor(Math.random() * 60)
  );

  // Onboarding modal shown right after sign-in when the profile is
  // incomplete. Suppressed while OutbidModal is open, since that modal
  // already has its own built-in profile step for the outbid flow.
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [suppressOnboarding, setSuppressOnboardingState] = useState(false);
  const suppressOnboardingRef = useRef(false);
  const setSuppressOnboarding = (value) => {
    suppressOnboardingRef.current = value;
    setSuppressOnboardingState(value);
  };
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingCountry, setOnboardingCountry] = useState("");
  const [onboardingAddress, setOnboardingAddress] = useState("");
  const [onboardingQuote, setOnboardingQuote] = useState("");
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState(null);

  const PENDING_OUTBID_KEY = "boomers_pending_outbid_title_id";

  const checkProfileAndMaybeOnboard = async (user) => {
    // If there's a pending outbid stashed (the user clicked Outbid, then
    // got bounced through the Google OAuth redirect), HomePage's own
    // OutbidModal will handle profile completion once it remounts and
    // reopens for that title. Checking localStorage here (synchronously,
    // before the async profile fetch below) closes the race between this
    // check and HomePage's restore effect, which only fires after titles
    // finish loading.
    if (!user || suppressOnboardingRef.current) return;
    if (localStorage.getItem(PENDING_OUTBID_KEY)) return;
    try {
      const profile = await getUserProfile(user.id);
      if (!isProfileComplete(profile)) {
        setOnboardingName(profile?.display_name || "");
        setOnboardingCountry(profile?.country || "");
        setOnboardingAddress(profile?.address || "");
        setOnboardingQuote(profile?.favourite_quote || "");
        setOnboardingError(null);
        setOnboardingOpen(true);
      }
    } catch (err) {
      console.error("Couldn't check profile completeness:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
      if (data.user) checkProfileAndMaybeOnboard(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
          setAvatarMenuOpen(false);
          setOnboardingOpen(false);
        } else {
          checkProfileAndMaybeOnboard(session.user);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveViewers((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const next = prev + delta;
        return Math.max(12, Math.min(180, next));
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    setAvatarMenuOpen(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("Failed to sign in", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setAvatarMenuOpen(false);
  };

  const handleSaveOnboarding = async (e) => {
    e.preventDefault();

    if (
      !onboardingName.trim() ||
      !onboardingCountry.trim() ||
      !onboardingAddress.trim() ||
      !onboardingQuote.trim()
    ) {
      setOnboardingError("Please fill in every field.");
      return;
    }

    setOnboardingSaving(true);
    setOnboardingError(null);

    try {
      await upsertUserProfile(currentUser.id, {
        display_name: onboardingName.trim(),
        country: onboardingCountry.trim(),
        address: onboardingAddress.trim(),
        favourite_quote: onboardingQuote.trim(),
      });

      // Plain sign-in path: just close the modal and stay on the page.
      setOnboardingOpen(false);
    } catch (err) {
      console.error("Couldn't save onboarding profile:", err);
      setOnboardingError(err.message || "Couldn't save your profile.");
    } finally {
      setOnboardingSaving(false);
    }
  };

  return (
    <div className="app">
      <Header
        liveViewers={liveViewers}
        currentUser={currentUser}
        avatarMenuOpen={avatarMenuOpen}
        setAvatarMenuOpen={setAvatarMenuOpen}
        handleSignIn={handleSignIn}
        handleSignOut={handleSignOut}
      />

      {/* Pages access currentUser/handleSignIn via router context (outlet
          context) rather than prop drilling through every route.
          setSuppressOnboarding lets a page (e.g. HomePage's OutbidModal)
          tell Layout "I'm already handling profile completion for this
          sign-in" so the two modals never show at once. */}
      <Outlet
        context={{
          currentUser,
          handleSignIn,
          setSuppressOnboarding,
        }}
      />

      <Footer />

      {onboardingOpen && currentUser && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">Complete your profile</h2>
            <p className="modal-sub">
              This info will be shown publicly once you take a title.
            </p>
            <form onSubmit={handleSaveOnboarding}>
              <input
                className="modal-input"
                type="text"
                placeholder="Display name / handle"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
              />
              <select
                className="modal-input"
                value={onboardingCountry}
                onChange={(e) => setOnboardingCountry(e.target.value)}
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
                value={onboardingAddress}
                onChange={(e) => setOnboardingAddress(e.target.value)}
              />
              <input
                className="modal-input"
                type="text"
                placeholder="Favourite quote"
                value={onboardingQuote}
                onChange={(e) => setOnboardingQuote(e.target.value)}
              />
              {onboardingError && (
                <p className="modal-error">{onboardingError}</p>
              )}
              <button
                className="modal-primary-btn"
                type="submit"
                disabled={onboardingSaving}
              >
                {onboardingSaving ? "Saving..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}