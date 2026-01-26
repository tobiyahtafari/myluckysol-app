import { Link } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet-context";
import { Gamepad2, Shield, Zap, Users, Trophy, Coins } from "lucide-react";
import { WalletModal } from "@/components/WalletModal";
import heroLogo from "@assets/myluckysol-logo_1768583810647.png";

export default function Home() {
  const { connected } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const features = [
    {
      icon: Shield,
      title: "Provably Fair",
      description: "VRF-powered randomness ensures every outcome is verifiable and tamper-proof",
      color: "from-purple-500 to-violet-600",
    },
    {
      icon: Zap,
      title: "Instant Payouts",
      description: "Winners receive 90% of the pool automatically, no manual claiming required",
      color: "from-amber-500 to-orange-600",
    },
    {
      icon: Users,
      title: "Multiple Modes",
      description: "Choose from 1v1 battles to 16-player tournaments across 4 game modes",
      color: "from-cyan-400 to-blue-600",
    },
    {
      icon: Coins,
      title: "Earn WAGA",
      description: "Get WAGA tokens on every entry and massive bonuses when you win",
      color: "from-emerald-400 to-green-600",
    },
  ];

  const stats = [
    { value: "10K+", label: "Games Played" },
    { value: "500+", label: "SOL Won" },
    { value: "2K+", label: "Players" },
    { value: "99.9%", label: "Uptime" },
  ];

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="container mx-auto px-4 relative">
          <div className="flex flex-col items-center gap-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="relative w-full max-w-xs md:max-w-sm mx-auto mb-0"
            >
              <div className="absolute inset-0 gradient-solana blur-3xl opacity-30 rounded-full scale-110" />
              <img
                src={heroLogo}
                alt="MyLuckySol"
                className="relative w-full animate-float"
                data-testid="img-hero-logo"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center mt-[-2rem] w-full"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Test Your Luck on{" "}
                <span className="text-gradient-solana">Solana</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
                The ultimate provably fair chance game. One button, instant results, 
                guaranteed payouts. Win SOL and earn WAGA tokens.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {connected ? (
                  <Link href="/play">
                    <Button size="lg" className="gap-2 text-lg px-8" data-testid="button-play-now">
                      <Gamepad2 className="w-5 h-5" />
                      Play Now
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="lg" 
                    onClick={() => setWalletModalOpen(true)} 
                    className="gap-2 text-lg px-8" 
                    data-testid="button-connect-play"
                  >
                    <Gamepad2 className="w-5 h-5" />
                    Connect & Play
                  </Button>
                )}
                <Link href="/leaderboard">
                  <Button size="lg" variant="outline" className="gap-2" data-testid="button-leaderboard">
                    <Trophy className="w-5 h-5" />
                    Leaderboard
                  </Button>
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="text-center"
                  >
                    <p className="text-2xl md:text-3xl font-bold text-gradient-gold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose <span className="text-gradient-gold">MyLuckySol</span>?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built on Solana for lightning-fast transactions and powered by VRF for 
              truly random, provably fair outcomes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full p-6 game-card-hover">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to start playing and winning
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Connect Wallet", desc: "Connect your Solana wallet (Phantom, OKX, Solflare, etc.)" },
              { step: "2", title: "Choose & Wager", desc: "Select a game mode and wager amount (0.01 - 10 SOL)" },
              { step: "3", title: "Win & Earn", desc: "Winners get 90% of the pool + WAGA token rewards" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4 glow-gold">
                  <span className="text-2xl font-bold text-black">{item.step}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-primary/10 to-secondary/10">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Test Your Luck?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of players winning SOL every day on the most trusted 
              Solana gaming platform.
            </p>
            {connected ? (
              <Link href="/play">
                <Button size="lg" className="gap-2 text-lg px-8" data-testid="button-start-playing">
                  <Gamepad2 className="w-5 h-5" />
                  Start Playing
                </Button>
              </Link>
            ) : (
              <Button 
                size="lg" 
                onClick={() => setWalletModalOpen(true)} 
                className="gap-2 text-lg px-8" 
                data-testid="button-connect-cta"
              >
                <Gamepad2 className="w-5 h-5" />
                Connect Wallet to Play
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />

      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Built on Solana. Powered by Switchboard VRF.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
