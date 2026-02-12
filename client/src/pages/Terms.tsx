import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Shield, Scale, Coins, AlertCircle } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen py-12 px-4 relative overflow-hidden">
      <div className="container mx-auto max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: February 12, 2026</p>
          </div>

          <Card className="p-8 space-y-6 bg-black/40 border-primary/20 backdrop-blur-sm">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Scale className="w-5 h-5" />
                <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                By connecting your wallet to MyLuckySol, you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the platform. MyLuckySol is a decentralized application on the Solana blockchain.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-5 h-5" />
                <h2 className="text-xl font-semibold">2. Provably Fair System</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                MyLuckySol utilizes a cryptographic Provably Fair system (HMAC-SHA256) to ensure game integrity. By playing, you acknowledge that you understand how this system works and agree that the revealed seeds and hashes constitute final proof of game outcomes.
              </p>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Coins className="w-5 h-5" />
                <h2 className="text-xl font-semibold">3. Fees and Payouts</h2>
              </div>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Winners receive 90% of the total game pool.</li>
                <li>A 10% Foundation Fee is deducted from every pool to support platform maintenance and the WAGA economy.</li>
                <li>Username updates require a SOL payment ($1 for first, $0.50 for subsequent) to prevent network abuse.</li>
                <li>All transactions are final once confirmed on the Solana blockchain.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <AlertCircle className="w-5 h-5" />
                <h2 className="text-xl font-semibold">4. WAGA Token Economy</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                WAGA tokens are utility rewards and do not constitute an investment or financial instrument. 1000x Win Bonuses are subject to a 10% daily vesting schedule to ensure long-term ecosystem stability.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Risks and Responsibility</h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for the security of your own wallet and private keys. MyLuckySol is not responsible for any loss of funds due to wallet compromise, blockchain congestion, or software bugs. High-risk chance-based games carry the risk of total loss of wagered SOL.
              </p>
            </section>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
