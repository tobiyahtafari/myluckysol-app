import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import newCountdownAudio from "@assets/countdownmusic_1771993635834.MP3";

interface CountdownTimerProps {
  targetTime: number;
  serverTime?: number;
  onComplete?: () => void;
  size?: "sm" | "md" | "lg";
  enableSound?: boolean;
  playMusic?: boolean;
}

export function CountdownTimer({ targetTime, serverTime, onComplete, size = "md", enableSound = false, playMusic = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTickedSecond = useRef<number>(-1);
  const pendingPlayRef = useRef(false);
  const hasStartedRef = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (pendingPlayRef.current && bgMusicAudioRef.current && !isMuted) {
        bgMusicAudioRef.current.play().catch(() => {});
        pendingPlayRef.current = false;
      }
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [isMuted]);

  useEffect(() => {
    if (enableSound) {
      tickAudioRef.current = new Audio("/sounds/tick.wav");
      tickAudioRef.current.volume = 0.4;
    }
    if (playMusic) {
      bgMusicAudioRef.current = new Audio(newCountdownAudio);
      bgMusicAudioRef.current.loop = false;
      bgMusicAudioRef.current.volume = 0.65;
    }

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
  }, [enableSound, playMusic]);

  const tryPlayMusic = useCallback(() => {
    if (!bgMusicAudioRef.current || isMuted) return;
    if (bgMusicAudioRef.current.paused) {
      const playPromise = bgMusicAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          pendingPlayRef.current = true;
        });
      }
    }
  }, [isMuted]);

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

      // Start music when timer begins, never pause it due to timer ending
      if (playMusic && bgMusicAudioRef.current && !isMuted && !hasStartedRef.current && remaining > 0) {
        hasStartedRef.current = true;
        tryPlayMusic();
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
  }, [targetTime, serverTime, onComplete, enableSound, playMusic, playTick, tryPlayMusic, isMuted]);

  // Sync mute/unmute with music
  useEffect(() => {
    if (bgMusicAudioRef.current) {
      if (isMuted) {
        bgMusicAudioRef.current.pause();
      } else {
        hasStartedRef.current = true;
        tryPlayMusic();
      }
    }
  }, [isMuted, tryPlayMusic]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const sizeClasses = {
    sm: { container: "w-16 h-16", text: "text-xl", ring: "p-[3px]" },
    md: { container: "w-24 h-24", text: "text-3xl", ring: "p-[4px]" },
    lg: { container: "w-36 h-36", text: "text-5xl", ring: "p-[5px]" },
  };

  const isUrgent = timeLeft <= 5;
  const isWarning = timeLeft <= 10 && !isUrgent;

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
        {(enableSound || playMusic) && (
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
