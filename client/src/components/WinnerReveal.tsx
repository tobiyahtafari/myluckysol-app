import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface WinnerRevealProps {
  winnerAddress: string;
  payout: number;
  wagaReward: number;
  isCurrentUserWinner: boolean;
  onClose: () => void;
}

export function WinnerReveal({
  winnerAddress,
  payout,
  wagaReward,
  isCurrentUserWinner,
  onClose,
}: WinnerRevealProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isCurrentUserWinner) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isCurrentUserWinner]);

  const shortAddress = `${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  top: "-10%",
                  left: `${Math.random() * 100}%`,
                  rotate: 0,
                }}
                animate={{
                  top: "110%",
                  rotate: 720,
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: "easeIn",
                }}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ["#FFD700", "#9945FF", "#00FFA3", "#03E1FF", "#DC1FFF"][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            ))}
          </div>
        )}

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: "spring", damping: 15 }}
          className="relative bg-card border border-card-border rounded-2xl p-8 max-w-md mx-4 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isCurrentUserWinner && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="absolute -top-6 left-1/2 -translate-x-1/2"
            >
              <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center glow-gold">
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
            </motion.div>
          )}

          <div className="mt-4 mb-6">
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-3xl font-bold mb-2 ${
                isCurrentUserWinner ? "text-gradient-gold" : ""
              }`}
            >
              {isCurrentUserWinner ? "You Won!" : "Winner Revealed!"}
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground"
            >
              {shortAddress}
            </motion.p>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-4 mb-6"
          >
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-sm text-muted-foreground mb-1">Payout</p>
              <p className="text-3xl font-bold text-gradient-gold">{payout.toFixed(4)} SOL</p>
            </div>

            <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30">
              <p className="text-sm text-muted-foreground mb-1">WAGA Earned</p>
              <p className="text-2xl font-bold text-secondary">+{wagaReward.toLocaleString()} WAGA</p>
            </div>
          </motion.div>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={onClose}
            className="w-full py-3 px-6 rounded-xl gradient-gold text-black font-semibold hover:opacity-90 transition-opacity"
            data-testid="button-close-winner"
          >
            {isCurrentUserWinner ? "Awesome!" : "Continue"}
          </motion.button>
          {isCurrentUserWinner && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-muted-foreground mt-3"
            >
              Rewards sent to your wallet automatically
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
