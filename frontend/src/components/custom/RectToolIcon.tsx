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
    <path d="M3 10 H14 V21 H3 Z" />
    <path d="M3 10 L9 4 H20 L14 10" />
    <path d="M14 10 L20 4 V15 L14 21" />
  </svg>
);
