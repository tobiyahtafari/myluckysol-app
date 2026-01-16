import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuckBar } from "@/components/LuckBar";
import { useWallet } from "@/lib/wallet-context";
import { Link } from "wouter";
import type { PlayerProfile, GameHistory } from "@shared/schema";
import { Wallet, Trophy, Gamepad2, TrendingUp, Coins, Clock, ArrowRight, Flame, Loader2 } from "lucide-react";

import { useSolPrice, SolToUsd } from "@/lib/price-context";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { usernameSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { connected, connect, address, shortAddress, balance, wagaBalance } = useWallet();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");

  const { data: profile } = useQuery<PlayerProfile>({
    queryKey: ["/api/profile", address],
    enabled: connected && !!address,
  });

  const { data: history } = useQuery<GameHistory[]>({
    queryKey: ["/api/profile/history", address],
    enabled: connected && !!address,
  });

  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      await apiRequest("PATCH", `/api/profile/${address}`, { username });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile", address] });
      setNewUsername("");
      toast({ title: "Username updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateUsername = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      usernameSchema.parse(newUsername);
      updateUsernameMutation.mutate(newUsername);
    } catch (err: any) {
      toast({
        title: "Invalid username",
        description: err.errors?.[0]?.message || "Between 3-20 chars, letters, numbers, ._- only",
        variant: "destructive",
      });
    }
  };

  if (!connected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full gradient-solana flex items-center justify-center mx-auto mb-6 glow-solana">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">View Your Profile</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Connect your wallet to see your stats, luck score, and game history
          </p>
          <Button size="lg" onClick={connect} className="gap-2" data-testid="button-connect-profile">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </Button>
        </motion.div>
      </div>
    );
  }

  const mockProfile: PlayerProfile = profile || {
    walletAddress: address || "",
    gamesPlayed: 42,
    gamesWon: 18,
    totalWagered: 12.5,
    totalWon: 28.7,
    wagaEarned: 4250,
    currentStreak: 3,
    bestStreak: 7,
    luckScore: 72,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  };

  const mockHistory: GameHistory[] = history || [
    { gameId: "1", mode: "1v1", wager: 0.1, result: "won", payout: 0.18, wagaEarned: 19, playedAt: Date.now() - 3600000 },
    { gameId: "2", mode: "2-round", wager: 1, result: "lost", wagaEarned: 10, playedAt: Date.now() - 7200000 },
    { gameId: "3", mode: "1v1", wager: 0.1, result: "won", payout: 0.18, wagaEarned: 19, playedAt: Date.now() - 10800000 },
    { gameId: "4", mode: "3-round", wager: 0.01, result: "lost", wagaEarned: 0.1, playedAt: Date.now() - 14400000 },
    { gameId: "5", mode: "1v1", wager: 10, result: "won", payout: 18, wagaEarned: 1900, playedAt: Date.now() - 86400000 },
  ];

  const winRate = mockProfile.gamesPlayed > 0 
    ? ((mockProfile.gamesWon / mockProfile.gamesPlayed) * 100).toFixed(1) 
    : "0";

  const stats = [
    { icon: Gamepad2, label: "Games Played", value: mockProfile.gamesPlayed, color: "text-blue-400" },
    { icon: Trophy, label: "Games Won", value: mockProfile.gamesWon, color: "text-amber-400" },
    { icon: TrendingUp, label: "Win Rate", value: `${winRate}%`, color: "text-green-400" },
    { icon: Flame, label: "Current Streak", value: mockProfile.currentStreak, color: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <Card className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-4xl font-bold text-white">
                {(address || "W").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold mb-1">{mockProfile.username || shortAddress}</h1>
                <p className="text-muted-foreground text-sm break-all">{address}</p>
                <form onSubmit={handleUpdateUsername} className="mt-4 flex gap-2 max-w-sm mx-auto md:mx-0">
                  <Input
                    placeholder="New username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="h-9"
                  />
                  <Button size="sm" type="submit" disabled={updateUsernameMutation.isPending}>
                    {updateUsernameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                  </Button>
                </form>
              </div>
              <div className="flex gap-4">
                <div className="text-center px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-xl font-bold text-gradient-gold">
                    {balance.toFixed(2)} SOL <SolToUsd sol={balance} className="text-[10px] block opacity-70" />
                  </p>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/30">
                  <p className="text-sm text-muted-foreground">WAGA</p>
                  <p className="text-xl font-bold text-secondary">{wagaBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <LuckBar score={mockProfile.luckScore} size="lg" />
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-4 text-center">
                  <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Earnings
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Total Wagered</span>
                  <span className="font-bold flex flex-col items-end">
                    <span>{mockProfile.totalWagered.toFixed(2)} SOL</span>
                    <SolToUsd sol={mockProfile.totalWagered} className="text-[10px] font-normal opacity-70" />
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <span className="text-muted-foreground">Total Won</span>
                  <span className="font-bold text-accent flex flex-col items-end">
                    <span>{mockProfile.totalWon.toFixed(2)} SOL</span>
                    <SolToUsd sol={mockProfile.totalWon} className="text-[10px] font-normal opacity-70" />
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                  <span className="text-muted-foreground">WAGA Earned</span>
                  <span className="font-bold text-secondary">{mockProfile.wagaEarned.toLocaleString()}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-400" />
                Streaks
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Current Streak</span>
                  <span className="font-bold text-orange-400">{mockProfile.currentStreak} wins</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-muted-foreground">Best Streak</span>
                  <span className="font-bold text-primary">{mockProfile.bestStreak} wins</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Games
              </h3>
              <Link href="/play">
                <Button variant="ghost" size="sm" className="gap-1">
                  Play Now <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            <div className="space-y-3">
              {mockHistory.map((game, i) => {
                const timeAgo = formatTimeAgo(game.playedAt);
                return (
                  <motion.div
                    key={game.gameId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      game.result === "won"
                        ? "bg-accent/5 border-accent/30"
                        : "bg-muted/30 border-border"
                    }`}
                    data-testid={`history-item-${game.gameId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          game.result === "won"
                            ? "bg-accent/20 text-accent"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {game.result === "won" ? (
                          <Trophy className="w-5 h-5" />
                        ) : (
                          <Gamepad2 className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{game.mode.replace("-", " ")} Mode</p>
                        <p className="text-sm text-muted-foreground">{timeAgo}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`font-bold ${game.result === "won" ? "text-accent" : "text-muted-foreground"} flex flex-col items-end`}>
                        <span>{game.result === "won" ? `+${game.payout?.toFixed(2)}` : `-${game.wager}`} SOL</span>
                        <SolToUsd sol={game.result === "won" ? (game.payout || 0) : game.wager} className="text-[10px] font-normal opacity-70" />
                      </p>
                      <p className="text-xs text-secondary">+{game.wagaEarned} WAGA</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
