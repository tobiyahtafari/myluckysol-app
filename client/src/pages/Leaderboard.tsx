import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/wallet-context";
import type { LeaderboardEntry } from "@shared/schema";
import { Trophy, TrendingUp, Coins, Flame, Crown, Medal, Award } from "lucide-react";

export default function Leaderboard() {
  const { address } = useWallet();

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  const defaultLeaderboard: LeaderboardEntry[] = [
    { rank: 1, walletAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "LuckyWhale", totalWon: 156.8, gamesWon: 89, winRate: 67.4, luckScore: 92, bestStreak: 12 },
    { rank: 2, walletAddress: "5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "SolanaKing", totalWon: 124.5, gamesWon: 72, winRate: 58.2, luckScore: 85, bestStreak: 9 },
    { rank: 3, walletAddress: "3xMXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "CryptoLuck", totalWon: 98.3, gamesWon: 65, winRate: 54.1, luckScore: 78, bestStreak: 8 },
    { rank: 4, walletAddress: "9xNXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", totalWon: 87.2, gamesWon: 58, winRate: 52.3, luckScore: 74, bestStreak: 7 },
    { rank: 5, walletAddress: "2xOXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "Degen4Life", totalWon: 76.9, gamesWon: 51, winRate: 49.8, luckScore: 71, bestStreak: 6 },
    { rank: 6, walletAddress: "8xPXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", totalWon: 65.4, gamesWon: 44, winRate: 48.2, luckScore: 68, bestStreak: 6 },
    { rank: 7, walletAddress: "4xQXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "NFTHunter", totalWon: 54.1, gamesWon: 38, winRate: 45.6, luckScore: 65, bestStreak: 5 },
    { rank: 8, walletAddress: "6xRXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", totalWon: 43.8, gamesWon: 32, winRate: 44.1, luckScore: 62, bestStreak: 5 },
    { rank: 9, walletAddress: "1xSXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", displayName: "GambleMaster", totalWon: 32.5, gamesWon: 26, winRate: 42.8, luckScore: 59, bestStreak: 4 },
    { rank: 10, walletAddress: "0xTXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", totalWon: 28.2, gamesWon: 22, winRate: 41.2, luckScore: 56, bestStreak: 4 },
  ];

  const displayLeaderboard = (leaderboard && leaderboard.length > 0) ? leaderboard : defaultLeaderboard;

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

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
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

        <Tabs defaultValue="earnings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="earnings" className="gap-2" data-testid="tab-earnings">
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Earnings</span>
            </TabsTrigger>
            <TabsTrigger value="luck" className="gap-2" data-testid="tab-luck">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Luck Score</span>
            </TabsTrigger>
            <TabsTrigger value="streaks" className="gap-2" data-testid="tab-streaks">
              <Flame className="w-4 h-4" />
              <span className="hidden sm:inline">Streaks</span>
            </TabsTrigger>
          </TabsList>

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
            {[...displayLeaderboard]
              .sort((a, b) => b.luckScore - a.luckScore)
              .map((entry, i) => ({ ...entry, rank: i + 1 }))
              .map((entry, i) => (
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
            {[...displayLeaderboard]
              .sort((a, b) => b.bestStreak - a.bestStreak)
              .map((entry, i) => ({ ...entry, rank: i + 1 }))
              .map((entry, i) => (
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
              {valueFormatter(entry[valueKey] as number)}
            </p>
            <p className="text-xs text-muted-foreground">{valueLabel}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
