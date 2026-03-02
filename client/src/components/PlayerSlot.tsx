import { motion } from "framer-motion";
import { User, Flame, Droplets } from "lucide-react";
import type { Player } from "@shared/schema";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface PlayerSlotProps {
  player: Player | null;
  index: number;
  isCurrentUser?: boolean;
  isWinner?: boolean;
  isEliminated?: boolean;
  isGodStreak?: boolean;
  isStreakBreaker?: boolean;
}

export function PlayerSlot({ player, index, isCurrentUser, isWinner, isEliminated, isGodStreak, isStreakBreaker }: PlayerSlotProps) {
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

  const displayName = player.username || player.displayName || shortAddress;

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
          : isGodStreak
          ? "border-orange-500/60 bg-orange-500/10"
          : isStreakBreaker
          ? "border-blue-500/60 bg-blue-500/10"
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
          <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </motion.div>
      )}

      {/* God Streak fire badge */}
      {isGodStreak && !isWinner && !isEliminated && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-3 -right-3"
        >
          <div className="w-7 h-7 rounded-full bg-orange-500/90 border-2 border-orange-400 flex items-center justify-center god-fire-border">
            <Flame className="w-4 h-4 text-white" />
          </div>
        </motion.div>
      )}

      {/* Streak Breaker water badge */}
      {isStreakBreaker && !isWinner && !isEliminated && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-3 -right-3"
        >
          <div className="w-7 h-7 rounded-full bg-blue-500/90 border-2 border-blue-400 flex items-center justify-center streak-water-border">
            <Droplets className="w-4 h-4 text-white" />
          </div>
        </motion.div>
      )}

      <div className={`relative ${isGodStreak ? "god-fire-border rounded-full" : isStreakBreaker ? "streak-water-border rounded-full" : ""}`}>
        <Avatar className={`w-12 h-12 border-2 ${
          isWinner ? "border-primary" : 
          isGodStreak ? "border-orange-500/70" : 
          isStreakBreaker ? "border-blue-500/70" :
          isCurrentUser ? "border-accent" : "border-muted"
        }`}>
          {player.avatarUrl ? (
            <AvatarImage src={player.avatarUrl || undefined} alt={displayName || undefined} className="object-cover" />
          ) : null}
          <AvatarFallback className={
            isWinner
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
              : isGodStreak
              ? "bg-gradient-to-br from-orange-500 to-red-600 text-white"
              : isStreakBreaker
              ? "bg-gradient-to-br from-blue-400 to-cyan-500 text-white"
              : isCurrentUser
              ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white"
              : "bg-gradient-to-br from-purple-400 to-violet-500 text-white"
          }>
            {displayName?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium truncate max-w-[100px]">
          {displayName}
        </p>
        {isCurrentUser && !isGodStreak && !isStreakBreaker && (
          <span className="text-xs text-accent">(You)</span>
        )}
        {isGodStreak && (
          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">GOD</span>
        )}
        {isStreakBreaker && (
          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">BREAKER</span>
        )}
        {isEliminated && (
          <span className="text-xs text-destructive">Eliminated</span>
        )}
      </div>
    </motion.div>
  );
}
