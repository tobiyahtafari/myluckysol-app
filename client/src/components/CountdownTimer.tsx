import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownTimerProps {
  targetTime: number;
  serverTime?: number;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
}

export function CountdownTimer({ targetTime, serverTime, onComplete, size = "md" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    // Calculate the offset between server time and client time
    // If serverTime is provided, use it to sync; otherwise fall back to local time
    const clockOffset = serverTime ? (serverTime - Date.now()) : 0;
    
    const updateTimer = () => {
      // Adjust client time by the offset to sync with server
      const adjustedNow = Date.now() + clockOffset;
      const remaining = Math.max(0, Math.floor((targetTime - adjustedNow) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && onComplete) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetTime, serverTime, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const sizeClasses = {
    sm: { container: "w-16 h-16", text: "text-xl", ring: "p-[3px]" },
    md: { container: "w-24 h-24", text: "text-3xl", ring: "p-[4px]" },
    lg: { container: "w-36 h-36", text: "text-5xl", ring: "p-[5px]" },
  };

  const isUrgent = timeLeft <= 10;
  const isWarning = timeLeft <= 30 && !isUrgent;

  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={Math.floor(timeLeft / 10)}
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`${sizeClasses[size].ring} rounded-full ${
            isUrgent 
              ? "bg-gradient-to-br from-red-500 via-orange-500 to-red-600 timer-urgent-glow animate-countdown" 
              : "timer-ring-gradient timer-glow"
          }`}
        >
          <div 
            className={`${sizeClasses[size].container} rounded-full bg-background flex items-center justify-center relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10" />
            <motion.span 
              key={timeLeft}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`font-mono font-bold relative z-10 ${sizeClasses[size].text} ${
                isUrgent 
                  ? "text-red-400" 
                  : isWarning 
                  ? "text-amber-400" 
                  : "text-gradient-solana"
              }`}
            >
              {minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : seconds}
            </motion.span>
          </div>
        </motion.div>
      </AnimatePresence>

      <p className={`text-sm font-medium ${
        isUrgent ? "text-red-400 animate-pulse" : isWarning ? "text-amber-400" : "text-muted-foreground"
      }`}>
        {isUrgent ? "Final seconds!" : isWarning ? "Time running out..." : "Time remaining"}
      </p>
    </div>
  );
}
