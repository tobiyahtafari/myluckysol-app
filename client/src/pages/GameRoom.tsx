import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountdownTimer } from "@/components/CountdownTimer";
import { PlayerSlot } from "@/components/PlayerSlot";
import { WinnerReveal } from "@/components/WinnerReveal";
import { useWallet } from "@/lib/wallet-context";
import { GAME_MODES, type Game } from "@shared/schema";
import { ArrowLeft, Users, Loader2, Clock, Trophy, Coins } from "lucide-react";
import { Link } from "wouter";

import { useSolPrice, SolToUsd } from "@/lib/price-context";

import { GameChat } from "@/components/GameChat";

export default function GameRoom() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { address } = useWallet();
  const [showWinner, setShowWinner] = useState(false);

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/games", params.id],
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (game?.status === "completed" && game.winnerId) {
      const timer = setTimeout(() => setShowWinner(true), 500);
      return () => clearTimeout(timer);
    }
  }, [game?.status, game?.winnerId]);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">Game Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This game doesn't exist or has expired.
          </p>
          <Link href="/play">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Lobby
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const config = GAME_MODES[game.mode];
  const currentPlayer = game.players.find((p) => p.walletAddress === address);
  const isCurrentUserWinner = game.winnerId === currentPlayer?.id;
  const winner = game.players.find((p) => p.id === game.winnerId);
  const slotsNeeded = config.players;
  const playersJoined = game.players.length;
  const emptySlots = slotsNeeded - playersJoined;

  const getStatusMessage = () => {
    switch (game.status) {
      case "waiting":
        return `Waiting for ${emptySlots} more player${emptySlots > 1 ? "s" : ""}...`;
      case "countdown":
        return "Game starting soon!";
      case "in_progress":
        return `Round ${game.currentRound} of ${config.rounds}`;
      case "resolving":
        return "Determining winner...";
      case "completed":
        return "Game Complete!";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 game-room-bg relative">
      <div className="game-room-animated-bg" />
      <div className="container mx-auto max-w-4xl relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/play">
            <Button variant="ghost" className="gap-2" data-testid="button-back-lobby">
              <ArrowLeft className="w-4 h-4" />
              Back to Lobby
            </Button>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-card-border">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {playersJoined}/{slotsNeeded}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30">
              <span className="text-sm font-medium text-primary">{config.name}</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 space-y-8"
          >
            <Card className="p-6 text-center">
              <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Pool</p>
                  <p className="text-4xl font-bold text-gradient-gold">
                    {game.poolAmount.toFixed(2)} SOL <SolToUsd sol={game.poolAmount} className="text-sm font-normal block opacity-70" />
                  </p>
                </div>
                <div className="w-px h-12 bg-border hidden md:block" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Winner Takes</p>
                  <p className="text-3xl font-bold text-accent">
                    {(game.poolAmount * 0.9).toFixed(2)} SOL <SolToUsd sol={game.poolAmount * 0.9} className="text-xs font-normal block opacity-70" />
                  </p>
                </div>
              </div>
            </Card>

            <div className="text-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={game.status}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {game.status === "countdown" && game.countdownEndsAt ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-muted-foreground">Game starting in</p>
                      <CountdownTimer
                        targetTime={game.countdownEndsAt}
                        serverTime={game.serverTime}
                        size="lg"
                      />
                    </div>
                  ) : game.status === "in_progress" && game.roundEndsAt ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-muted-foreground">Round {game.currentRound} of {config.rounds}</p>
                      <CountdownTimer
                        targetTime={game.roundEndsAt}
                        serverTime={game.serverTime}
                        size="lg"
                      />
                    </div>
                  ) : game.status === "resolving" ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-primary animate-spin" style={{ borderTopColor: "transparent" }} />
                        <Trophy className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-lg font-medium animate-pulse">Determining winner...</p>
                    </div>
                  ) : game.status === "completed" && winner ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center glow-gold animate-winner">
                        <Trophy className="w-10 h-10 text-black" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Winner</p>
                        <p className="text-xl font-bold">
                          {winner.displayName || `${winner.walletAddress.slice(0, 4)}...${winner.walletAddress.slice(-4)}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-lg">
                      {game.status === "waiting" && (
                        <Clock className="w-5 h-5 text-muted-foreground animate-pulse" />
                      )}
                      <span className="text-muted-foreground">{getStatusMessage()}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players ({playersJoined}/{slotsNeeded})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                {game.players.map((player, i) => (
                  <PlayerSlot
                    key={player.id}
                    player={player}
                    index={i}
                    isCurrentUser={player.walletAddress === address}
                    isWinner={player.id === game.winnerId}
                    isEliminated={player.isEliminated}
                  />
                ))}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <PlayerSlot
                    key={`empty-${i}`}
                    player={null}
                    index={playersJoined + i}
                  />
                ))}
              </div>
            </Card>

            {config.rounds > 1 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Round Progress</h3>
                <div className="flex items-center gap-2">
                  {Array.from({ length: config.rounds }).map((_, i) => {
                    const roundNum = i + 1;
                    const isComplete = game.rounds.some((r) => r.roundNumber === roundNum && r.winnerId);
                    const isCurrent = game.currentRound === roundNum && game.status === "in_progress";

                    return (
                      <div key={i} className="flex items-center gap-2 flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            isComplete
                              ? "gradient-gold text-black"
                              : isCurrent
                              ? "bg-primary/20 border-2 border-primary text-primary animate-pulse"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {roundNum}
                        </div>
                        {i < config.rounds - 1 && (
                          <div className={`flex-1 h-1 rounded ${isComplete ? "gradient-gold" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {game.status === "completed" && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Coins className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">WAGA Earned This Game</p>
                      <p className="text-xl font-bold text-secondary">
                        +{game.wagaRewards?.toLocaleString() || 0} WAGA
                      </p>
                    </div>
                  </div>
                  <Link href="/play">
                    <Button className="gap-2" data-testid="button-play-again">
                      Play Again
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </motion.div>

          <div className="space-y-8">
            <GameChat gameId={game.id} />
          </div>
        </div>
      </div>

      {showWinner && winner && (
        <WinnerReveal
          winnerAddress={winner.walletAddress}
          payout={game.winnerPayout || 0}
          wagaReward={game.wagaRewards || 0}
          isCurrentUserWinner={isCurrentUserWinner}
          onClose={() => setShowWinner(false)}
        />
      )}
    </div>
  );
}
