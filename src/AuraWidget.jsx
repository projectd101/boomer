import { useEffect, useRef, useState } from "react";
import { incrementAura } from "./supabaseClient";

// Renders the W AURA button and the live, shared aura count.
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
export default function AuraWidget({ titleId, aura }) {
  const [baseAura, setBaseAura] = useState(aura ?? 0);
  const [pending, setPending] = useState(0);
  const [floaters, setFloaters] = useState([]);
  const lastTitleId = useRef(titleId);

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

  const handleLike = () => {
    const floaterId = `${Date.now()}-${Math.random()}`;
    const drift = Math.round((Math.random() - 0.5) * 30); // px, fans out spam clicks

    setFloaters((prev) => [...prev, { id: floaterId, drift }]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== floaterId));
    }, 1200);

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
        <span className="aura-btn-icon">✦</span>
        W AURA <span className="aura-count">{displayCount}</span>

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