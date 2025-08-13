import React from "react";
import { CURSOR_COLORS } from "@/modeling/lib/cursor-manager";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Timestamp } from "@clockworklabs/spacetimedb-sdk";

export interface AvatarProps {
  id: string;
  name?: string;
  size?: number;
  className?: string;
  showTooltip?: boolean;
  colorIndexOverride?: number;
  useAnimalIcon?: boolean;
  updatedAt?: Timestamp;
  displayName?: string;
}

interface TwemojiProps {
  emoji: string;
  size: number;
}

const Twemoji: React.FC<TwemojiProps> = ({ emoji, size }) => {
  const codePoint = emoji.codePointAt(0)?.toString(16);

  if (!codePoint) return null;

  return (
    <div
      style={{
        width: size,
        height: size,
        WebkitMask: `url(https://twemoji.maxcdn.com/v/latest/svg/${codePoint}.svg) center/contain no-repeat`,
        mask: `url(https://twemoji.maxcdn.com/v/latest/svg/${codePoint}.svg) center/contain no-repeat`,
        backgroundColor: "currentColor",
        display: "block",
      }}
    />
  );
};

const animalEmojiMap: Record<string, string> = {
  rabbit: "🐰",
  turtle: "🐢",
  cat: "🐱",
  dog: "🐶",
  eagle: "🦅",
  hawk: "🦅",
  owl: "🦉",
  raven: "🐦‍⬛",
  falcon: "🦅",
  crane: "🦢",
  swan: "🦢",
  phoenix: "🔥",
  bird: "🐦",
  dolphin: "🐬",
  whale: "🐋",
  shark: "🦈",
  fish: "🐟",
  viper: "🐍",
  cobra: "🐍",
  snake: "🐍",
  tiger: "🐅",
  lion: "🦁",
  leopard: "🐆",
  jaguar: "🐆",
  panther: "🐆",
  lynx: "🐱",
  deer: "🦌",
  elk: "🦌",
  bison: "🦬",
  horse: "🐴",
  wolf: "🐺",
  fox: "🦊",
  bear: "🐻",
  otter: "🦦",
  squirrel: "🐿️",
  dragon: "🐉",
};

const bigCatSet = new Set([
  "tiger",
  "lion",
  "leopard",
  "jaguar",
  "panther",
  "lynx",
]);
const birdSet = new Set([
  "eagle",
  "hawk",
  "owl",
  "raven",
  "falcon",
  "crane",
  "swan",
  "phoenix",
]);
const seaSet = new Set(["dolphin", "whale", "shark"]);
const snakeSet = new Set(["viper", "cobra"]);
const canineSet = new Set(["wolf", "fox"]);
const hoofedSet = new Set(["deer", "elk", "bison", "horse"]);
const mammalSet = new Set(["bear", "otter"]);

function getAnimalEmoji(token: string): string | undefined {
  const t = token.toLowerCase();

  if (animalEmojiMap[t]) return animalEmojiMap[t];

  if (bigCatSet.has(t)) return "🐱";
  if (canineSet.has(t)) return "🐶";
  if (birdSet.has(t)) return "🐦";
  if (seaSet.has(t)) return "🐟";
  if (snakeSet.has(t)) return "🐍";
  if (hoofedSet.has(t)) return "🦌";
  if (mammalSet.has(t)) return "🐻";

  return undefined;
}

function getTimeAgo(timestamp: Timestamp): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.toDate().getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return `Now`;
}

export const Avatar: React.FC<AvatarProps> = ({
  id,
  size = 32,
  updatedAt,
  displayName,
}) => {
  const getColorForPlayer = React.useCallback((playerId: string): string => {
    let hash = 5381;
    for (let i = 0; i < playerId.length; i++) {
      hash = (hash * 33) ^ playerId.charCodeAt(i);
    }
    const index = Math.abs(hash) % CURSOR_COLORS.length;
    return `#${CURSOR_COLORS[index].getHexString()}`;
  }, []);

  const getInitials = React.useCallback((n?: string, fallback?: string) => {
    if (n && n.trim()) {
      const parts = n.trim().split(/\s+/);
      if (parts.length === 1) {
        const word = parts[0];
        const first = word[0] || "?";
        const second =
          [...word.slice(1)].find((ch) => /[A-Za-z0-9]/.test(ch)) || first;
        return (first + second).substring(0, 2).toUpperCase();
      } else {
        return (
          (parts[0][0] || "") + (parts[parts.length - 1][0] || "")
        ).toUpperCase();
      }
    }
    if (fallback) {
      const cleaned = fallback.replace(/[^A-Za-z0-9]/g, "");
      const tail = cleaned.slice(-2).toUpperCase();
      if (tail.length === 2) return tail;
      return cleaned.slice(0, 2).toUpperCase() || "??";
    }
    return "??";
  }, []);

  const color = getColorForPlayer(id);
  const initials = getInitials(displayName, id);

  let animalEmoji: string | undefined;
  if (displayName) {
    const tokens = displayName.split(/[\s,_-]+/);
    for (const token of tokens) {
      if (!token) continue;
      const emoji = getAnimalEmoji(token);
      if (emoji) {
        animalEmoji = emoji;
        break;
      }
    }
  }

  const avatarElement = (
    <div
      className="rounded-full border border-white/80 flex items-center justify-center font-medium text-white shadow-sm select-none"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        lineHeight: `${size}px`,
        fontSize: size < 32 ? 10 : 12,
      }}
    >
      {animalEmoji ? (
        <Twemoji
          emoji={animalEmoji}
          size={Math.max(12, Math.round(size * 0.6))}
        />
      ) : (
        initials
      )}
    </div>
  );

  if (!updatedAt && !displayName) {
    return avatarElement;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{avatarElement}</TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            {displayName && <div className="font-medium">{displayName}</div>}
            {updatedAt && (
              <div className="text-xs opacity-80">
                Active {getTimeAgo(updatedAt)}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
