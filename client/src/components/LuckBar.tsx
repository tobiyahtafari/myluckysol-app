import { motion } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LuckBarProps {
  score: number;
  showPercentile?: boolean;
  size?: "sm" | "md" | "lg";
}

function getLuckLabel(score: number): { label: string; color: string } {
  if (score === 0) return { label: "Unranked", color: "text-muted-foreground" };
  if (score >= 90) return { label: "Legendary", color: "text-amber-400" };
  if (score >= 75) return { label: "Very Lucky", color: "text-green-400" };
  if (score >= 60) return { label: "Lucky", color: "text-emerald-400" };
  if (score >= 45) return { label: "Average", color: "text-blue-400" };
  if (score >= 30) return { label: "Unlucky", color: "text-orange-400" };
  return { label: "Cursed", color: "text-red-400" };
}

export function LuckBar({ score, showPercentile = true, size = "md" }: LuckBarProps) {
  const { label, color } = getLuckLabel(score);
  const clampedScore = Math.max(0, Math.min(100, score));
  const isUnranked = score === 0;

  const heightClass = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("w-5 h-5", isUnranked ? "text-muted-foreground" : "text-primary")} />
          <span className="font-semibold">Luck Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${color}`}>{isUnranked ? label : `${score}%`}</span>
          {!isUnranked && (
            score >= 50 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )
          )}
        </div>
      </div>

      <div className={`relative w-full ${heightClass[size]} rounded-full bg-muted overflow-hidden`}>
        {!isUnranked && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clampedScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, 
                hsl(0, 70%, 50%) 0%, 
                hsl(30, 80%, 50%) 25%, 
                hsl(60, 90%, 50%) 50%, 
                hsl(120, 70%, 45%) 75%, 
                hsl(45, 95%, 55%) 100%
              )`,
            }}
          />
        )}

        {!isUnranked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute inset-y-0 flex items-center"
            style={{ left: `calc(${clampedScore}% - 8px)` }}
          >
            <div className="w-4 h-4 rounded-full bg-white shadow-lg border-2 border-primary" />
          </motion.div>
        )}
      </div>

      {showPercentile && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span className="text-center">
            {isUnranked ? "Play a game to reveal your luck" : `${clampedScore}%`}
          </span>
          <span>100</span>
        </div>
      )}
    </div>
  );
}
