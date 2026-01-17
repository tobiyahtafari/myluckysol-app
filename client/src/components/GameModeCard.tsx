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
  "1v1": "from-[#FFD700] via-[#FFA500] to-[#FF8C00]",
  "2-round": "from-[#9945FF] via-[#DC1FFF] to-[#9945FF]",
  "3-round": "from-[#03E1FF] via-[#00FFA3] to-[#03E1FF]",
  "4-round": "from-[#00FFA3] via-[#03E1FF] to-[#9945FF]",
};

const modeBorderColors: Record<GameModeKey, string> = {
  "1v1": "border-[#FFD700]/50 hover:border-[#FFD700]",
  "2-round": "border-[#9945FF]/50 hover:border-[#9945FF]",
  "3-round": "border-[#03E1FF]/50 hover:border-[#03E1FF]",
  "4-round": "border-[#00FFA3]/50 hover:border-[#00FFA3]",
};

const modeGlows: Record<GameModeKey, string> = {
  "1v1": "shadow-[0_0_20px_rgba(255,215,0,0.3)]",
  "2-round": "shadow-[0_0_20px_rgba(153,69,255,0.3)]",
  "3-round": "shadow-[0_0_20px_rgba(3,225,255,0.3)]",
  "4-round": "shadow-[0_0_20px_rgba(0,255,163,0.3)]",
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
        className={`relative cursor-pointer overflow-visible transition-all duration-300 game-card-hover ${modeBorderColors[mode]} ${
          isSelected
            ? `ring-2 ring-primary ${modeGlows[mode]}`
            : ""
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

        </div>
      </Card>
    </motion.div>
  );
}
