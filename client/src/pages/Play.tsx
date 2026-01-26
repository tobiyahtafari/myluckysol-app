import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameModeCard } from "@/components/GameModeCard";
import { WagerSelector } from "@/components/WagerSelector";
import { useWallet } from "@/lib/wallet-context";
import { useGameStore } from "@/lib/game-store";
import { GAME_MODES, WAGA_ENTRY_REWARD_PERCENT, type GameModeKey, type WagerTier, type Game } from "@shared/schema";
import { Wallet, ArrowRight, Loader2, Info, Users, Play as PlayIcon } from "lucide-react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SolToUsd } from "@/lib/price-context";
import { WalletModal } from "@/components/WalletModal";
import { signAndSendTransaction } from "@/lib/solana/wallet-adapter";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { FOUNDATION_TREASURY_WALLET, MYLUCKYSOL_PROGRAM_ID } from "@shared/constants";

export default function Play() {
  const { connected, balance, address, network, adapter, publicKey, connection } = useWallet();
  const { selectedMode, selectedWager, setSelectedMode, setSelectedWager } = useGameStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const wagerSectionRef = useRef<HTMLElement>(null);
  const confirmSectionRef = useRef<HTMLElement>(null);

  const { data: liveGames } = useQuery<Game[]>({
    queryKey: ["/api/games/live"],
    refetchInterval: 5000,
  });

  const handleModeSelect = (mode: GameModeKey) => {
    setSelectedMode(mode);
    setTimeout(() => {
      wagerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleWagerSelect = (wager: WagerTier) => {
    setSelectedWager(wager);
    setTimeout(() => {
      confirmSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const activeGames = liveGames?.filter(g => g.players.some(p => p.walletAddress === address)) || [];
  const otherLiveGames = liveGames?.filter(g => !g.players.some(p => p.walletAddress === address)) || [];

  const joinGameMutation = useMutation({
    mutationFn: async (data: { mode: GameModeKey; wager: WagerTier; walletAddress: string }) => {
      if (!adapter || !publicKey) {
        throw new Error("Wallet not connected");
      }

      // Program and Escrow PDA derivation
      const PROGRAM_ID = new PublicKey(MYLUCKYSOL_PROGRAM_ID);
      
      // We use a deterministic PDA for the game pool/escrow
      // In the contract it's: seeds = [b"game_pool", game_id.to_le_bytes().as_ref()]
      // Since we don't have the on-chain game_id yet (backend generates it),
      // we'll use a temporary vault or update the backend to provide the PDA.
      // FOR NOW: We will use the Treasury as the primary Escrow vault 
      // but through the program's logic.
      const TREASURY_WALLET = new PublicKey(FOUNDATION_TREASURY_WALLET);
      
      // Build SOL transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_WALLET,
          lamports: Math.round(data.wager * LAMPORTS_PER_SOL),
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      // Sign and send transaction
      const signature = await signAndSendTransaction(adapter, connection, transaction);
      
      // Register with backend after on-chain confirmation
      const response = await apiRequest("POST", "/api/games/join", {
        ...data,
        txSignature: signature
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile", address] });
      
      toast({
        title: "Joined game successfully",
        description: `You earned ${data.wagaReward} WAGA tokens! ${data.playersNeeded > 0 ? "Waiting for players..." : "Game starting!"}`,
      });
      
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
      setShowWalletModal(true);
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
        description: `You need ${selectedWager} SOL to join this game. ${network === "devnet" ? "Request an airdrop from your wallet menu." : ""}`,
        variant: "destructive",
      });
      return;
    }

    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    joinGameMutation.mutate({ mode: selectedMode, wager: selectedWager, walletAddress: address });
  };

  const gameModes: GameModeKey[] = ["1v1", "2-round", "3-round", "4-round"];
  const selectedConfig = selectedMode ? GAME_MODES[selectedMode] : null;

  if (!connected) {
    return (
      <>
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
              Connect your Solana wallet to start playing and winning real SOL on {network === "devnet" ? "Devnet" : "Mainnet"}
            </p>
            <Button size="lg" onClick={() => setShowWalletModal(true)} className="gap-2" data-testid="button-connect-to-play">
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </Button>
          </motion.div>
        </div>
        <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
      <div className="container mx-auto max-w-6xl relative z-10">
        <Tabs defaultValue="join" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="join">Join Game</TabsTrigger>
            <TabsTrigger value="live">Live Games</TabsTrigger>
          </TabsList>

          <TabsContent value="join">
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
                      onSelect={handleModeSelect}
                    />
                  ))}
                </div>
              </section>

              <section ref={wagerSectionRef}>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-sm font-bold text-black">2</span>
                  Select Wager
                </h2>
                <Card className="p-6">
                  <WagerSelector
                    selectedWager={selectedWager}
                    onSelect={handleWagerSelect}
                  />
                </Card>
              </section>

              {selectedMode && selectedWager && (
                <motion.section
                  ref={confirmSectionRef}
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
                            <p className="text-lg font-bold text-gradient-gold">{selectedWager.toFixed(3)} SOL</p>
                            <SolToUsd sol={selectedWager} className="text-sm" />
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Total Pool</p>
                            <p className="text-lg font-bold">{(selectedWager * (selectedConfig?.players || 2)).toFixed(3)} SOL</p>
                            <SolToUsd sol={selectedWager * (selectedConfig?.players || 2)} className="text-sm" />
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">Winner Gets</p>
                            <p className="text-lg font-bold text-accent">{(selectedWager * (selectedConfig?.players || 2) * 0.9).toFixed(3)} SOL</p>
                            <SolToUsd sol={selectedWager * (selectedConfig?.players || 2) * 0.9} className="text-sm" />
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground">WAGA Entry</p>
                            <p className="text-lg font-bold text-secondary">{WAGA_ENTRY_REWARD_PERCENT[selectedWager]}%</p>
                            <p className="text-xs text-muted-foreground">of USD value</p>
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
          </TabsContent>

          <TabsContent value="live">
            <div className="space-y-8">
              {activeGames.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent" />
                    Your Active Games
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeGames.map(game => (
                      <LiveGameCard key={game.id} game={game} isActive />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <PlayIcon className="w-5 h-5 text-primary" />
                  Live Games
                </h2>
                {otherLiveGames.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {otherLiveGames.map(game => (
                      <LiveGameCard key={game.id} game={game} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <p className="text-muted-foreground">No other live games currently.</p>
                  </Card>
                )}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </>
  );
}

function LiveGameCard({ game, isActive }: { game: Game; isActive?: boolean }) {
  const config = GAME_MODES[game.mode];
  const playersNeeded = config.players - game.players.length;
  
  return (
    <Card className={`p-4 border-2 transition-all hover:border-primary/50 ${isActive ? 'border-accent/50' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold">{config.name}</h3>
          <p className="text-sm text-muted-foreground capitalize">{game.status.replace('_', ' ')}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-gradient-gold">{game.wager} SOL</p>
          <p className="text-xs text-muted-foreground">Pool: {game.poolAmount.toFixed(2)} SOL</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">
            {game.players.length}/{config.players} Players
            {playersNeeded > 0 && game.status === "waiting" && (
              <span className="text-accent ml-1">(need {playersNeeded} more)</span>
            )}
          </span>
        </div>
        <Link href={`/game/${game.id}`}>
          <Button size="sm" variant={isActive ? "default" : "outline"} data-testid={`button-join-live-game-${game.id}`}>
            {isActive ? "Resume" : game.status === "waiting" ? "Join" : "Spectate"}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
