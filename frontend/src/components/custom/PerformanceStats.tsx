import { useEffect, useRef } from "react";
import Stats from "three/examples/jsm/libs/stats.module.js";

interface PerformanceStatsProps {
  enabled?: boolean;
}

const PerformanceStats = ({ enabled = true }: PerformanceStatsProps) => {
  const statsRef = useRef<Stats | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const stats = new Stats();
    statsRef.current = stats;

    stats.showPanel(0);

    const container = stats.dom;
    container.style.cssText = "position:fixed;bottom:0;right:0;z-index:100;";
    document.body.appendChild(container);

    stats.addPanel(Stats.Panel("fps", "#0ff", "#002"));
    stats.addPanel(Stats.Panel("ms", "#0f0", "#020"));
    stats.showPanel(0);

    const animate = () => {
      stats.update();
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      if (container && container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  }, [enabled]);

  return null;
};

export default PerformanceStats;
