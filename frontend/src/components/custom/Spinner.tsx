// components/Spinner.tsx
import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "white";
  className?: string;
  label?: string;
}

export default function Spinner({
  size = "md",
  color = "primary",
  className,
  label,
}: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  const colorClasses = {
    primary: "border-primary/30 border-t-primary",
    secondary: "border-secondary/30 border-t-secondary",
    white: "border-white/30 border-t-white",
  };

  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
      <div
        className={cn(
          "rounded-full animate-spin",
          sizeClasses[size],
          colorClasses[color],
          className
        )}
      />
      {label && <div className="mt-2 text-sm font-medium">{label}</div>}
    </div>
  );
}
