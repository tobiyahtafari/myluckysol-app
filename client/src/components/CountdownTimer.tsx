import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownTimerProps {
  targetTime: number;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
}

export function CountdownTimer({ targetTime, onComplete, size = "md" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((targetTime - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && onComplete) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const sizeClasses = {
    sm: "text-2xl w-16 h-16",
    md: "text-4xl w-24 h-24",
    lg: "text-6xl w-36 h-36",
  };

  const urgencyColor = timeLeft <= 10 
    ? "text-destructive" 
    : timeLeft <= 30 
    ? "text-amber-500" 
    : "text-primary";

  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={timeLeft}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`${sizeClasses[size]} rounded-full border-4 ${
            timeLeft <= 10 ? "border-destructive" : "border-primary"
          } flex items-center justify-center bg-card ${
            timeLeft <= 10 ? "animate-countdown" : ""
          }`}
        >
          <span className={`font-mono font-bold ${urgencyColor}`}>
            {minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : seconds}
          </span>
        </motion.div>
      </AnimatePresence>

      <p className="text-sm text-muted-foreground">
        {timeLeft <= 10 ? "Hurry!" : timeLeft <= 30 ? "Time running out..." : "Time remaining"}
      </p>
    </div>
  );
}
