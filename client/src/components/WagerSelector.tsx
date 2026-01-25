import { motion } from "framer-motion";
import { WAGER_TIERS, WAGA_ENTRY_REWARD_PERCENT, type WagerTier } from "@shared/schema";
import { useWallet } from "@/lib/wallet-context";
import { useSolPrice, SolToUsd } from "@/lib/price-context";

interface WagerSelectorProps {
  selectedWager: WagerTier | null;
  onSelect: (wager: WagerTier) => void;
}

export function WagerSelector({ selectedWager, onSelect }: WagerSelectorProps) {
  const { balance, connected } = useWallet();
  const { solPrice } = useSolPrice();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-center">Select Wager Amount</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {WAGER_TIERS.map((wager) => {
          const isSelected = selectedWager === wager;
          const canAfford = !connected || balance >= wager;
          const rewardPercent = WAGA_ENTRY_REWARD_PERCENT[wager];

          return (
            <motion.button
              key={wager}
              whileHover={canAfford ? { scale: 1.02 } : {}}
              whileTap={canAfford ? { scale: 0.98 } : {}}
              onClick={() => canAfford && onSelect(wager)}
              disabled={!canAfford}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/10 glow-gold"
                  : canAfford
                  ? "border-border bg-card hover:border-primary/50"
                  : "border-border bg-card/50 opacity-50 cursor-not-allowed"
              }`}
              data-testid={`button-wager-${wager}`}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold text-gradient-gold">{wager}</span>
                    <span className="text-sm text-muted-foreground">SOL</span>
                  </div>
                  <SolToUsd sol={wager} className="text-sm" />
                </div>
                <div className="text-xs text-secondary">
                  {rewardPercent}% WAGA Reward
                </div>
              </div>

              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {connected && selectedWager && balance < selectedWager && (
        <p className="text-center text-sm text-destructive">
          Insufficient balance. You need {selectedWager} SOL to play.
        </p>
      )}
    </div>
  );
}
