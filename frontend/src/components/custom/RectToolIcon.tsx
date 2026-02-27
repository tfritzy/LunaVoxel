import type { LucideProps } from "lucide-react";

export const RectToolIcon = ({
  className,
  ...props
}: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="4 2" />
    <circle cx="3" cy="3" r="1.5" fill="currentColor" stroke="none" />
    <line x1="5" y1="5" x2="18" y2="18" strokeWidth="1.5" strokeDasharray="3 2" />
    <polyline points="14,18 18,18 18,14" strokeWidth="2" />
  </svg>
);
