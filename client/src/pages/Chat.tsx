import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Flame, Droplets, Coins, X, MessageSquare, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface GlobalChatMessage {
  id: string;
  walletAddress: string;
  username?: string;
  message: string;
  timestamp: number;
  isGodStreak: boolean;
  isStreakBreaker: boolean;
  tipAmount?: number;
  tipRecipient?: string;
}

interface GameNotification {
  id: string;
  mode: string;
  wager: number;
  playerCount: number;
  createdAt: number;
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ChatMessageItem({ msg }: { msg: GlobalChatMessage }) {
  const isSystem = !msg.walletAddress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-2 px-3 py-2 rounded-lg",
        msg.isGodStreak && "bg-orange-500/5 border border-orange-500/20",
        msg.isStreakBreaker && "bg-blue-500/5 border border-blue-500/20",
        !msg.isGodStreak && !msg.isStreakBreaker && "hover:bg-white/[0.02]"
      )}
      data-testid={`msg-chat-${msg.id}`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {msg.isGodStreak ? (
          <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center god-fire-border">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
          </div>
        ) : msg.isStreakBreaker ? (
          <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center streak-water-border">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-border/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
            {(msg.username || msg.walletAddress).charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "text-xs font-semibold",
            msg.isGodStreak ? "text-orange-400" : msg.isStreakBreaker ? "text-blue-400" : "text-foreground"
          )}>
            {msg.username || formatAddress(msg.walletAddress)}
          </span>
          {msg.isGodStreak && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
              GOD
            </Badge>
          )}
          {msg.isStreakBreaker && (
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
              BREAKER
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">{formatTime(msg.timestamp)}</span>
        </div>
        <p className="text-sm text-foreground/90 break-words mt-0.5">{msg.message}</p>
      </div>
    </motion.div>
  );
}

function TipModal({
  onClose,
  walletAddress,
}: {
  onClose: () => void;
  walletAddress: string;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const { toast } = useToast();

  const tipMutation = useMutation({
    mutationFn: async (data: { fromWallet: string; toIdentifier: string; amount: number }) => {
      return apiRequest("POST", "/api/tip", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Tip sent",
        description: `${data.amount} SOL sent to ${data.recipient?.username || formatAddress(data.recipient?.walletAddress || "")}`,
      });
      onClose();
    },
    onError: (err: any) => {
      toast({
        title: "Tip failed",
        description: err.message || "Failed to process tip",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    const amt = parseFloat(amount);
    if (!recipient.trim() || isNaN(amt) || amt <= 0) return;
    tipMutation.mutate({
      fromWallet: walletAddress,
      toIdentifier: recipient.trim(),
      amount: amt,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background border border-border/60 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Send Tip
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} data-testid="button-close-tip">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Recipient (username or wallet)</label>
            <Input
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="username or wallet address"
              data-testid="input-tip-recipient"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount (SOL)</label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="0.001"
              step="0.01"
              data-testid="input-tip-amount"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-border/20 rounded-lg px-3 py-2">
            <span>Platform fee</span>
            <span className="font-mono">0.001 SOL</span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleSend}
          disabled={tipMutation.isPending || !recipient.trim() || !amount}
          data-testid="button-send-tip"
        >
          {tipMutation.isPending ? "Sending..." : "Send Tip"}
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          Tips are sent on-chain. The recipient must have a MyLuckySol account.
        </p>
      </motion.div>
    </motion.div>
  );
}

interface LiveGame {
  id: string;
  mode: string;
  wager: number;
  status: string;
  players: { walletAddress: string; username?: string }[];
  createdAt: number;
}

function NotificationPanel() {
  const { data: liveGames = [] } = useQuery<LiveGame[]>({
    queryKey: ["/api/games/live"],
    refetchInterval: 5000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Bell className="h-4 w-4 text-secondary" />
        <span className="font-semibold text-sm">Live Games</span>
        {liveGames.length > 0 && (
          <Badge variant="outline" className="text-accent border-accent/30 text-xs">
            {liveGames.length}
          </Badge>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {liveGames.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No live games right now
            </div>
          )}
          {liveGames.map((game: LiveGame) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-sm"
              data-testid={`notif-game-${game.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground capitalize">{game.mode}</span>
                <Badge variant="outline" className="text-primary border-primary/30 font-mono text-xs">
                  {game.wager} SOL
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {game.players.length} players — {game.status}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Chat() {
  const { connected, address: walletAddress, profile } = useWallet();
  const { toast } = useToast();
  const queryClientInstance = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [tipModalOpen, setTipModalOpen] = useState(false);

  const { data: messages = [], isLoading } = useQuery<GlobalChatMessage[]>({
    queryKey: ["/api/chat"],
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", "/api/chat", {
        walletAddress,
        message,
      });
    },
    onSuccess: () => {
      setInput("");
      queryClientInstance.invalidateQueries({ queryKey: ["/api/chat"] });
    },
    onError: (err: any) => {
      toast({
        title: "Cannot send message",
        description: err.message || "You must wager at least 0.1 SOL to chat.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || !connected || sendMutation.isPending) return;
    sendMutation.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canChat = connected && (profile?.totalWagered || 0) >= 0.1;

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile: vertical stack. Desktop: horizontal split */}
      <div className="flex flex-col md:flex-row h-full">
        {/* Chat Panel - top 60% on mobile, left 60% on desktop */}
        <div className="flex flex-col h-[60%] md:h-full md:w-3/5 border-b md:border-b-0 md:border-r border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Global Chat</span>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {messages.length} messages
              </Badge>
            </div>
            {connected && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setTipModalOpen(true)}
                data-testid="button-open-tip"
              >
                <Coins className="h-3 w-3" />
                Tip
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
            {isLoading && (
              <div className="text-center text-muted-foreground text-sm py-8">Loading chat...</div>
            )}
            {!isLoading && messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                No messages yet. Be the first to chat!
              </div>
            )}
            {messages.map(msg => (
              <ChatMessageItem key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border/50 flex-shrink-0">
            {!connected ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                Connect your wallet to chat
              </div>
            ) : !canChat ? (
              <div className="text-center text-xs text-muted-foreground py-2 bg-border/10 rounded-lg px-3">
                Wager at least 0.1 SOL total to unlock chat
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  maxLength={280}
                  className="flex-1 h-9 text-sm"
                  data-testid="input-chat-message"
                />
                <Button
                  size="sm"
                  className="h-9 px-3"
                  onClick={handleSend}
                  disabled={sendMutation.isPending || !input.trim()}
                  data-testid="button-send-chat"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
            {connected && (
              <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                {profile?.godStreakActive && <Flame className="h-3 w-3 text-orange-400" />}
                {profile?.isStreakBreakerActive && <Droplets className="h-3 w-3 text-blue-400" />}
                <span>{input.length}/280 chars</span>
                <span className="ml-auto">Press Enter to send</span>
              </div>
            )}
          </div>
        </div>

        {/* Notifications Panel - bottom 40% on mobile, right 40% on desktop */}
        <div className="h-[40%] md:h-full md:w-2/5 overflow-hidden">
          <NotificationPanel />
        </div>
      </div>

      <AnimatePresence>
        {tipModalOpen && walletAddress && (
          <TipModal walletAddress={walletAddress} onClose={() => setTipModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
