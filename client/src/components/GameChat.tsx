import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, ChevronDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, PlayerProfile } from "@shared/schema";
import { useWallet } from "@/lib/wallet-context";

export function GameChat({ gameId }: { gameId: string }) {
  const { address, connected } = useWallet();
  const [message, setMessage] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery<PlayerProfile>({
    queryKey: ["/api/profile", address],
    enabled: !!address,
  });

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/games", gameId, "chat"],
    refetchInterval: 2000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/games/${gameId}/chat`, {
        walletAddress: address,
        username: profile?.username || address?.slice(0, 8),
        message: content,
      });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "chat"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sendMutation.isPending || !connected) return;
    sendMutation.mutate(message.trim());
  };

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "instant" 
      });
    }
    setHasNewMessages(false);
    setIsAtBottom(true);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const threshold = 50;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsAtBottom(atBottom);

    if (atBottom) {
      setHasNewMessages(false);
    }
  }, []);

  useEffect(() => {
    const newMessageIds = messages.map(m => m.id);
    const hasNew = newMessageIds.some(id => !seenMessageIds.has(id));

    if (hasNew) {
      if (isAtBottom) {
        setTimeout(() => scrollToBottom(), 100);
        setSeenMessageIds(new Set(newMessageIds));
      } else {
        setHasNewMessages(true);
      }
    }
  }, [messages, isAtBottom, scrollToBottom, seenMessageIds]);

  useEffect(() => {
    if (messages.length > 0 && seenMessageIds.size === 0) {
      setSeenMessageIds(new Set(messages.map(m => m.id)));
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [messages, seenMessageIds.size, scrollToBottom]);

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-purple-500/20 via-transparent to-cyan-500/10 blur-xl -z-10" />
      <Card className="flex flex-col h-[400px] border-purple-500/30 bg-card/80 backdrop-blur-sm overflow-hidden">
        <div className="p-3 border-b border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10">
          <h3 className="text-sm font-semibold text-gradient-solana">Game Chat</h3>
        </div>
        
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 p-4 overflow-y-auto scroll-smooth"
        >
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isNew = !seenMessageIds.has(msg.id);
                return (
                  <motion.div 
                    key={msg.id} 
                    initial={isNew ? { opacity: 0, y: 20, scale: 0.95 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gradient-solana">
                        {msg.username || msg.walletAddress.slice(0, 6)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm bg-purple-500/10 border border-purple-500/20 p-2 rounded-lg break-words">
                      {msg.message}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {messages.length === 0 && !isLoading && (
              <p className="text-center text-xs text-muted-foreground py-8">
                No messages yet. Start the conversation!
              </p>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <AnimatePresence>
          {hasNewMessages && !isAtBottom && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-[70px] left-1/2 -translate-x-1/2 z-20"
            >
              <button
                onClick={() => scrollToBottom()}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-xs font-medium shadow-lg animate-pulse cursor-pointer"
                style={{
                  boxShadow: '0 0 20px rgba(153, 69, 255, 0.5), 0 0 40px rgba(3, 225, 255, 0.3)'
                }}
                data-testid="button-new-messages"
              >
                <ChevronDown className="w-4 h-4" />
                New messages
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="p-3 border-t border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5 flex gap-2">
          <Input
            placeholder={connected ? "Type a message..." : "Connect wallet to chat"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!connected || sendMutation.isPending}
            className="flex-1 h-9 text-sm border-purple-500/30 focus:border-purple-500/50 bg-background/50"
          />
          <Button size="icon" disabled={!connected || sendMutation.isPending || !message.trim()} className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 border-0">
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
