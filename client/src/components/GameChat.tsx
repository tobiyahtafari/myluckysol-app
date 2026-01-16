import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage, PlayerProfile } from "@shared/schema";
import { useWallet } from "@/lib/wallet-context";

export function GameChat({ gameId }: { gameId: string }) {
  const { address, connected } = useWallet();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="flex flex-col h-[400px] border-card-border">
      <div className="p-3 border-b border-card-border bg-card/50">
        <h3 className="text-sm font-semibold">Game Chat</h3>
      </div>
      
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">
                  {msg.username || msg.walletAddress.slice(0, 6)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm bg-muted/30 p-2 rounded-lg break-words">
                {msg.message}
              </p>
            </div>
          ))}
          {messages.length === 0 && !isLoading && (
            <p className="text-center text-xs text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </p>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-3 border-t border-card-border bg-card/50 flex gap-2">
        <Input
          placeholder={connected ? "Type a message..." : "Connect wallet to chat"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!connected || sendMutation.isPending}
          className="flex-1 h-9 text-sm"
        />
        <Button size="icon" disabled={!connected || sendMutation.isPending || !message.trim()}>
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </Card>
  );
}
