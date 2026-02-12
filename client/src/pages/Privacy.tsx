import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Database, Eye, ShieldCheck, Lock } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen py-12 px-4 relative overflow-hidden">
      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: February 12, 2026</p>
          </div>

          <Card className="p-8 space-y-6 bg-black/40 border-primary/20 backdrop-blur-sm">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Database className="w-5 h-5" />
                <h2 className="text-xl font-semibold">1. Data Collected</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                As a decentralized application, MyLuckySol does not collect personal information such as names, emails, or physical addresses. We only process:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Public Wallet Addresses (Solana)</li>
                <li>Transaction Signatures and On-Chain Data</li>
                <li>Public Usernames and Avatar choices</li>
                <li>Game Performance Statistics</li>
              </ul>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Eye className="w-5 h-5" />
                <h2 className="text-xl font-semibold">2. Use of Data</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Data is used exclusively to facilitate game mechanics, calculate WAGA rewards, maintain the global leaderboard, and provide a personalized experience in your Profile dashboard.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-xl font-semibold">3. Blockchain Transparency</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                All game wagers, payouts, and WAGA reward distributions are recorded on the Solana blockchain. This data is public by nature and cannot be deleted or modified. By using MyLuckySol, you acknowledge the public nature of blockchain data.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Lock className="w-5 h-5" />
                <h2 className="text-xl font-semibold">4. Security</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                While we secure our off-chain database (for usernames and avatars), your primary security resides in your wallet provider. We never store or have access to your private keys or seed phrases.
              </p>
            </section>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
