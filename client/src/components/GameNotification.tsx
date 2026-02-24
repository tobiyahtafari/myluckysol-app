import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGameStore } from "@/lib/game-store";
import { GAME_MODES, type Game, type GameModeKey, type WagerTier } from "@shared/schema";
import { Users, Gamepad2, X } from "lucide-react";

interface GameNotif {
  id: string;
  game: Game;
  timestamp: number;
}

function createNotificationSound(): () => void {
  return () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      setTimeout(() => ctx.close(), 500);
    } catch {}
  };
}

export function GameNotificationManager() {
  const [notifications, setNotifications] = useState<GameNotif[]>([]);
  const seenGameIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);
  const [, setLocation] = useLocation();
  const { setSelectedMode, setSelectedWager, setPlayTab } = useGameStore();
  const playSound = useRef(createNotificationSound());

  const { data: liveGames } = useQuery<Game[]>({
    queryKey: ["/api/games/live"],
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!liveGames) return;

    if (initialLoad.current) {
      liveGames.forEach(g => seenGameIds.current.add(g.id));
      initialLoad.current = false;
      return;
    }

    const newGames = liveGames.filter(
      g => g.status === "waiting" && !seenGameIds.current.has(g.id)
    );

    if (newGames.length > 0) {
      newGames.forEach(g => seenGameIds.current.add(g.id));

      const newNotifs: GameNotif[] = newGames.map(g => ({
        id: g.id,
        game: g,
        timestamp: Date.now(),
      }));

      setNotifications(prev => [...newNotifs, ...prev].slice(0, 5));
      playSound.current();
    }
  }, [liveGames]);

  useEffect(() => {
    if (notifications.length === 0) return;

    const timer = setTimeout(() => {
      setNotifications(prev => {
        const now = Date.now();
        return prev.filter(n => now - n.timestamp < 7000);
      });
    }, 7000);

    return () => clearTimeout(timer);
  }, [notifications]);

  const handleClick = useCallback((game: Game) => {
    setSelectedMode(game.mode as GameModeKey);
    setSelectedWager(game.wager as WagerTier);
    setPlayTab("join");
    setLocation("/play");

    setNotifications(prev => prev.filter(n => n.id !== game.id));
  }, [setSelectedMode, setSelectedWager, setPlayTab, setLocation]);

  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-md px-4 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => {
          const config = GAME_MODES[notif.game.mode as GameModeKey];
          const playersNeeded = config.players - notif.game.players.length;
          return (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={() => handleClick(notif.game)}
              className="w-full pointer-events-auto cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-background/95 backdrop-blur-xl shadow-[0_0_20px_rgba(245,184,0,0.15)] hover:border-primary/60 transition-colors">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-secondary to-primary" />
                <div className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                    <Gamepad2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      New {config.name} Game
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-primary font-semibold">{notif.game.wager} SOL</span>
                      <span className="mx-1.5">-</span>
                      <Users className="w-3 h-3 inline mb-0.5" />
                      <span className="ml-0.5">{playersNeeded} player{playersNeeded !== 1 ? "s" : ""} needed</span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDismiss(notif.id, e)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                    data-testid={`button-dismiss-notif-${notif.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
