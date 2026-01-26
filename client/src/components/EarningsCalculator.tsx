import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { WAGER_TIERS, GAME_MODES, type GameModeKey } from "@shared/schema";
import { SolToUsd } from "@/lib/price-context";
import { Coins, Target, Clock, TrendingUp } from "lucide-react";

export function EarningsCalculator() {
  const [wager, setWager] = useState<number>(1);
  const [mode, setMode] = useState<GameModeKey>("1v1");

  const multipliers: Record<GameModeKey, number> = {
    "1v1": 1.8,
    "2-round": 3.6,
    "3-round": 7.2,
    "4-round": 14.4,
  };

  const potentialEarnings = wager * multipliers[mode];
  const config = GAME_MODES[mode];

  return (
    <Card className="p-8 bg-card/50 border-primary/20 backdrop-blur-sm max-w-4xl mx-auto overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <TrendingUp className="w-24 h-24" />
      </div>
      
      <div className="grid lg:grid-cols-2 gap-12 relative z-10">
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              1. Select Wager Amount
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-3xl font-black text-gradient-gold">{wager} SOL</span>
                <SolToUsd sol={wager} className="text-lg opacity-70" />
              </div>
              <Slider
                value={[wager]}
                min={0.01}
                max={10}
                step={0.01}
                onValueChange={(val) => setWager(val[0])}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.01 SOL</span>
                <span>5 SOL</span>
                <span>10 SOL</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-secondary" />
              2. Select Game Mode
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(GAME_MODES) as GameModeKey[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    mode === m
                      ? "border-primary bg-primary/10 glow-gold"
                      : "border-border bg-card/50 hover:border-primary/30"
                  }`}
                >
                  <p className="font-bold text-sm">{GAME_MODES[m].name}</p>
                  <p className="text-xs text-muted-foreground">{multipliers[m]}x Multiplier</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent border border-white/10 text-center space-y-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Potential Winnings</p>
              <motion.p 
                key={potentialEarnings}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl md:text-6xl font-black text-gradient-gold tracking-tight"
              >
                {potentialEarnings.toFixed(3)} SOL
              </motion.p>
              <SolToUsd sol={potentialEarnings} className="text-xl font-medium opacity-80" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Win Chance</p>
                <p className="text-lg font-bold text-accent">
                  {mode === "1v1" ? "50%" : mode === "2-round" ? "25%" : mode === "3-round" ? "12.5%" : "6.25%"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" /> Duration
                </p>
                <p className="text-lg font-bold text-primary">
                  {mode === "1v1" ? "90s" : mode === "2-round" ? "180s" : mode === "3-round" ? "360s" : "720s"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
