import React from "react";
import { LucideIcon } from "lucide-react";

interface SelectionCardProps {
  isSelected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  isSelected,
  onSelect,
  icon: Icon,
  title,
  description,
  children,
}) => {
  return (
    <div
      className={`
        relative border-2 rounded-lg p-6 px-12 cursor-pointer transition-all
        ${
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 bg-muted/50 opacity-40"
        }
      `}
      onClick={onSelect}
    >
      <div className="flex items-center space-x-3 mb-6">
        <div
          className={`
            w-4 h-4 rounded-full border-2 flex items-center justify-center
            ${
              isSelected
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            }
          `}
        >
          {isSelected && (
            <div className="w-2 h-2 bg-primary-foreground rounded-full" />
          )}
        </div>
        <Icon className="w-5 h-5 text-muted-foreground" />
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex justify-center">
        <div
          className={!isSelected ? "pointer-events-none" : ""}
          onClick={(e) => isSelected && e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
