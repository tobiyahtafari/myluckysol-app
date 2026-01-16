import { motion } from "framer-motion";
import { User } from "lucide-react";
import type { Player } from "@shared/schema";

interface PlayerSlotProps {
  player: Player | null;
  index: number;
  isCurrentUser?: boolean;
  isWinner?: boolean;
  isEliminated?: boolean;
}

export function PlayerSlot({ player, index, isCurrentUser, isWinner, isEliminated }: PlayerSlotProps) {
  const shortAddress = player?.walletAddress
    ? `${player.walletAddress.slice(0, 4)}...${player.walletAddress.slice(-4)}`
    : null;

  if (!player) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-muted bg-muted/20"
      >
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">Waiting...</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
        isWinner
          ? "border-primary bg-primary/20 glow-gold animate-winner"
          : isEliminated
          ? "border-destructive/50 bg-destructive/10 opacity-60"
          : isCurrentUser
          ? "border-accent bg-accent/10"
          : "border-border bg-card"
      }`}
      data-testid={`player-slot-${index}`}
    >
      {isWinner && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="absolute -top-3 -right-3 text-2xl"
        >
          <span role="img" aria-label="trophy">
            <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </span>
        </motion.div>
      )}

      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center ${
          isWinner
            ? "bg-gradient-to-br from-amber-400 to-orange-500"
            : isCurrentUser
            ? "bg-gradient-to-br from-emerald-400 to-green-500"
            : "bg-gradient-to-br from-purple-400 to-violet-500"
        }`}
      >
        <span className="text-white font-bold text-lg">
          {(player.displayName || player.walletAddress).charAt(0).toUpperCase()}
        </span>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium truncate max-w-[100px]">
          {player.displayName || shortAddress}
        </p>
        {isCurrentUser && (
          <span className="text-xs text-accent">(You)</span>
        )}
        {isEliminated && (
          <span className="text-xs text-destructive">Eliminated</span>
        )}
      </div>
    </motion.div>
  );
}
