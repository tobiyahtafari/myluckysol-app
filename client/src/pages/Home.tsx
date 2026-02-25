import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet-context";
import { Gamepad2, Shield, Zap, Users, Trophy, Coins, Play, RotateCcw } from "lucide-react";
import { WalletModal } from "@/components/WalletModal";
import { EarningsCalculator } from "@/components/EarningsCalculator";
import { useQuery } from "@tanstack/react-query";
import heroLogo from "@assets/myluckysol-logo_1768583810647.png";
import heroBgGif from "@assets/myluckysolbg_(1)_1771978388066.gif";

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 0 : value >= 1_000_000_000 ? 1 : 0).replace(/\.0$/, "")}B+`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 100_000_000 ? 0 : value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M+`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K+`;
  return value.toString();
}

function formatSolCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K+`;
  if (value >= 1) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2);
}

export default function Home() {
  const { connected } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    (window as any).onYouTubeIframeAPIReady = () => {
      // API is ready
    };

    // Add a global listener for the play button to ensure it works on all devices
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-testid="video-overlay"]')) {
        handlePlayClick();
      }
    };

    document.addEventListener('click', handleGlobalClick);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const onPlayerReady = (event: any) => {
    event.target.playVideo();
  };

  const onPlayerStateChange = (event: any) => {
    // YT.PlayerState.ENDED is 0
    if (event.data === 0) {
      setVideoEnded(true);
    }
  };

  const initPlayer = (elementId: string) => {
    if (window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player(elementId, {
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    }
  };

  const handlePlayClick = () => {
    setShowVideo(true);
    setVideoEnded(false);
    // On mobile, the player might need to be initialized immediately
    // and the first user gesture (the click) must be associated with the play() call
    setTimeout(() => {
      initPlayer('youtube-player');
    }, 50);
  };

  const handleReplayClick = () => {
    setVideoEnded(false);
    if (playerRef.current && playerRef.current.playVideo) {
      playerRef.current.playVideo();
    }
  };

  const { data: globalStats } = useQuery<{ gamesPlayed: number; solWon: number; playersCount: number; wagaRewarded: number }>({
    queryKey: ["/api/stats"],
    refetchInterval: 10000,
  });

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
      description: "100x WAGA match on entry, 1000x WAGA match for winners",
      color: "from-emerald-400 to-green-600",
    },
  ];

  const stats = [
    { value: globalStats ? formatCompact(globalStats.gamesPlayed) : "0", label: "Games Played" },
    { value: globalStats ? formatSolCompact(globalStats.solWon) : "0", label: "SOL Won" },
    { value: globalStats ? formatCompact(globalStats.playersCount) : "0", label: "Players" },
    { value: globalStats ? formatCompact(globalStats.wagaRewarded) : "0", label: "WAGA Rewarded" },
  ];

  return (
    <div className="min-h-screen">
      <div className="relative">
        {/* Combined Hero and Why Choose Section with Shared Background */}
        <div className="absolute inset-0 z-0 overflow-hidden flex items-start justify-center pt-[45rem] md:pt-[38rem] lg:pt-[35rem]">
          <div className="relative w-full h-auto">
            <img 
              src={heroBgGif} 
              alt="" 
              className="w-full min-w-full h-auto opacity-20 block"
              style={{ objectFit: 'contain' }}
            />
            {/* Top and Bottom Fades for the GIF */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent z-10" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
          </div>
          <div className="absolute inset-0 home-hero-grid" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        </div>

        <section className="relative overflow-hidden py-20 lg:py-32 z-10">
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

                <div className="mt-12 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  {stats.slice(0, 2).map((stat, i) => (
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
                  {stats.slice(2).map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
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

        <section className="py-20 relative z-10">
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-16 max-w-4xl mx-auto"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl group cursor-pointer" onClick={!showVideo ? handlePlayClick : undefined} data-testid="video-overlay">
                <AnimatePresence mode="wait">
                  {!showVideo ? (
                    <motion.div 
                      key="initial-overlay"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10"
                    >
                      {/* Animated Glowing Border */}
                      <div className="absolute inset-[-2px] bg-gradient-to-r from-primary via-secondary to-primary animate-pulse opacity-50 blur-sm group-hover:opacity-100 transition-opacity" />
                      
                      {/* Background Overlay */}
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-4 group-hover:bg-black/40 transition-colors">
                        <motion.div
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,184,0,0.4)]"
                        >
                          <Play className="w-8 h-8 text-black fill-current translate-x-0.5" />
                        </motion.div>
                        <span className="text-2xl font-bold text-white uppercase tracking-wider drop-shadow-lg">Click To Watch</span>
                      </div>

                      {/* Thumbnail Placeholder/Image */}
                      <img 
                        src="https://img.youtube.com/vi/yIlkKu7jFr4/maxresdefault.jpg" 
                        alt="Video Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="video-container"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-20"
                    >
                      <iframe 
                        id="youtube-player"
                        width="100%" 
                        height="100%" 
                        src="https://www.youtube.com/embed/yIlkKu7jFr4?autoplay=1&enablejsapi=1&si=GB02YeQG9ERbqFhS&controls=0&modestbranding=1&rel=0&iv_load_policy=3" 
                        title="YouTube video player" 
                        frameBorder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                        referrerPolicy="strict-origin-when-cross-origin" 
                        allowFullScreen
                      ></iframe>

                      <AnimatePresence>
                        {videoEnded && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center gap-4 cursor-pointer"
                            onClick={handleReplayClick}
                          >
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(245,184,0,0.6)]"
                            >
                              <RotateCcw className="w-8 h-8 text-black" />
                            </motion.div>
                            <span className="text-2xl font-bold text-white uppercase tracking-wider drop-shadow-lg">Watch Again</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {features.slice(0, 2).map((feature, i) => (
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
              {features.slice(2).map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.1 }}
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
      </div>

      <section className="py-20 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Explore Our <span className="text-gradient-solana">Game Modes</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose your strategy and play for massive SOL payouts with our provably fair modes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                mode: "1v1 Mode",
                multiplier: "1.8x",
                chance: "50%",
                time: "90s",
                color: "from-[#FFD700] to-[#FFA500]",
              },
              {
                mode: "2-Round Mode",
                multiplier: "3.6x",
                chance: "25%",
                time: "180s",
                color: "from-[#9945FF] to-[#DC1FFF]",
              },
              {
                mode: "3-Round Mode",
                multiplier: "7.2x",
                chance: "12.5%",
                time: "360s",
                color: "from-[#03E1FF] to-[#00FFA3]",
              },
              {
                mode: "4-Round Mode",
                multiplier: "14.4x",
                chance: "6.25%",
                time: "720s",
                color: "from-[#00FFA3] to-[#9945FF]",
              },
            ].map((item, i) => (
              <motion.div
                key={item.mode}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 text-center border-2 border-primary/10 hover:border-primary/30 transition-all group overflow-hidden relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  <div className={`w-16 h-16 rounded-2xl border-2 border-primary/30 flex items-center justify-center mx-auto mb-6 text-white text-xl font-bold shadow-lg bg-card group-hover:border-primary/60 transition-colors`}>
                    {item.multiplier}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.mode}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Win Chance</span>
                      <span className="text-accent font-semibold">{item.chance}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="text-primary font-semibold">{item.time}</span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-2xl font-black text-gradient-gold tracking-tight">{item.multiplier} SOL</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Potential Return</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">Earnings Calculator</h3>
              <p className="text-muted-foreground">Calculate your potential rewards based on wager and game mode.</p>
            </div>
            <EarningsCalculator />
          </motion.div>
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
              { step: "3", title: "Win & Earn", desc: "Winners get 90% of the pool + 1000x WAGA match reward" },
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
    </div>
  );
}
