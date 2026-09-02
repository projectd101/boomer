import { useEffect, useState } from "react";

// Returns a live-updating "Xh Ym Zs" string representing how long the
// current holder has reigned, based on reign_started_at.
export function useReignTimer(reignStartedAt) {
  const [elapsed, setElapsed] = useState("0hr, 0min");

  useEffect(() => {
    if (!reignStartedAt) return;

    const start = new Date(reignStartedAt).getTime();

    function tick() {
      const diffMs = Date.now() - start;
      const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setElapsed(`${hours}hr, ${minutes}min`);
    }

    tick();
    const interval = setInterval(tick, 1000 * 30); // update every 30s, cheap
    return () => clearInterval(interval);
  }, [reignStartedAt]);

  return elapsed;
}
