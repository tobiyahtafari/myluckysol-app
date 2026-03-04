import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Flame, Droplets, X, MessageSquare, Bell, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/game-store";
import { GAME_MODES, type GameModeKey } from "@shared/schema";
import { Link, useLocation } from "wouter";

interface GlobalChatMessage {
  id: string;
  walletAddress: string;
  username?: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
  isGodStreak: boolean;
  isStreakBreaker: boolean;
  color?: string;
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
        {msg.avatarUrl ? (
          <div className={cn(
            "w-7 h-7 rounded-full overflow-hidden border",
            msg.isGodStreak ? "border-orange-500/40 god-fire-border" : 
            msg.isStreakBreaker ? "border-blue-500/40 streak-water-border" : 
            "border-border/50"
          )}>
            <img src={msg.avatarUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : msg.isGodStreak ? (
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
        <p className="text-sm break-words mt-0.5" style={{ color: msg.color || "rgba(255, 255, 255, 0.9)" }}>
          {msg.message}
        </p>
      </div>
    </motion.div>
  );
}


interface LiveGame {
  id: string;
  mode: GameModeKey;
  wager: number;
  status: string;
  players: { walletAddress: string; username?: string }[];
  createdAt: number;
}

function NotificationPanel() {
  const { setSelectedMode, setSelectedWager, setPlayTab } = useGameStore();
  const [, setLocation] = useLocation();
  const { address } = useWallet();
  const { data: liveGames = [] } = useQuery<LiveGame[]>({
    queryKey: ["/api/games/live"],
    refetchInterval: 5000,
  });

  // Only show games that have at least one player (meaning payment confirmed)
  const confirmedGames = liveGames.filter(g => g.players.length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Bell className="h-4 w-4 text-secondary" />
        <span className="font-semibold text-sm">Live Games</span>
        {confirmedGames.length > 0 && (
          <Badge variant="outline" className="text-accent border-accent/30 text-xs">
            {confirmedGames.length}
          </Badge>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence>
          {confirmedGames.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              No live games right now
            </div>
          )}
          {confirmedGames.map((game: LiveGame) => {
            const config = GAME_MODES[game.mode];
            const isFull = game.players.length >= config.players;
            const isJoined = game.players.some(p => p.walletAddress === address);

            return (
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
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground">
                    {isFull ? "In-Progress" : `Waiting for ${config.players - game.players.length} more`}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-[10px] text-accent hover:text-accent hover:bg-accent/10"
                    onClick={() => {
                      if (isFull || isJoined) {
                        setLocation(`/game/${game.id}`);
                      } else {
                        setSelectedMode(game.mode);
                        setSelectedWager(game.wager as any);
                        setPlayTab("join");
                        setLocation("/play");
                      }
                    }}
                  >
                    {isFull || isJoined ? "Spectate" : "Join Game"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
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
  const [selectedColor, setSelectedColor] = useState("#ffffff");

  const CHAT_COLORS = [
    { name: "White", value: "#ffffff" },
    { name: "Gold", value: "#facc15" },
    { name: "Cyan", value: "#22d3ee" },
    { name: "Pink", value: "#f472b6" },
    { name: "Green", value: "#4ade80" },
    { name: "Orange", value: "#fb923c" },
    { name: "Purple", value: "#c084fc" },
  ];

  const CHAT_EMOJIS = ["🔥", "💰", "🚀", "🍀", "💎", "💯", "GG", "GL", "LFG", "😎", "🤑", "🙌"];

  const { data: messages = [], isLoading } = useQuery<GlobalChatMessage[]>({
    queryKey: ["/api/chat"],
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ message, color }: { message: string; color: string }) => {
      return apiRequest("POST", "/api/chat", {
        walletAddress,
        message,
        color,
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

  // Auto-scroll to bottom
  useEffect(() => {
    const container = document.getElementById("chat-messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    const msg = input.trim();
    if (!msg || !connected || sendMutation.isPending) return;
    sendMutation.mutate({ message: msg, color: selectedColor });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canChat = connected && (profile?.totalWagered || 0) >= 0.1;

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex flex-col md:flex-row h-full">
        <div className="flex flex-col h-[60%] md:h-full md:w-3/5 border-b md:border-b-0 md:border-r border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Global Chat</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-0.5" id="chat-messages-container">
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
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {CHAT_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => setSelectedColor(color.value)}
                        className={cn(
                          "w-5 h-5 rounded-full border border-white/10 transition-transform hover:scale-110",
                          selectedColor === color.value && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5" data-testid="button-emoji-picker">
                          <Smile className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2 bg-popover/95 backdrop-blur-md border-border/50" side="top" align="end">
                        <div className="grid grid-cols-4 gap-1">
                          {CHAT_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => setInput(prev => prev + emoji)}
                              className="h-10 flex items-center justify-center hover:bg-primary/10 rounded transition-colors text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    maxLength={280}
                    className="flex-1 h-9 text-sm"
                    style={{ color: selectedColor }}
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3"
                    onClick={handleSubmit}
                    disabled={sendMutation.isPending || !input.trim()}
                    data-testid="button-send-chat"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
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

        <div className="h-[40%] md:h-full md:w-2/5 overflow-hidden">
          <NotificationPanel />
        </div>
      </div>
    </div>
  );
}
