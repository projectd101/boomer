import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { supabase, signOut } from "./supabaseClient";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout() {
  const [currentUser, setCurrentUser] = useState(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [liveViewers, setLiveViewers] = useState(
    () => 40 + Math.floor(Math.random() * 60)
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
          setAvatarMenuOpen(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
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
          context) rather than prop drilling through every route. */}
      <Outlet context={{ currentUser, handleSignIn }} />

      <Footer />
    </div>
  );
}

