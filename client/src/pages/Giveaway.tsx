import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, Zap, Gift, Users, TrendingUp, Clock, Star } from "lucide-react";
import { useSolPrice } from "@/lib/price-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const PAYOUT_PERCENTS = [22, 16, 12, 10, 9, 8, 7, 6, 5, 5];

interface GiveawayStats {
  totalGamesPlayed: number;
  giveawayWalletBalance: number;
  displayBalance: number;
  gamesInCycle: number;
  progressPercent: number;
  milestoneGames: number;
  gamesRemaining: number;
  payoutPercents: number[];
}

interface LeaderboardEntry {
  rank: number;
  walletAddress: string;
  displayName?: string;
  totalWon: number;
  gamesWon: number;
  gamesPlayed?: number;
  winRate: number;
  luckScore: number;
  bestStreak: number;
  godStreakActive?: boolean;
  isStreakBreakerActive?: boolean;
}

interface GiveawayLeaderboard {
  luck: LeaderboardEntry[];
  streaks: LeaderboardEntry[];
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    2: "text-slate-300 border-slate-300/30 bg-slate-300/10",
    3: "text-amber-600 border-amber-600/30 bg-amber-600/10",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${colors[rank] || "text-muted-foreground border-border/50 bg-background/50"}`}>
      {rank}
    </span>
  );
}

function PayoutTable({
  entries,
  type,
  payoutPercents,
  jackpot,
  solPrice,
}: {
  entries: LeaderboardEntry[];
  type: "luck" | "streaks";
  payoutPercents: number[];
  jackpot: number;
  solPrice: number | null;
}) {
  const isLuck = type === "luck";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-3 px-2 text-muted-foreground font-medium">Rank</th>
            <th className="text-left py-3 px-2 text-muted-foreground font-medium">Player</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">{isLuck ? "Luck Score" : "Best Streak"}</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">Share</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">Payout</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-muted-foreground">
                No players yet. Be the first to play!
              </td>
            </tr>
          )}
          {entries.map((entry, idx) => {
            const pct = payoutPercents[idx] || 0;
            const payoutSol = (jackpot * pct) / 100;
            const payoutUsd = solPrice ? payoutSol * solPrice : null;
            return (
              <motion.tr
                key={entry.walletAddress}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="border-b border-border/20 hover:bg-white/[0.02] transition-colors"
                data-testid={`row-giveaway-${type}-${idx}`}
              >
                <td className="py-3 px-2">
                  <RankBadge rank={entry.rank} />
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    {entry.godStreakActive && (
                      <span className="text-orange-400 text-xs font-bold">GOD</span>
                    )}
                    {entry.isStreakBreakerActive && (
                      <span className="text-blue-400 text-xs font-bold">BREAKER</span>
                    )}
                    <span className="font-medium text-foreground">
                      {entry.displayName || formatAddress(entry.walletAddress)}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-2 text-right font-mono">
                  {isLuck ? (
                    <span className="text-primary">{entry.luckScore}</span>
                  ) : (
                    <span className="text-secondary">{entry.bestStreak}</span>
                  )}
                </td>
                <td className="py-3 px-2 text-right">
                  <Badge variant="outline" className="text-accent border-accent/30 font-mono">
                    {pct}%
                  </Badge>
                </td>
                <td className="py-3 px-2 text-right">
                  <div>
                    <div className="font-mono font-medium text-foreground">{payoutSol.toFixed(2)} SOL</div>
                    {payoutUsd && (
                      <div className="text-xs text-muted-foreground">${payoutUsd.toFixed(0)}</div>
                    )}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Giveaway() {
  const { solPrice } = useSolPrice();

  const { data: stats, isLoading: statsLoading } = useQuery<GiveawayStats>({
    queryKey: ["/api/giveaway/stats"],
    refetchInterval: 10000,
  });

  const { data: leaderboard, isLoading: lbLoading } = useQuery<GiveawayLeaderboard>({
    queryKey: ["/api/giveaway/leaderboard"],
    refetchInterval: 30000,
  });

  const jackpot = stats?.displayBalance ?? 200;
  const jackpotUsd = solPrice ? jackpot * solPrice : null;
  const progressPct = stats?.progressPercent ?? 0;

  return (
    <div className="min-h-screen bg-background pt-8 pb-32 px-4">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* Hero Jackpot */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <Gift className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              1 Million Game Giveaway
            </h1>
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every game contributes 1% of the pool to the giveaway jackpot. When we hit 1,000,000 games, the pot is split between the top 10 luckiest players and the top 10 longest streaks.
          </p>

          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="inline-block"
          >
            <div className="relative px-10 py-8 rounded-2xl border border-primary/30 bg-primary/5 shadow-[0_0_60px_rgba(245,184,0,0.15)]">
              <div className="text-6xl md:text-7xl font-bold font-mono text-gradient-gold tracking-wider" data-testid="text-jackpot-sol">
                {jackpot.toFixed(1)} SOL
              </div>
              {jackpotUsd && (
                <div className="text-xl text-muted-foreground mt-1 font-mono" data-testid="text-jackpot-usd">
                  ${jackpotUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                </div>
              )}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-black font-bold px-3 py-1 text-xs tracking-widest">
                  GUARANTEED MINIMUM
                </Badge>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Progress to Milestone */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Progress to Jackpot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {statsLoading ? "..." : (stats?.gamesInCycle || 0).toLocaleString()} games played
              </span>
              <span className="font-mono text-muted-foreground">
                {statsLoading ? "..." : (stats?.gamesRemaining || 1000000).toLocaleString()} remaining
              </span>
            </div>
            <Progress
              value={progressPct}
              className="h-3 bg-border/30"
              data-testid="progress-giveaway"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {progressPct.toFixed(3)}% complete
              </span>
              <span>1,000,000</span>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Zap,
              color: "text-primary",
              title: "1% Per Game",
              desc: "Every game contributes 1% of the pool to the jackpot. 0.01 SOL wager = 0.0001 SOL to pot.",
            },
            {
              icon: Users,
              color: "text-secondary",
              title: "50/50 Split",
              desc: "Top 10 Luck Score players share 50%. Top 10 Streak players share the other 50%.",
            },
            {
              icon: Star,
              color: "text-accent",
              title: "200 SOL Floor",
              desc: "The jackpot is guaranteed to be at least 200 SOL when it triggers at 1M games.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-border/50 bg-background/40 h-full">
                <CardContent className="pt-6 space-y-3">
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Payout Structure */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Payout Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Luck Leaderboard (50% of pot)
                </h4>
                <div className="space-y-2">
                  {PAYOUT_PERCENTS.map((pct, i) => {
                    const share = pct / 2;
                    const payoutSol = (jackpot / 2) * (pct / 100);
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <div className="flex-1 mx-3">
                          <div
                            className="h-1.5 rounded-full bg-primary/30"
                            style={{ width: `${(pct / 22) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-foreground w-20 text-right">
                          {pct}% → {payoutSol.toFixed(1)} SOL
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Streaks Leaderboard (50% of pot)
                </h4>
                <div className="space-y-2">
                  {PAYOUT_PERCENTS.map((pct, i) => {
                    const payoutSol = (jackpot / 2) * (pct / 100);
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">#{i + 1}</span>
                        <div className="flex-1 mx-3">
                          <div
                            className="h-1.5 rounded-full bg-secondary/30"
                            style={{ width: `${(pct / 22) * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-foreground w-20 text-right">
                          {pct}% → {payoutSol.toFixed(1)} SOL
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="h-4 w-4 text-primary" />
                Top 10 Luck Scores
              </CardTitle>
              <p className="text-xs text-muted-foreground">Splitting 50% of the jackpot</p>
            </CardHeader>
            <CardContent>
              <PayoutTable
                entries={leaderboard?.luck || []}
                type="luck"
                payoutPercents={PAYOUT_PERCENTS}
                jackpot={jackpot / 2}
                solPrice={solPrice}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-secondary" />
                Top 10 Longest Streaks
              </CardTitle>
              <p className="text-xs text-muted-foreground">Splitting 50% of the jackpot</p>
            </CardHeader>
            <CardContent>
              <PayoutTable
                entries={leaderboard?.streaks || []}
                type="streaks"
                payoutPercents={PAYOUT_PERCENTS}
                jackpot={jackpot / 2}
                solPrice={solPrice}
              />
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Leaderboard positions are tracked across all games. Rankings update after every game. The jackpot triggers automatically at 1,000,000 games played.
        </p>
      </div>
    </div>
  );
}
