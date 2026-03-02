import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { Link } from "wouter";
import { Users, ChevronLeft, Check, Clock, User } from "lucide-react";

interface ReferralData {
  walletAddress: string;
  username: string | null;
  referralRewarded: boolean;
  createdAt: number;
}

export default function ReferralTracking() {
  const { connected, address } = useWallet();

  const { data: referrals = [], isLoading } = useQuery<ReferralData[]>({
    queryKey: ['/api/profile', address, 'referrals'],
    enabled: connected && !!address,
  });

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please connect your wallet</h1>
          <Link href="/profile">
            <Button>Back to Profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-background text-foreground">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profile">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            Referral Tracking
          </h1>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Loading referrals...
                    </td>
                  </tr>
                ) : referrals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No referrals found.
                    </td>
                  </tr>
                ) : (
                  referrals.map((ref) => (
                    <tr key={ref.walletAddress} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4 font-medium flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        {ref.username || "Anonymous"}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs opacity-70">
                        {ref.walletAddress.slice(0, 4)}...{ref.walletAddress.slice(-4)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {ref.referralRewarded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            REWARDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-muted-foreground">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
