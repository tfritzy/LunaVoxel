import React from "react";
import { CURSOR_COLORS } from "@/modeling/lib/cursor-manager";

export interface AvatarProps {
    id: string;
    name?: string;
    size?: number;
    className?: string;
    showTooltip?: boolean;
    colorIndexOverride?: number;
    useAnimalIcon?: boolean;
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
                backgroundColor: 'currentColor',
                display: 'block'
            }}
        />
    );
};

const animalEmojiMap: Record<string, string> = {
    // Direct animal matches
    rabbit: "🐰",
    turtle: "🐢",
    cat: "🐱",
    dog: "🐶",

    // Birds
    eagle: "🦅",
    hawk: "🦅",
    owl: "🦉",
    raven: "🐦‍⬛",
    falcon: "🦅",
    crane: "🦢",
    swan: "🦢",
    phoenix: "🔥",
    bird: "🐦",

    // Sea creatures
    dolphin: "🐬",
    whale: "🐋",
    shark: "🦈",
    fish: "🐟",

    // Reptiles/snakes
    viper: "🐍",
    cobra: "🐍",
    snake: "🐍",

    // Big cats
    tiger: "🐅",
    lion: "🦁",
    leopard: "🐆",
    jaguar: "🐆",
    panther: "🐆",
    lynx: "🐱",

    // Hoofed animals
    deer: "🦌",
    elk: "🦌",
    bison: "🦬",
    horse: "🐴",

    // Canines
    wolf: "🐺",
    fox: "🦊",

    // Other mammals
    bear: "🐻",
    otter: "🦦",
    squirrel: "🐿️",

    // Mythical
    dragon: "🐉",
};

const bigCatSet = new Set(["tiger", "lion", "leopard", "jaguar", "panther", "lynx"]);
const birdSet = new Set(["eagle", "hawk", "owl", "raven", "falcon", "crane", "swan", "phoenix"]);
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

export const Avatar: React.FC<AvatarProps> = ({
    id,
    name,
    size = 32,
    className = "",
    showTooltip = true,
    colorIndexOverride,
    useAnimalIcon = true
}) => {
    const getColorForPlayer = React.useCallback(
        (playerId: string): string => {
            if (typeof colorIndexOverride === "number") {
                const c = CURSOR_COLORS[colorIndexOverride % CURSOR_COLORS.length];
                return `#${c.getHexString()}`;
            }
            let hash = 5381;
            for (let i = 0; i < playerId.length; i++) {
                hash = (hash * 33) ^ playerId.charCodeAt(i);
            }
            const index = Math.abs(hash) % CURSOR_COLORS.length;
            return `#${CURSOR_COLORS[index].getHexString()}`;
        },
        [colorIndexOverride]
    );

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
    const initials = getInitials(name, id);

    let animalEmoji: string | undefined;
    if (useAnimalIcon && name) {
        const tokens = name.split(/[\s,_-]+/);
        for (const token of tokens) {
            if (!token) continue;
            const emoji = getAnimalEmoji(token);
            if (emoji) {
                animalEmoji = emoji;
                break;
            }
        }
    }

    const tooltip = showTooltip
        ? name?.length
            ? name
            : `User ${initials}`
        : undefined;

    return (
        <div
            className={`rounded-full border border-white/80 flex items-center justify-center font-medium text-white shadow-sm select-none ${className}`}
            style={{
                backgroundColor: color,
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                lineHeight: `${size}px`,
                fontSize: size < 32 ? 10 : 12
            }}
            title={tooltip || undefined}
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
};