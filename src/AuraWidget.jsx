import { useEffect, useRef, useState } from "react";
import { incrementAura } from "./supabaseClient";

// Renders the KIRK button and the live, shared aura count.
//
// Displayed count = (last known real DB value) + (pending optimistic
// clicks not yet confirmed by realtime). This gives an INSTANT +1 on
// every click -- no waiting on the network -- while still converging
// on the real, shared DB value as realtime updates arrive, and without
// ever visibly flickering backward the way a naive "just trust the DB"
// or "just trust local state" approach would.
//
// How the reconciliation works:
// - `baseAura` tracks the last real value we've seen from the DB (the
//   `aura` prop, updated via App.jsx's realtime subscription).
// - `pending` tracks clicks we've fired but not yet seen confirmed.
// - When a new `aura` prop comes in, we figure out how much it moved
//   since our last known base and subtract that from `pending`
//   (clamped at 0), then update `baseAura`. So if we optimistically
//   added +3 and the DB update confirms +1 of those, pending drops to
//   +2 and the total displayed stays the same (no jump).
//
// Click also triggers a frog "croak": the SVG throat pouch balloons
// out and snaps back (rest of the frog stays still), paired with a
// short croak sound effect.
const CROAK_AUDIO_SRC = "/croak.mp3"; // drop the trimmed audio file at public/croak.mp3

export default function AuraWidget({ titleId, aura }) {
  const [baseAura, setBaseAura] = useState(aura ?? 0);
  const [pending, setPending] = useState(0);
  const [floaters, setFloaters] = useState([]);
  const lastTitleId = useRef(titleId);
  const throatRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio(CROAK_AUDIO_SRC);
    audioRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    if (titleId !== lastTitleId.current) {
      // Switched titles: fully reset, no carrying over pending clicks
      // from a different title's button.
      lastTitleId.current = titleId;
      setBaseAura(aura ?? 0);
      setPending(0);
      setFloaters([]);
      return;
    }

    setBaseAura((prevBase) => {
      const newReal = aura ?? 0;
      const confirmed = Math.max(0, newReal - prevBase);
      setPending((p) => Math.max(0, p - confirmed));
      return newReal;
    });
  }, [aura, titleId]);

  const playCroak = () => {
    // Throat pouch: two quick puffs, then settle -- rest of the frog
    // stays put since only the throat element is targeted.
    if (throatRef.current) {
      throatRef.current.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.9)" },
          { transform: "scale(1.1)" },
          { transform: "scale(1.5)" },
          { transform: "scale(1)" },
        ],
        { duration: 550, easing: "ease-in-out" }
      );
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay-policy or missing-file failures shouldn't break the click.
      });
    }
  };

  const handleLike = () => {
    const floaterId = `${Date.now()}-${Math.random()}`;
    const drift = Math.round((Math.random() - 0.5) * 30); // px, fans out spam clicks

    setFloaters((prev) => [...prev, { id: floaterId, drift }]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== floaterId));
    }, 1200);

    playCroak();

    // Instant feedback: bump the displayed count right away.
    setPending((p) => p + 1);

    // Persist in the background. We deliberately don't roll this back
    // on error -- a failed request just means that click's contribution
    // stays as a locally-visible bump until the next successful DB sync
    // reconciles it away; the DB is never lied to, only the transient
    // display gets ahead of it for responsiveness.
    incrementAura(titleId).catch((err) => {
      console.error("Failed to increment aura", err);
    });
  };

  const displayCount = baseAura + pending;

  return (
    <div className="aura-widget">
      <button className="aura-btn" onClick={handleLike}>
        <svg
          className="aura-frog"
          width="34"
          height="34"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <ellipse cx="50" cy="60" rx="34" ry="26" fill="#3B6D11" />
          <circle
            ref={throatRef}
            className="aura-frog-throat"
            cx="50"
            cy="74"
            r="14"
            fill="#639922"
            style={{ transformOrigin: "50px 74px" }}
          />
          <circle cx="32" cy="34" r="13" fill="#3B6D11" />
          <circle cx="68" cy="34" r="13" fill="#3B6D11" />
          <circle cx="32" cy="34" r="6" fill="#173404" />
          <circle cx="68" cy="34" r="6" fill="#173404" />
          <circle cx="34" cy="32" r="2" fill="white" />
          <circle cx="70" cy="32" r="2" fill="white" />
        </svg>
        KIRK <span className="aura-count">{displayCount}</span>

        {floaters.map((f) => (
          <span
            key={f.id}
            className="aura-floater"
            style={{ "--drift": `${f.drift}px` }}
          >
            +1
          </span>
        ))}
      </button>
    </div>
  );
}