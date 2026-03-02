import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LuckBar } from "@/components/LuckBar";
import { useWallet } from "@/lib/wallet-context";
import { Link, useLocation } from "wouter";
import type { PlayerProfile, GameHistory } from "@shared/schema";
import { VESTING_DAILY_PERCENT, REFERRAL_REWARD_AMOUNT } from "@shared/schema";
import { Wallet, Trophy, Gamepad2, TrendingUp, Coins, Clock, ArrowRight, Flame, Loader2, Link as LinkIcon, Copy, Check, Lock, Unlock, AlertTriangle, Smartphone, Gift } from "lucide-react";
import { AvatarPicker } from "@/components/AvatarPicker";
import { useSolPrice, SolToUsd } from "@/lib/price-context";
import { useState, useEffect } from "react";
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
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newUsername, setNewUsername] = useState("");
  const [referrerAddress, setReferrerAddress] = useState("");
  const [copied, setCopy] = useState(false);
  const [isPayingForUsername, setIsPayingForUsername] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [showReferralPopup, setShowReferralPopup] = useState(false);
  const [isWeb3Browser, setIsWeb3Browser] = useState(true);

  // Check for Web3 browser on mobile
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const hasSolana = !!(window as any).solana || !!(window as any).phantom || !!(window as any).solflare;
      setIsWeb3Browser(hasSolana);
    }

    // Check for referral in URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setReferrerAddress(ref);
      setShowReferralPopup(true);
    }
  }, []);

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
    ? `${window.location.origin}/profile?ref=${encodeURIComponent(profile.username)}`
    : "";

  const copyReferral = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopy(true);
    setTimeout(() => setCopy(false), 2000);
    toast({ title: "Referral link copied!" });
  };

  const { data: history = [] } = useQuery<GameHistory[]>({
    queryKey: ['/api/profile', address, 'history'],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${address}/history`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
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
        description: (err.errors?.[0]?.message || "Between 3-20 chars, letters, numbers, ._- only") + " (no spaces)",
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
        referredBy: referrerAddress || undefined,
      });
      const data = await res.json();

      queryClient.invalidateQueries({ queryKey: ['/api/profile', address] });
      refetchCost();
      setNewUsername("");
      setShowReferralPopup(false);

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

  if (!isWeb3Browser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Web3 Browser Required</h1>
          <p className="text-muted-foreground mb-8">
            You are using a standard mobile browser. To access MyLuckySol and use the referral program, please copy this link and paste it into a Web3-enabled browser like Phantom, Solflare, or OKX Wallet app.
          </p>
          <div className="flex gap-2 mb-8">
            <Input readOnly value={window.location.href} className="text-xs" />
            <Button size="icon" variant="outline" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast({ title: "Link copied!" });
            }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

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
      <AnimatePresence>
        {showReferralPopup && !hasUsername && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <Card className="max-w-md p-8 border-primary/30 shadow-[0_0_50px_rgba(245,184,0,0.2)]">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Gift className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Referral Bonus Waiting!</h2>
                <p className="text-muted-foreground">
                  You've been referred by <span className="text-primary font-bold">{referrerAddress}</span>. 
                  Pay $1 to set your username now to unlock <span className="text-primary font-bold">100 WAGA</span> for both of you!
                </p>
                <div className="pt-4 flex flex-col gap-2">
                  <Button size="lg" onClick={() => {
                    const el = document.getElementById('username-input');
                    el?.focus();
                    setShowReferralPopup(false);
                  }}>
                    Set Username Now
                  </Button>
                  <Button variant="ghost" onClick={() => setShowReferralPopup(false)}>
                    Maybe Later
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
                <button
                  onClick={() => setAvatarPickerOpen(true)}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-4xl font-bold text-white overflow-hidden border-2 border-primary/20 cursor-pointer"
                  data-testid="button-open-avatar-picker"
                >
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (address || "W").charAt(0).toUpperCase()
                  )}
                </button>
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-full">
                  <span className="text-xs font-medium text-white">Change</span>
                </div>
                <AvatarPicker
                  open={avatarPickerOpen}
                  onOpenChange={setAvatarPickerOpen}
                  currentAvatar={profile?.avatarUrl}
                  canUpload={(profile?.usernameUpdateCount || 0) > 0}
                  onSelect={(url) => {
                    updateAvatarMutation.mutate(url);
                    setAvatarPickerOpen(false);
                  }}
                  isLoading={updateAvatarMutation.isPending}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold mb-1" data-testid="text-username">{profile?.username || shortAddress}</h1>
                <p className="text-muted-foreground text-sm break-all">{address}</p>
                <form onSubmit={handleUpdateUsername} className="mt-4 space-y-2 max-w-sm mx-auto md:mx-0">
                  <div className="flex gap-2">
                    <Input
                      id="username-input"
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
                {!profile?.referredBy ? (
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
                  <div className="p-3 rounded-lg bg-amber-400/10 border border-amber-400/30">
                    <p className="text-xs text-amber-400 flex items-center gap-1 font-bold mb-1" data-testid="text-referral-pending">
                      <Clock className="w-3 h-3" />
                      REFERRAL PENDING
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Referred by: {profile.referredBy}
                    </p>
                    {hasUsername ? (
                      <p className="text-[10px] text-amber-400 italic">
                        Waiting for on-chain reward processing...
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-400">
                        Set your username above to claim {REFERRAL_REWARD_AMOUNT} WAGA
                      </p>
                    )}
                  </div>
                ) : profile?.referralRewarded ? (
                  <p className="text-xs text-accent flex items-center gap-1" data-testid="text-referral-claimed">
                    <Check className="w-3 h-3" />
                    Referral reward claimed: +{REFERRAL_REWARD_AMOUNT} WAGA
                  </p>
                ) : null}
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

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Next release: {vestingData.dailyAmount.toLocaleString()} WAGA</span>
                  <span className="font-mono text-muted-foreground">
                    {vestingData.nextClaimTime > Date.now() 
                      ? `Available in ${Math.ceil((vestingData.nextClaimTime - Date.now()) / (1000 * 60 * 60))}h`
                      : "Ready to claim"}
                  </span>
                </div>
                <Progress 
                  value={(vestingData.claimed / (vestingData.totalVesting || 1)) * 100} 
                  className="h-2"
                />
                <Button 
                  className="w-full gap-2" 
                  disabled={!vestingData.canClaim || claimVestingMutation.isPending}
                  onClick={() => claimVestingMutation.mutate()}
                  data-testid="button-claim-vesting"
                >
                  {claimVestingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Claim Daily Release
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Game History
            </h3>
            <div className="space-y-2 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-4 py-2">Mode</th>
                    <th className="px-4 py-2">Wager</th>
                    <th className="px-4 py-2 text-right">Result</th>
                    <th className="px-4 py-2 text-right">Payout</th>
                    <th className="px-4 py-2 text-right">WAGA</th>
                    <th className="px-4 py-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No games played yet. <Link href="/play" className="text-primary hover:underline">Start playing!</Link>
                      </td>
                    </tr>
                  )}
                  {mockHistory.map((game, i) => {
                    const isWin = game.result === "win";
                    return (
                      <tr key={game.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{game.mode}</td>
                        <td className="px-4 py-3 font-mono">{game.wager} SOL</td>
                        <td className={`px-4 py-3 text-right font-bold ${isWin ? "text-green-400" : "text-destructive"}`}>
                          {game.result.toUpperCase()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{game.payoutSol.toFixed(2)} SOL</td>
                        <td className="px-4 py-3 text-right text-secondary">+{game.wagaReward.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground text-[10px]">
                          {new Date(game.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
