import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Gamepad2, Trophy, Coins, ShieldCheck, Wallet, ArrowRight, MousePointerClick } from "lucide-react";

export default function HowToPlay() {
  const steps = [
    {
      icon: Wallet,
      title: "1. Connect Your Wallet",
      description: "Click the 'Connect Wallet' button in the header. We support Phantom, OKX, Solflare, and Backpack wallets on the Solana network.",
    },
    {
      icon: MousePointerClick,
      title: "2. Choose Your Game Mode",
      description: "Head to the 'Play' page and select from four exciting modes: 1v1, 2-Round, 3-Round, or 4-Round. Higher rounds mean bigger potential SOL multipliers!",
    },
    {
      icon: Coins,
      title: "3. Select Your Wager",
      description: "Choose your entry fee from the available tiers (0.01, 0.1, 1, or 10 SOL). All wagers are held securely in a program-controlled escrow (PDA) on-chain.",
    },
    {
      icon: ShieldCheck,
      title: "4. Wait for Players",
      description: "Once you join, wait for the lobby to fill. A 10-second countdown will begin as soon as the last player joins.",
    },
    {
      icon: Gamepad2,
      title: "5. Play & Win",
      description: "Each round eliminates half the players using HMAC-SHA256 provably fair randomness. Survive all rounds to win 90% of the total game pool!",
    },
    {
      icon: Trophy,
      title: "6. Earn WAGA Rewards",
      description: "Every player earns WAGA tokens just for joining (100x match). Winners get an additional 1000x match bonus, which vests daily to ensure long-term value.",
    },
  ];

  return (
    <div className="min-h-screen py-12 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
      
      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            How to <span className="text-gradient-gold">Play</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            New to MyLuckySol? Follow this simple guide to start your provably fair gaming journey on Solana.
          </p>
        </motion.div>

        <div className="grid gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="p-6 border-2 border-primary/10 hover:border-primary/30 transition-all flex flex-col md:flex-row gap-6 items-start">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-16 text-center"
        >
          <Card className="p-8 bg-primary/10 border-primary/20">
            <h2 className="text-2xl font-bold mb-4">Ready to start?</h2>
            <p className="text-muted-foreground mb-8">
              Experience lightning-fast transactions and guaranteed fairness today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/play" className="inline-block">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-bold flex items-center gap-2 mx-auto"
                >
                  <Gamepad2 className="w-5 h-5" />
                  Enter Lobby
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </a>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
