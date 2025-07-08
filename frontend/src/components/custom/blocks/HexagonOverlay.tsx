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
        className="absolute inset-0 cursor-pointer hover:stroke-primary/10 pointer-events-auto"
        style={{
          clipPath:
            "polygon(50% -7%, 96.5% 26.5%, 96.5% 73.8%, 50% 107%, 3% 72.8%, 3% 26.5%)",
        }}
        onMouseDown={onClick}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        className="absolute inset-0"
      >
        <polygon
          className="fill-transparent"
          points="50,-7 96.5,26.5 96.5,73.8 50,107 3,72.8 3,26.5"
          stroke={isSelected ? "white" : "var(--border)"}
          strokeWidth={isSelected ? 3 : 1}
          opacity={isSelected ? 1 : 1}
        />
      </svg>
    </div>
  );
};
