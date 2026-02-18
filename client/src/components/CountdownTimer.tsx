import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CountdownTimerProps {
  targetTime: number;
  serverTime?: number;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  enableSound?: boolean;
}

export function CountdownTimer({ targetTime, serverTime, onComplete, size = "md", enableSound = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTickedSecond = useRef<number>(-1);

  useEffect(() => {
    if (enableSound) {
      tickAudioRef.current = new Audio("/sounds/tick.wav");
      tickAudioRef.current.volume = 0.4;
      
      bgMusicAudioRef.current = new Audio("/sounds/bgmusic.mp3");
      bgMusicAudioRef.current.loop = false;
      bgMusicAudioRef.current.volume = 0.3;
    }
  }, [enableSound]);

  const playTick = useCallback(() => {
    if (!isMuted && enableSound && tickAudioRef.current) {
      tickAudioRef.current.currentTime = 0;
      tickAudioRef.current.play().catch(() => {});
    }
  }, [isMuted, enableSound]);

  useEffect(() => {
    const clockOffset = serverTime ? (serverTime - Date.now()) : 0;
    
    const updateTimer = () => {
      const adjustedNow = Date.now() + clockOffset;
      const remaining = Math.max(0, Math.floor((targetTime - adjustedNow) / 1000));
      setTimeLeft(remaining);

      // Handle background music
      if (enableSound && bgMusicAudioRef.current) {
        if (!isMuted && remaining > 0) {
          if (bgMusicAudioRef.current.paused) {
            bgMusicAudioRef.current.play().catch(() => {});
          }
        } else {
          bgMusicAudioRef.current.pause();
        }
      }

      if (enableSound && remaining <= 10 && remaining > 0 && remaining !== lastTickedSecond.current) {
        lastTickedSecond.current = remaining;
        playTick();
      }

      if (remaining === 0 && onComplete) {
        onComplete();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 200);

    return () => clearInterval(interval);
  }, [targetTime, serverTime, onComplete, enableSound, playTick]);

  useEffect(() => {
    return () => {
      if (tickAudioRef.current) {
        tickAudioRef.current.pause();
        tickAudioRef.current = null;
      }
      if (bgMusicAudioRef.current) {
        bgMusicAudioRef.current.pause();
        bgMusicAudioRef.current = null;
      }
    };
  }, []);

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

      <div className="flex items-center gap-3">
        <p className={`text-sm font-medium ${
          isUrgent ? "text-red-400 animate-pulse" : isWarning ? "text-amber-400" : "text-muted-foreground"
        }`}>
          {isUrgent ? "Final seconds!" : isWarning ? "Time running out..." : "Time remaining"}
        </p>
        {enableSound && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMuted(!isMuted)}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            data-testid="button-mute-countdown"
          >
            {isMuted ? <VolumeX className="w-3 h-3 mr-1" /> : <Volume2 className="w-3 h-3 mr-1" />}
            {isMuted ? "Unmute" : "Mute"}
          </Button>
        )}
      </div>
    </div>
  );
}
