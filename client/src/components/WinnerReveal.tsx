import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Trophy, Skull } from "lucide-react";

interface WinnerRevealProps {
  winnerAddress: string;
  winnerUsername?: string;
  payout: number;
  wagaReward: number;
  isCurrentUserWinner: boolean;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#FFD700", "#9945FF", "#00FFA3", "#03E1FF", "#DC1FFF", "#FF6B35", "#fff"];
const CONFETTI_COUNT = 80;

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.12 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.25);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch {}
}

function playLoseSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [330, 277, 233, 196];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sawtooth";
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.35);
    });
  } catch {}
}

function ConfettiPiece({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = `${Math.random() * 100}%`;
  const size = 6 + Math.random() * 8;
  const duration = 2.2 + Math.random() * 2;
  const delay = Math.random() * 0.8;
  const isRect = index % 3 !== 0;

  return (
    <motion.div
      initial={{ top: "-8%", left, rotate: 0, opacity: 1 }}
      animate={{ top: "108%", rotate: 720 + Math.random() * 360, opacity: [1, 1, 0.8, 0] }}
      transition={{ duration, delay, ease: "easeIn" }}
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: isRect ? size * 0.45 : size,
        backgroundColor: color,
        borderRadius: isRect ? 2 : "50%",
      }}
    />
  );
}

export function WinnerReveal({
  winnerAddress,
  winnerUsername,
  payout,
  wagaReward,
  isCurrentUserWinner,
  onClose,
}: WinnerRevealProps) {
  const soundPlayedRef = useRef(false);
  const [autoCloseIn, setAutoCloseIn] = useState(10);

  const displayName = winnerUsername || `${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`;

  useEffect(() => {
    if (!soundPlayedRef.current) {
      soundPlayedRef.current = true;
      if (isCurrentUserWinner) {
        playWinSound();
      } else {
        playLoseSound();
      }
    }
  }, [isCurrentUserWinner]);

  // Auto-close countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setAutoCloseIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoCloseIn === 0) {
      onClose();
    }
  }, [autoCloseIn, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      >
        {isCurrentUserWinner && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>
        )}

        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.4, opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 14, stiffness: 200 }}
          className="relative bg-card border border-card-border rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon badge */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.15, type: "spring", damping: 10 }}
            className="absolute -top-7 left-0 right-0 flex justify-center"
          >
            {isCurrentUserWinner ? (
              <div className="w-14 h-14 rounded-full gradient-gold flex items-center justify-center glow-gold">
                <Trophy className="w-7 h-7 text-black" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center">
                <Skull className="w-7 h-7 text-destructive" />
              </div>
            )}
          </motion.div>

          <div className="mt-6 mb-5">
            <motion.h2
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-3xl font-bold mb-1 ${
                isCurrentUserWinner ? "text-gradient-gold" : "text-destructive"
              }`}
            >
              {isCurrentUserWinner ? "You Won!" : "You Lost"}
            </motion.h2>
            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
              className="text-muted-foreground text-sm"
            >
              {isCurrentUserWinner
                ? "Congratulations, the SOL is on its way."
                : `Winner: ${displayName}`}
            </motion.p>
          </div>

          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.26 }}
            className="space-y-3 mb-5"
          >
            <div className={`p-4 rounded-xl border ${isCurrentUserWinner ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border"}`}>
              <p className="text-xs text-muted-foreground mb-0.5">
                {isCurrentUserWinner ? "Payout" : "Winner's Payout"}
              </p>
              <p className={`text-2xl font-bold ${isCurrentUserWinner ? "text-gradient-gold" : "text-muted-foreground"}`}>
                {payout.toFixed(4)} SOL
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${isCurrentUserWinner ? "bg-secondary/10 border-secondary/30" : "bg-muted/20 border-border"}`}>
              <p className="text-xs text-muted-foreground mb-0.5">WAGA Earned This Game</p>
              <p className={`text-lg font-bold ${isCurrentUserWinner ? "text-secondary" : "text-muted-foreground"}`}>
                +{wagaReward.toLocaleString()} WAGA
              </p>
            </div>
          </motion.div>

          <motion.button
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.34 }}
            onClick={onClose}
            className={`w-full py-3 px-6 rounded-xl font-semibold transition-opacity hover:opacity-90 ${
              isCurrentUserWinner
                ? "gradient-gold text-black"
                : "bg-muted text-foreground border border-border"
            }`}
            data-testid="button-close-winner"
          >
            {isCurrentUserWinner ? "Awesome!" : "Play Again"}
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-muted-foreground/50 mt-3"
          >
            Closes in {autoCloseIn}s
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
