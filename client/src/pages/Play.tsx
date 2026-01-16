import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GameModeCard } from "@/components/GameModeCard";
import { WagerSelector } from "@/components/WagerSelector";
import { useWallet } from "@/lib/wallet-context";
import { useGameStore } from "@/lib/game-store";
import { GAME_MODES, type GameModeKey, type WagerTier } from "@shared/schema";
import { Wallet, ArrowRight, Loader2, Info } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Play() {
  const { connected, connect, balance, address } = useWallet();
  const { selectedMode, selectedWager, setSelectedMode, setSelectedWager } = useGameStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const joinGameMutation = useMutation({
    mutationFn: async (data: { mode: GameModeKey; wager: WagerTier; walletAddress: string }) => {
      const response = await apiRequest("POST", "/api/games/join", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      setLocation(`/game/${data.gameId}`);
    },
    onError: (error) => {
      toast({
        title: "Failed to join game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleJoinGame = () => {
    if (!connected) {
      connect();
      return;
    }

    if (!selectedMode || !selectedWager) {
      toast({
        title: "Select game options",
        description: "Please select a game mode and wager amount",
        variant: "destructive",
      });
      return;
    }

    if (balance < selectedWager) {
      toast({
        title: "Insufficient balance",
        description: `You need ${selectedWager} SOL to join this game`,
        variant: "destructive",
      });
      return;
    }

    joinGameMutation.mutate({ mode: selectedMode, wager: selectedWager, walletAddress: address || "" });
  };

  const gameModes: GameModeKey[] = ["1v1", "2-round", "3-round", "4-round"];
  const selectedConfig = selectedMode ? GAME_MODES[selectedMode] : null;

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
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Connect your Solana wallet to start playing and winning SOL
          </p>
          <Button size="lg" onClick={connect} className="gap-2" data-testid="button-connect-to-play">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">
            Choose Your <span className="text-gradient-gold">Game</span>
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Select a game mode and wager amount, then join the pool. 
            Winner takes 90% of the pot!
          </p>
        </motion.div>

        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-black">1</span>
              Select Game Mode
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gameModes.map((mode) => (
                <GameModeCard
                  key={mode}
                  mode={mode}
                  isSelected={selectedMode === mode}
                  onSelect={setSelectedMode}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-black">2</span>
              Select Wager
            </h2>
            <Card className="p-6">
              <WagerSelector
                selectedWager={selectedWager}
                onSelect={setSelectedWager}
              />
            </Card>
          </section>

          {selectedMode && selectedWager && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-black">3</span>
                Confirm & Play
              </h2>
              <Card className="p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Info className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{selectedConfig?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedConfig?.players} players, {selectedConfig?.rounds} round{(selectedConfig?.rounds || 0) > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Your Wager</p>
                        <p className="text-lg font-bold text-gradient-gold">{selectedWager} SOL</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Total Pool</p>
                        <p className="text-lg font-bold">{(selectedWager * (selectedConfig?.players || 2)).toFixed(2)} SOL</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Winner Gets</p>
                        <p className="text-lg font-bold text-accent">{(selectedWager * (selectedConfig?.players || 2) * 0.9).toFixed(2)} SOL</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">WAGA Reward</p>
                        <p className="text-lg font-bold text-secondary">+{selectedWager * 10}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleJoinGame}
                    disabled={joinGameMutation.isPending}
                    className="gap-2 min-w-[200px]"
                    data-testid="button-join-game"
                  >
                    {joinGameMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Game
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.section>
          )}
        </div>
      </div>
    </div>
  );
}
