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
            "polygon(50% -4%, 96.5% 23.1%, 96.5% 77.1%, 50% 104%, 3% 77.1%, 3% 23.1%)",
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
          points="50,-4 96.5,23.1 96.5,77.1 50,104 3,77.1 3,23.1"
          stroke={isSelected ? "white" : "var(--background)"}
          strokeWidth={isSelected ? 3 : 5}
          opacity={isSelected ? 1 : 1}
        />
      </svg>
    </div>
  );
};
