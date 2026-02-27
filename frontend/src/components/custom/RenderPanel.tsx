import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Power, RotateCcw } from "lucide-react";
import type { RenderSettings } from "@/modeling/lib/webgpu-ray-tracer";
import { defaultRenderSettings } from "@/modeling/lib/webgpu-ray-tracer";

interface RenderPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  settings: RenderSettings;
  onSettingsChange: (settings: RenderSettings) => void;
}

export const RenderPanel = ({
  enabled,
  onToggle,
  settings,
  onSettingsChange,
}: RenderPanelProps) => {
  const update = useCallback(
    (partial: Partial<RenderSettings>) => {
      onSettingsChange({ ...settings, ...partial });
    },
    [settings, onSettingsChange]
  );

  const reset = useCallback(() => {
    onSettingsChange({ ...defaultRenderSettings });
  }, [onSettingsChange]);

  return (
    <div className="border-t border-border">
      <div className="w-full flex flex-row justify-between items-center px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Render</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={reset}
            title="Reset to defaults"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            className="h-6 gap-1 text-xs px-2"
            onClick={() => onToggle(!enabled)}
          >
            <Power className="h-3 w-3" />
            {enabled ? "On" : "Off"}
          </Button>
        </div>
      </div>

      <div className={`px-4 pb-4 space-y-3 ${!enabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Sun Direction: {settings.sunAzimuth}°
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={settings.sunAzimuth}
            onChange={(e) => update({ sunAzimuth: Number(e.target.value) })}
            className="w-full cursor-pointer accent-accent"
          />
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Sun Elevation: {settings.sunElevation}°
          </div>
          <input
            type="range"
            min={5}
            max={90}
            value={settings.sunElevation}
            onChange={(e) => update({ sunElevation: Number(e.target.value) })}
            className="w-full cursor-pointer accent-accent"
          />
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Sun Intensity: {settings.sunIntensity.toFixed(1)}
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={settings.sunIntensity * 10}
            onChange={(e) => update({ sunIntensity: Number(e.target.value) / 10 })}
            className="w-full cursor-pointer accent-accent"
          />
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">Sun Color</div>
          <div className="flex gap-1">
            {[
              { label: "Warm", r: 1.0, g: 0.92, b: 0.82 },
              { label: "White", r: 1.0, g: 1.0, b: 1.0 },
              { label: "Cool", r: 0.85, g: 0.92, b: 1.0 },
              { label: "Gold", r: 1.0, g: 0.85, b: 0.55 },
              { label: "Pink", r: 1.0, g: 0.75, b: 0.85 },
            ].map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs border rounded-none"
                style={{
                  borderColor:
                    Math.abs(settings.sunColorR - preset.r) < 0.01 &&
                    Math.abs(settings.sunColorG - preset.g) < 0.01 &&
                    Math.abs(settings.sunColorB - preset.b) < 0.01
                      ? "hsl(var(--accent))"
                      : "hsl(var(--border))",
                  backgroundColor: `rgb(${preset.r * 255}, ${preset.g * 255}, ${preset.b * 255})`,
                  color: preset.r + preset.g + preset.b > 2 ? "#000" : "#fff",
                }}
                onClick={() =>
                  update({
                    sunColorR: preset.r,
                    sunColorG: preset.g,
                    sunColorB: preset.b,
                  })
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Ambient Light: {(settings.ambientIntensity * 100).toFixed(0)}%
          </div>
          <input
            type="range"
            min={5}
            max={100}
            value={settings.ambientIntensity * 100}
            onChange={(e) => update({ ambientIntensity: Number(e.target.value) / 100 })}
            className="w-full cursor-pointer accent-accent"
          />
        </div>

        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Shadow Strength: {(settings.shadowDarkness * 100).toFixed(0)}%
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.shadowDarkness * 100}
            onChange={(e) => update({ shadowDarkness: Number(e.target.value) / 100 })}
            className="w-full cursor-pointer accent-accent"
          />
        </div>
      </div>
    </div>
  );
};
