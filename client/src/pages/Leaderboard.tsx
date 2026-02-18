import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/wallet-context";
import type { LeaderboardEntry, LeaderboardPeriod } from "@shared/schema";
import { Trophy, TrendingUp, Coins, Flame, Crown, Medal, Award, Users, Clock, Calendar, CalendarDays, Infinity } from "lucide-react";
import { useState, useEffect } from "react";

import { useSolPrice, SolToUsd } from "@/lib/price-context";

function getNextResetTime(period: LeaderboardPeriod): number {
  const now = new Date();
  
  if (period === "daily") {
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
    return next.getTime();
  }
  
  if (period === "weekly") {
    const next = new Date(now);
    const day = next.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    next.setUTCHours(0, 0, 0, 0);
    return next.getTime();
  }
  
  if (period === "monthly") {
    const next = new Date(now);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(1);
    next.setUTCHours(0, 0, 0, 0);
    return next.getTime();
  }
  
  return 0;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Resetting...";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function ResetTimer({ period }: { period: LeaderboardPeriod }) {
  const [timeLeft, setTimeLeft] = useState(0);
  
  useEffect(() => {
    const update = () => {
      const resetTime = getNextResetTime(period);
      setTimeLeft(Math.max(0, resetTime - Date.now()));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [period]);
  
  if (period === "all") return null;
  
  return (
    <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-muted/50 text-sm" data-testid="text-reset-timer">
      <Clock className="w-4 h-4 text-muted-foreground" />
      <span className="text-muted-foreground">Resets in:</span>
      <span className="font-mono font-semibold text-primary">{formatCountdown(timeLeft)}</span>
    </div>
  );
}

export default function Leaderboard() {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState<"earnings" | "luck" | "streaks">("earnings");
  const [activePeriod, setActivePeriod] = useState<LeaderboardPeriod>("all");

  const { data: leaderboard, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/leaderboard?sortBy=${activeTab}&period=${activePeriod}`],
    refetchInterval: 5000, // Polling every 5 seconds for real-time updates
  });

  const displayLeaderboard = leaderboard || [];

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-amber-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-amber-500/50";
      case 2:
        return "bg-gradient-to-r from-gray-300/10 to-gray-400/10 border-gray-400/50";
      case 3:
        return "bg-gradient-to-r from-amber-600/10 to-yellow-700/10 border-amber-600/50";
      default:
        return "bg-card border-card-border";
    }
  };

  const periodOptions: { value: LeaderboardPeriod; label: string; icon: typeof Infinity }[] = [
    { value: "all", label: "All Time", icon: Infinity },
    { value: "daily", label: "Daily", icon: Clock },
    { value: "weekly", label: "Weekly", icon: Calendar },
    { value: "monthly", label: "Monthly", icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#FFD700]/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-[#9945FF]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-[#03E1FF]/10 rounded-full blur-3xl" />
      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4 glow-gold">
            <Trophy className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-4">
            <span className="text-gradient-gold">Leaderboard</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Top players ranked by total SOL won, luck score, and winning streaks
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActivePeriod(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activePeriod === opt.value
                  ? "bg-primary/20 border border-primary/50 text-primary"
                  : "bg-card border border-card-border text-muted-foreground hover-elevate"
              }`}
              data-testid={`button-period-${opt.value}`}
            >
              <opt.icon className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
        </div>

        <ResetTimer period={activePeriod} />

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6 mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="earnings" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 h-auto py-2" data-testid="tab-earnings">
              <Coins className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="luck" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 h-auto py-2" data-testid="tab-luck">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Luck Score</span>
            </TabsTrigger>
            <TabsTrigger value="streaks" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 h-auto py-2" data-testid="tab-streaks">
              <Flame className="w-4 h-4" />
              <span className="text-[10px] sm:text-sm">Streaks</span>
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p>Loading leaderboard...</p>
            </div>
          ) : displayLeaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No players yet</p>
              <p className="text-sm">
                {activePeriod === "all" 
                  ? "Be the first to play and claim the top spot!" 
                  : `No games played this ${activePeriod === "daily" ? "day" : activePeriod === "weekly" ? "week" : "month"} yet.`}
              </p>
            </div>
          ) : (
            <>
              <TabsContent value="earnings" className="space-y-3">
                {displayLeaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.walletAddress}
                    entry={entry}
                    index={i}
                    currentUserAddress={address}
                    getRankIcon={getRankIcon}
                    getRankBg={getRankBg}
                    valueKey="totalWon"
                    valueLabel="SOL"
                    valueFormatter={(v) => v.toFixed(2)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="luck" className="space-y-3">
                {displayLeaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.walletAddress}
                    entry={entry}
                    index={i}
                    currentUserAddress={address}
                    getRankIcon={getRankIcon}
                    getRankBg={getRankBg}
                    valueKey="luckScore"
                    valueLabel="Luck"
                    valueFormatter={(v) => `${v}%`}
                  />
                ))}
              </TabsContent>

              <TabsContent value="streaks" className="space-y-3">
                {displayLeaderboard.map((entry, i) => (
                  <LeaderboardRow
                    key={entry.walletAddress}
                    entry={entry}
                    index={i}
                    currentUserAddress={address}
                    getRankIcon={getRankIcon}
                    getRankBg={getRankBg}
                    valueKey="bestStreak"
                    valueLabel="Wins"
                    valueFormatter={(v) => v.toString()}
                  />
                ))}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  currentUserAddress: string | null;
  getRankIcon: (rank: number) => React.ReactNode;
  getRankBg: (rank: number) => string;
  valueKey: keyof LeaderboardEntry;
  valueLabel: string;
  valueFormatter: (value: number) => string;
}

function LeaderboardRow({
  entry,
  index,
  currentUserAddress,
  getRankIcon,
  getRankBg,
  valueKey,
  valueLabel,
  valueFormatter,
}: LeaderboardRowProps) {
  const isCurrentUser = entry.walletAddress === currentUserAddress;
  const shortAddress = `${entry.walletAddress.slice(0, 4)}...${entry.walletAddress.slice(-4)}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`p-4 border ${getRankBg(entry.rank)} ${
          isCurrentUser ? "ring-2 ring-accent" : ""
        }`}
        data-testid={`leaderboard-row-${entry.rank}`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center">
            {getRankIcon(entry.rank)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">
                {entry.displayName || shortAddress}
              </p>
              {isCurrentUser && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-accent/20 text-accent">
                  You
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {entry.gamesWon} wins • {entry.winRate.toFixed(1)}% win rate
            </p>
          </div>

          <div className="text-right">
            <p className="text-xl font-bold text-gradient-gold">
              {valueFormatter(entry[valueKey] as number)} {valueLabel}
            </p>
            {valueLabel === "SOL" && <SolToUsd sol={entry[valueKey] as number} className="text-sm font-medium" />}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
