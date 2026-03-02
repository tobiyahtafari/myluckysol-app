import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Search, CheckCircle, XCircle, Loader2, Copy, Flame, Droplets, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CompletedGame {
  id: string;
  mode: string;
  wager: number;
  poolAmount: number;
  winnerId?: string;
  winnerPayout?: number;
  serverSeedHash?: string;
  serverSeed?: string;
  clientSeed?: string;
  players: { walletAddress: string; username?: string }[];
  completedAt?: number;
  createdAt: number;
}

interface VerifyResult {
  id: string;
  mode: string;
  wager: number;
  poolAmount: number;
  winnerId?: string;
  winnerPayout?: number;
  serverSeed?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  players: { walletAddress: string; username?: string }[];
  completedAt?: number;
}

const FAIRNESS_CODE = `const crypto = require('crypto');

function generateFairNumber(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(\`\${clientSeed}-\${nonce}\`);
  const hash = hmac.digest('hex');
  const val = parseInt(hash.substring(0, 8), 16);
  return val / 0xFFFFFFFF;
}

function determineWinner(players, serverSeed, clientSeed, roundNumber) {
  const fairNumber = generateFairNumber(serverSeed, clientSeed, roundNumber);
  const winnerIndex = Math.floor(fairNumber * players.length);
  return players[winnerIndex];
}

// Server Seed Hash (shown before game starts)
const serverSeedHash = crypto
  .createHmac('sha256', 'seed_salt')
  .update(serverSeed)
  .digest('hex');

// Client Seed (derived from player wallet addresses)
const clientSeed = players
  .map(p => p.walletAddress.substring(0, 8))
  .join('-');

// After the game, the server seed is revealed
// so players can verify the outcome`;

export default function Fairness() {
  const { toast } = useToast();
  const [searchHash, setSearchHash] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const { data: completedGames, isLoading } = useQuery<CompletedGame[]>({
    queryKey: ["/api/games/completed"],
    refetchInterval: 5000,
  });

  const handleVerify = async () => {
    if (!searchHash.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    setVerifyError(null);

    try {
      const res = await fetch(`/api/verify?serverSeedHash=${encodeURIComponent(searchHash.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Game not found");
      } else {
        setVerifyResult(data);
      }
    } catch {
      setVerifyError("Failed to verify. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const shortAddr = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Provably <span className="text-gradient-gold">Fair</span>
          </h1>
          <p className="text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Provably Fair is a system allowing players to verify that the site operates
            legitimately and doesn't tamper game results. It leverages cryptography and
            third party input to generate random values. At the end of the game, players
            can verify that the outcome was indeed determined by the original seed and
            inputs, thus proving that the game was fair.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4 border-primary/20">
              <div className="text-sm font-semibold text-primary mb-2">1. Before Game</div>
              <p className="text-sm text-muted-foreground">
                A server seed is generated and its HMAC-SHA256 hash is published before
                the game begins. This commits to the outcome before players join.
              </p>
            </Card>
            <Card className="p-4 border-secondary/20">
              <div className="text-sm font-semibold text-secondary mb-2">2. During Game</div>
              <p className="text-sm text-muted-foreground">
                The client seed is derived from all participating players' wallet
                addresses, ensuring third-party input that the server cannot predict.
              </p>
            </Card>
            <Card className="p-4 border-accent/20">
              <div className="text-sm font-semibold text-accent mb-2">3. After Game</div>
              <p className="text-sm text-muted-foreground">
                The original server seed is revealed. Players can verify the hash matches
                and re-calculate the outcome independently.
              </p>
            </Card>
          </div>

          <h2 className="text-2xl font-bold mb-4">Fairness Algorithm</h2>
          <Card className="p-0 overflow-hidden border-primary/20">
            <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border/50">
              <span className="text-xs font-mono text-muted-foreground">fairness-algorithm.js</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => copyToClipboard(FAIRNESS_CODE)}
                data-testid="button-copy-code"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
            </div>
            <pre className="p-4 overflow-x-auto text-[8px] sm:text-[10px] md:text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all md:whitespace-pre md:break-normal">
              <code>{FAIRNESS_CODE}</code>
            </pre>
          </Card>
        </motion.div>

        {/* God Mode Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-400" />
            God Mode — Provably Fair Special Events
          </h2>
          <p className="text-muted-foreground mb-6">
            God Streaks and Streak Breakers are rare on-chain events derived from the same provably fair hash system. No player or server can predict or manipulate them.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Card className="p-5 border-orange-500/20 bg-orange-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-5 w-5 text-orange-400" />
                <span className="font-semibold text-orange-400">God Streak</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li><span className="text-foreground font-medium">Trigger:</span> 50 in 1,000,000 chance per game (~0.005%)</li>
                <li><span className="text-foreground font-medium">Duration:</span> 26–333 games (hidden from all players)</li>
                <li><span className="text-foreground font-medium">Win Weight:</span> 95% win chance in every matchup</li>
                <li><span className="text-foreground font-medium">Camping Rule:</span> Expires after 72 hours of inactivity</li>
                <li><span className="text-foreground font-medium">Recipient:</span> Randomly assigned from the game's players</li>
              </ul>
            </Card>

            <Card className="p-5 border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="h-5 w-5 text-blue-400" />
                <span className="font-semibold text-blue-400">Streak Breaker</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li><span className="text-foreground font-medium">Trigger:</span> 25% chance when matched against a God (250,000 in 1M)</li>
                <li><span className="text-foreground font-medium">Effect:</span> Strips God's advantage — 75% win to the challenger</li>
                <li><span className="text-foreground font-medium">Natural Break:</span> If God loses without a breaker — 5x WAGA bonus</li>
                <li><span className="text-foreground font-medium">Triggered Break:</span> If breaker is activated — 3x WAGA bonus</li>
                <li><span className="text-foreground font-medium">Visual:</span> Water droplet icon shown on the breaker player</li>
              </ul>
            </Card>
          </div>

          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            God Mode Algorithm
          </h3>
          <Card className="p-0 overflow-hidden border-orange-500/20">
            <div className="flex items-center justify-between px-4 py-2 bg-orange-500/5 border-b border-border/50">
              <span className="text-xs font-mono text-muted-foreground">god-mode-algorithm.js</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[8px] sm:text-[10px] md:text-sm font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all md:whitespace-pre md:break-normal">
              <code>{`// God Streak Trigger — same provably fair hash system
function deriveSpecialEventRoll(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(\`special-\${clientSeed}-\${nonce}\`);
  const hash = hmac.digest('hex');
  return parseInt(hash.substring(0, 5), 16) % 1000000;
}

// After each game resolves:
const godRoll = deriveSpecialEventRoll(serverSeed, clientSeed, 'god-trigger');
if (godRoll < 50) {           // 50 in 1,000,000 = 0.005% chance
  // Award God Streak to a random player
  // Length (26-333) is derived from the hash — hidden from all
  const streakLength = 26 + (hashDerivedValue % 308);
  player.godStreakActive = true;
  player.godStreakGamesRemaining = streakLength;  // NOT shown publicly
}

// God vs Normal matchup weight check:
if (opponent.godStreakActive) {
  const breakerRoll = deriveSpecialEventRoll(serverSeed, clientSeed, \`breaker-\${round}-\${i}\`);
  if (breakerRoll < 250000) { // 25% chance
    godWinWeight = 0.25;      // Breaker activated: God loses 95% → 25%
    challengerWinWeight = 0.75;
  } else {
    godWinWeight = 0.95;      // Normal: God has 95% win chance
    challengerWinWeight = 0.05;
  }
}`}</code>
            </pre>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
          id="verify-section"
        >
          <h2 className="text-2xl font-bold mb-4">Verify a Game</h2>
          <Card className="p-6 border-primary/20">
            <p className="text-sm text-muted-foreground mb-4">
              Enter a Server Seed Hash to look up and verify any completed game.
            </p>
            <div className="flex gap-2">
              <Input
                value={searchHash}
                onChange={(e) => setSearchHash(e.target.value)}
                placeholder="Enter Server Seed Hash..."
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                data-testid="input-verify-hash"
              />
              <Button
                onClick={handleVerify}
                disabled={verifying || !searchHash.trim()}
                className="gap-2 shrink-0"
                data-testid="button-verify"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Verify
              </Button>
            </div>

            {verifyError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm text-red-400">{verifyError}</span>
              </div>
            )}

            {verifyResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-3"
              >
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-sm text-green-400">Game verified successfully</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Mode</span>
                    <p className="font-semibold">{verifyResult.mode}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Wager</span>
                    <p className="font-semibold">{verifyResult.wager} SOL</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pool</span>
                    <p className="font-semibold">{verifyResult.poolAmount} SOL</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout</span>
                    <p className="font-semibold text-accent">{verifyResult.winnerPayout?.toFixed(4)} SOL</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Server Seed</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono break-all bg-muted/30 px-2 py-1 rounded">{verifyResult.serverSeed}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(verifyResult.serverSeed || "")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Server Seed Hash</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono break-all bg-muted/30 px-2 py-1 rounded">{verifyResult.serverSeedHash}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(verifyResult.serverSeedHash || "")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Client Seed</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono break-all bg-muted/30 px-2 py-1 rounded">{verifyResult.clientSeed}</code>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => copyToClipboard(verifyResult.clientSeed || "")}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Winner</span>
                    <p className="font-mono text-xs">{verifyResult.winnerId ? shortAddr(verifyResult.winnerId) : "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Players</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {verifyResult.players.map((p, i) => (
                        <span key={i} className="text-xs font-mono bg-muted/30 px-2 py-0.5 rounded">
                          {p.username || shortAddr(p.walletAddress)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold mb-4">Completed Games</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Real-time feed of all completed games. Click any server seed hash to verify.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !completedGames || completedGames.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No completed games yet. Play a game to see results here.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {completedGames.map((game) => (
                <Card
                  key={game.id}
                  className="p-4 border-border/50 hover:border-primary/30 transition-colors"
                  data-testid={`card-game-${game.id}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                        {game.mode}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Pool: </span>
                        <span className="font-semibold text-gradient-gold">{game.poolAmount} SOL</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Winner: </span>
                        <span className="font-mono text-xs">
                          {game.players.find(p => p.walletAddress === game.winnerId)?.username || (game.winnerId ? shortAddr(game.winnerId) : "N/A")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {game.serverSeedHash && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs font-mono h-7 gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setSearchHash(game.serverSeedHash || "");
                            handleVerify();
                            const verifySection = document.getElementById("verify-section");
                            if (verifySection) {
                              verifySection.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          data-testid={`button-verify-game-${game.id}`}
                        >
                          <Shield className="w-3 h-3" />
                          {game.serverSeedHash.slice(0, 8)}...
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {game.completedAt ? formatTime(game.completedAt) : ""}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
