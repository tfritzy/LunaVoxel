export const HexagonOverlay = ({
  isSelected,
  onClick,
}: {
  isSelected: boolean;
  onClick: () => void;
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0 cursor-pointer hover:fill-primary/10 pointer-events-auto"
        style={{
          clipPath:
            "polygon(50% 6.5%, 86% 32%, 86% 67.8%, 50% 93.5%, 13.9% 67.8%, 13.9% 32%)",
        }}
        onClick={onClick}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        className="absolute inset-0"
      >
        <polygon
          className="fill-transparent"
          points="50,-4 93.5,27.5 93.5,72.8 50,104 5.5,72.8 5.5,27.5"
          stroke={isSelected ? "white" : "var(--border)"}
          strokeWidth={isSelected ? 2 : 1}
          opacity={isSelected ? 1 : 1}
        />
      </svg>
    </div>
  );
};
