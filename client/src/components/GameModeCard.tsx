import { motion } from "framer-motion";
import { Users, Clock, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GAME_MODES, type GameModeKey } from "@shared/schema";

interface GameModeCardProps {
  mode: GameModeKey;
  isSelected: boolean;
  onSelect: (mode: GameModeKey) => void;
}

const modeIcons: Record<GameModeKey, string> = {
  "1v1": "vs",
  "2-round": "2R",
  "3-round": "3R",
  "4-round": "4R",
};

const modeColors: Record<GameModeKey, string> = {
  "1v1": "from-amber-500 to-orange-600",
  "2-round": "from-purple-500 to-violet-600",
  "3-round": "from-cyan-400 to-blue-600",
  "4-round": "from-emerald-400 to-green-600",
};

export function GameModeCard({ mode, isSelected, onSelect }: GameModeCardProps) {
  const config = GAME_MODES[mode];
  const gradient = modeColors[mode];

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(mode)}
    >
      <Card
        className={`relative cursor-pointer overflow-visible transition-all duration-300 game-card-hover ${
          isSelected
            ? "ring-2 ring-primary glow-gold"
            : "hover:border-primary/50"
        }`}
        data-testid={`card-mode-${mode}`}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div
              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <span className="text-xl font-bold text-white">{modeIcons[mode]}</span>
            </div>
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </div>

          <h3 className="text-lg font-semibold mb-3">{config.name}</h3>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{config.players} Players</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="w-4 h-4" />
              <span>{config.rounds} Round{config.rounds > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{config.timer}s Timer</span>
            </div>
          </div>

          {config.rounds > 1 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Winnings auto-roll forward each round
              </p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
