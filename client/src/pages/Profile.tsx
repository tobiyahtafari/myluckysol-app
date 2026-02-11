import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuckBar } from "@/components/LuckBar";
import { useWallet } from "@/lib/wallet-context";
import { Link } from "wouter";
import type { PlayerProfile, GameHistory } from "@shared/schema";
import { VESTING_DAILY_PERCENT, REFERRAL_REWARD_AMOUNT } from "@shared/schema";
import { Wallet, Trophy, Gamepad2, TrendingUp, Coins, Clock, ArrowRight, Flame, Loader2, Link as LinkIcon, Camera, Copy, Check, Lock, Unlock, AlertTriangle } from "lucide-react";
import { useSolPrice, SolToUsd } from "@/lib/price-context";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { usernameSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { signAndSendTransaction } from "@/lib/solana/wallet-adapter";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

export default function Profile() {
  const { connected, connect, address, shortAddress, balance, wagaBalance, adapter, connection, publicKey } = useWallet();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");
  const [copied, setCopy] = useState(false);
  const [isPayingForUsername, setIsPayingForUsername] = useState(false);

  const { data: profile } = useQuery<PlayerProfile>({
    queryKey: ['/api/profile', address],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${address}`);
      return res.json();
    },
    enabled: connected && !!address,
  });

  const { data: usernameCost, refetch: refetchCost } = useQuery<{
    costSol: number;
    costUsd: number;
    isFirstUpdate: boolean;
    updateCount: number;
    currentUsername: string | null;
    paymentAddress: string | null;
  }>({
    queryKey: ['/api/profile', address, 'username-cost'],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${address}/username-cost`);
      return res.json();
    },
    enabled: connected && !!address,
  });

  const hasUsername = !!profile?.username;
  const referralUnlocked = hasUsername;

  const referralLink = profile?.username 
    ? `${window.location.origin}/play?ref=${encodeURIComponent(profile.username)}`
    : "";

  const copyReferral = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopy(true);
    setTimeout(() => setCopy(false), 2000);
    toast({ title: "Referral link copied!" });
  };

  const { data: history } = useQuery<GameHistory[]>({
    queryKey: ['/api/profile', address, 'history'],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${address}/history`);
      return res.json();
    },
    enabled: connected && !!address,
  });

  const { data: vestingData, refetch: refetchVesting } = useQuery<{
    totalVesting: number;
    claimed: number;
    remaining: number;
    nextClaimTime: number;
    canClaim: boolean;
    dailyAmount: number;
  }>({
    queryKey: ['/api/profile', address, 'vesting'],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${address}/vesting`);
      return res.json();
    },
    enabled: connected && !!address,
  });

  const claimVestingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/profile/${address}/claim-vesting`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', address] });
      refetchVesting();
      toast({ 
        title: "WAGA Claimed", 
        description: `You received ${data.claimedAmount.toLocaleString()} WAGA tokens!` 
      });
    },
    onError: (err: any) => {
      toast({
        title: "Claim Failed",
        description: err.message || "Unable to claim vested tokens",
        variant: "destructive",
      });
    },
  });

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      usernameSchema.parse(newUsername);
    } catch (err: any) {
      toast({
        title: "Invalid username",
        description: err.errors?.[0]?.message || "Between 3-20 chars, letters, numbers, ._- only",
        variant: "destructive",
      });
      return;
    }

    if (!adapter || !publicKey || !connection || !usernameCost) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    if (!usernameCost.paymentAddress) {
      toast({ title: "Payment address not available", variant: "destructive" });
      return;
    }

    setIsPayingForUsername(true);
    try {
      const costLamports = Math.ceil(usernameCost.costSol * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(usernameCost.paymentAddress),
          lamports: costLamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await signAndSendTransaction(adapter, connection, transaction);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const res = await apiRequest("PATCH", `/api/profile/${address}`, {
        username: newUsername,
        txSignature: signature,
      });
      const data = await res.json();

      queryClient.invalidateQueries({ queryKey: ['/api/profile', address] });
      refetchCost();
      setNewUsername("");

      if (data.referralGranted) {
        toast({ 
          title: "Username Updated + Referral Bonus",
          description: `Username set! You and your referrer each earned ${REFERRAL_REWARD_AMOUNT} WAGA!`,
        });
      } else {
        toast({ title: "Username updated successfully" });
      }
    } catch (err: any) {
      const msg = err.message || "Transaction failed";
      toast({
        title: "Username update failed",
        description: msg.includes("User rejected") ? "Transaction was cancelled" : msg,
        variant: "destructive",
      });
    } finally {
      setIsPayingForUsername(false);
    }
  };

  const updateAvatarMutation = useMutation({
    mutationFn: async (avatarUrl: string) => {
      await apiRequest("PATCH", `/api/profile/${address}`, { avatarUrl });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', address] });
      toast({ title: "Avatar updated" });
    },
  });

  const referralMutation = useMutation({
    mutationFn: async (referrer: string) => {
      const res = await apiRequest("PATCH", `/api/profile/${address}`, { referredBy: referrer });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', address] });
      setReferrerAddress("");
      toast({ 
        title: "Referral code applied",
        description: `Referral registered. Both you and your referrer will receive ${REFERRAL_REWARD_AMOUNT} WAGA once you set your username.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Referral failed", description: err.message, variant: "destructive" });
    },
  });

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
          <Button size="lg" onClick={() => connect("phantom")} className="gap-2" data-testid="button-connect-profile">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </Button>
        </motion.div>
      </div>
    );
  }

  const mockHistory: GameHistory[] = history || [];

  const winRate = (profile?.gamesPlayed || 0) > 0 
    ? (((profile?.gamesWon || 0) / (profile?.gamesPlayed || 1)) * 100).toFixed(1) 
    : "0";

  const stats = [
    { icon: Gamepad2, label: "Games Played", value: profile?.gamesPlayed || 0, color: "text-blue-400" },
    { icon: Trophy, label: "Games Won", value: profile?.gamesWon || 0, color: "text-amber-400" },
    { icon: TrendingUp, label: "Win Rate", value: `${winRate}%`, color: "text-green-400" },
    { icon: Flame, label: "Current Streak", value: profile?.currentStreak || 0, color: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen py-8 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-secondary/5 to-transparent" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#9945FF]/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/3 left-0 w-80 h-80 bg-[#00FFA3]/12 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-[#03E1FF]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-[#DC1FFF]/8 rounded-full blur-3xl" />
      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <Card className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-4xl font-bold text-white overflow-hidden border-2 border-primary/20">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (address || "W").charAt(0).toUpperCase()
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => updateAvatarMutation.mutate(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold mb-1" data-testid="text-username">{profile?.username || shortAddress}</h1>
                <p className="text-muted-foreground text-sm break-all">{address}</p>
                <form onSubmit={handleUpdateUsername} className="mt-4 space-y-2 max-w-sm mx-auto md:mx-0">
                  <div className="flex gap-2">
                    <Input
                      placeholder={hasUsername ? "Change username" : "Set username to unlock referrals"}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      data-testid="input-username"
                    />
                    <Button 
                      type="submit" 
                      disabled={isPayingForUsername || !newUsername}
                      data-testid="button-update-username"
                    >
                      {isPayingForUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
                    </Button>
                  </div>
                  {usernameCost && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-username-cost">
                      <Coins className="w-3 h-3" />
                      Cost: {usernameCost.costSol.toFixed(4)} SOL (~${usernameCost.costUsd.toFixed(2)})
                      {usernameCost.isFirstUpdate ? " (first time)" : " (update)"}
                    </p>
                  )}
                </form>
                {profile?.usernameUpdatedAt && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Last changed: {new Date(profile.usernameUpdatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div className="text-center px-6 py-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-sm text-muted-foreground">SOL Balance</p>
                  <p className="text-2xl font-bold text-gradient-gold">{balance.toFixed(4)} SOL</p>
                  <SolToUsd sol={balance} className="text-sm" />
                </div>
                <div className="text-center px-6 py-3 rounded-lg bg-secondary/10 border border-secondary/30">
                  <p className="text-sm text-muted-foreground">WAGA Tokens</p>
                  <p className="text-2xl font-bold text-secondary font-mono tracking-tight">{wagaBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className={`p-6 relative ${!referralUnlocked ? 'border-muted' : ''}`}>
            {!referralUnlocked && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center gap-3 p-6" data-testid="referral-locked-overlay">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-center">Referral Program Locked</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Set your username above to unlock the Referral Program. Earn {REFERRAL_REWARD_AMOUNT} WAGA for each friend you refer!
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Username update requires a small SOL payment</span>
                </div>
              </div>
            )}
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-accent" />
              Referral Program
              {referralUnlocked && (
                <span className="text-xs text-accent font-normal ml-2">Unlocked</span>
              )}
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Share your link to earn {REFERRAL_REWARD_AMOUNT} WAGA for every friend who joins and sets their username.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={referralLink || "Set username to generate link"} className="text-xs" data-testid="input-referral-link" />
                  <Button size="icon" onClick={copyReferral} variant="outline" disabled={!referralLink} data-testid="button-copy-referral">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-accent" data-testid="text-referral-count">Total Referrals: {profile?.referralCount || 0}</p>
              </div>
              
              <div className="space-y-3">
                {!profile?.referredBy && !hasUsername ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Were you referred? Enter their username or wallet address. Both of you will receive {REFERRAL_REWARD_AMOUNT} WAGA once you both set your usernames.
                    </p>
                    <form 
                      onSubmit={(e) => { e.preventDefault(); referralMutation.mutate(referrerAddress); }} 
                      className="flex gap-2"
                    >
                      <Input 
                        placeholder="Referrer's username or wallet" 
                        value={referrerAddress}
                        onChange={(e) => setReferrerAddress(e.target.value)}
                        className="text-xs"
                        data-testid="input-referrer"
                      />
                      <Button 
                        type="submit" 
                        disabled={referralMutation.isPending || !referrerAddress}
                        data-testid="button-apply-referral"
                      >
                        Claim
                      </Button>
                    </form>
                  </>
                ) : profile?.referredBy && !profile?.referralRewarded ? (
                  <p className="text-xs text-amber-400 flex items-center gap-1" data-testid="text-referral-pending">
                    <Clock className="w-3 h-3" />
                    Referral reward pending - set your username to claim {REFERRAL_REWARD_AMOUNT} WAGA
                  </p>
                ) : profile?.referralRewarded ? (
                  <p className="text-xs text-accent flex items-center gap-1" data-testid="text-referral-claimed">
                    <Check className="w-3 h-3" />
                    Referral reward claimed: +{REFERRAL_REWARD_AMOUNT} WAGA
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No referral code applied. Referral codes can only be entered before your first username update.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <LuckBar score={profile?.luckScore || 50} size="lg" />
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
                    <span>{(profile?.totalWagered || 0).toFixed(2)} SOL</span>
                    <SolToUsd sol={profile?.totalWagered || 0} className="text-[10px] font-normal opacity-70" />
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <span className="text-muted-foreground">Total Won</span>
                  <span className="font-bold text-accent flex flex-col items-end">
                    <span>{(profile?.totalWon || 0).toFixed(2)} SOL</span>
                    <SolToUsd sol={profile?.totalWon || 0} className="text-[10px] font-normal opacity-70" />
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                  <span className="text-muted-foreground">WAGA Earned</span>
                  <span className="font-bold text-secondary">{(profile?.wagaEarned || 0).toLocaleString()}</span>
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
                  <span className="font-bold text-orange-400">{profile?.currentStreak || 0} wins</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-muted-foreground">Best Streak</span>
                  <span className="font-bold text-primary">{profile?.bestStreak || 0} wins</span>
                </div>
              </div>
            </Card>
          </div>

          {vestingData && vestingData.totalVesting > 0 && (
            <Card className="p-6 border-secondary/30 bg-gradient-to-br from-secondary/5 to-transparent">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-secondary" />
                WAGA Vesting Schedule
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Winner rewards are released gradually at {VESTING_DAILY_PERCENT}% per day to protect WAGA market value.
              </p>
              
              <div className="flex flex-col md:grid md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Total Vesting</p>
                  <p className="text-lg font-bold text-secondary">{vestingData.totalVesting.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <p className="text-xs text-muted-foreground">Claimed</p>
                  <p className="text-lg font-bold text-accent">{vestingData.claimed.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-lg font-bold text-primary">{vestingData.remaining.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Vesting Progress</span>
                  <span>{Math.round((vestingData.claimed / vestingData.totalVesting) * 100)}%</span>
                </div>
                <Progress 
                  value={(vestingData.claimed / vestingData.totalVesting) * 100} 
                  className="h-2"
                />
              </div>

              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-3 rounded-lg bg-muted/30 gap-4">
                <div>
                  <p className="text-sm font-medium">Daily Release: {vestingData.dailyAmount.toLocaleString()} WAGA</p>
                  {vestingData.remaining > 0 && vestingData.nextClaimTime > 0 && !vestingData.canClaim && (
                    <p className="text-xs text-muted-foreground">
                      Next claim: {formatTimeUntil(vestingData.nextClaimTime)}
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => claimVestingMutation.mutate()}
                  disabled={!vestingData.canClaim || claimVestingMutation.isPending}
                  className="gap-2 w-full md:w-auto"
                  data-testid="button-claim-vesting"
                >
                  {claimVestingMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  {vestingData.canClaim ? "Claim WAGA" : "Locked"}
                </Button>
              </div>
            </Card>
          )}

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
                const modeConfig = { "1v1": 2, "2-round": 4, "3-round": 8, "4-round": 16 };
                const totalPlayers = game.totalPlayers || modeConfig[game.mode] || 2;
                const poolAmount = game.poolAmount || (game.wager * totalPlayers);
                
                return (
                  <motion.div
                    key={game.gameId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-lg border ${
                      game.result === "won"
                        ? "bg-accent/5 border-accent/30"
                        : "bg-muted/30 border-border"
                    }`}
                    data-testid={`history-item-${game.gameId}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
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
                          <p className="text-xs text-muted-foreground">{timeAgo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${game.result === "won" ? "text-accent" : "text-muted-foreground"}`}>
                          {game.result === "won" ? `+${game.payout?.toFixed(2)}` : `-${game.wager}`} SOL
                        </p>
                        <SolToUsd sol={game.result === "won" ? (game.payout || 0) : game.wager} className="text-[10px] opacity-70" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div className="bg-muted/30 p-2 rounded text-center">
                        <p className="text-muted-foreground">Wager</p>
                        <p className="font-semibold">{game.wager} SOL</p>
                      </div>
                      <div className="bg-muted/30 p-2 rounded text-center">
                        <p className="text-muted-foreground">Pool</p>
                        <p className="font-semibold">{poolAmount.toFixed(2)} SOL</p>
                      </div>
                      <div className="bg-muted/30 p-2 rounded text-center">
                        <p className="text-muted-foreground">Players</p>
                        <p className="font-semibold">{totalPlayers}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {game.roundsSurvived !== undefined && (
                          <span className="text-muted-foreground">
                            Rounds survived: <span className="font-medium text-foreground">{game.roundsSurvived}</span>
                          </span>
                        )}
                        {game.opponents && game.opponents.length > 0 && (
                          <span className="text-muted-foreground">
                            vs {game.opponents.slice(0, 2).map(o => o.displayName || o.walletAddress.slice(0, 6)).join(", ")}
                            {game.opponents.length > 2 && ` +${game.opponents.length - 2} more`}
                          </span>
                        )}
                      </div>
                      <span className="text-secondary font-medium">+{game.wagaEarned} WAGA</span>
                    </div>
                  </motion.div>
                );
              })}
              {mockHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No games played yet</p>
                </div>
              )}
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

function formatTimeUntil(timestamp: number): string {
  const ms = timestamp - Date.now();
  if (ms <= 0) return "Now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
