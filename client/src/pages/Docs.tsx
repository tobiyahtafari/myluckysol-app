import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, ExternalLink, Shield, Gamepad2, Coins, Landmark } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CONTRACTS = [
  {
    name: "MyLuckySol Game Program",
    address: "MLKYs1v...placeholder...program",
    description: "Core game logic and house management",
    icon: Gamepad2
  },
  {
    name: "WAGA Token (WAGA)",
    address: "WAGAtkn...placeholder...address",
    description: "Utility token bridged from BSC (Fixed Supply)",
    icon: Coins
  },
  {
    name: "WAGA Rewards Escrow",
    address: "ESCRWvlt...placeholder...escrow",
    description: "Distribution point for wager and win bonuses",
    icon: Landmark
  },
  {
    name: "Treasury Wallet",
    address: "TRSRYwl...placeholder...wallet",
    description: "Foundation and platform maintenance funds",
    icon: Shield
  }
];

export default function Docs() {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} address copied to clipboard`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold font-display tracking-tight text-gradient-gold">
            Documentation
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Technical specifications, contract addresses, and the economic model of the MyLuckySol ecosystem.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="text-primary w-6 h-6" />
            <h2>Smart Contracts</h2>
          </div>
          <div className="grid gap-4">
            {CONTRACTS.map((contract) => (
              <Card key={contract.name} className="bg-card/50 border-primary/20 hover:border-primary/40 transition-colors">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <contract.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{contract.name}</h3>
                      <p className="text-sm text-muted-foreground">{contract.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-background/50 p-2 rounded-lg border border-border">
                    <code className="text-xs font-mono text-muted-foreground">
                      {contract.address}
                    </code>
                    <button
                      onClick={() => copyToClipboard(contract.address, contract.name)}
                      className="p-1 hover:text-primary transition-colors"
                      title="Copy Address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={`https://solscan.io/account/${contract.address}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:text-primary transition-colors"
                      title="View on Solscan"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-primary/10" />

        <section className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Coins className="text-primary w-5 h-5" />
              Tokenomics
            </h3>
            <div className="prose prose-invert text-muted-foreground">
              <p>
                WAGA is a fixed-supply utility token bridged from BSC. It is distributed via a dedicated rewards escrow to incentivize participation.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>100x SOL wager match reward (Escrow-paid)</li>
                <li>1000x SOL win bonus (Escrow-paid, Vested)</li>
                <li>10% daily vesting for win rewards</li>
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Gamepad2 className="text-primary w-5 h-5" />
              Game Mechanics
            </h3>
            <div className="prose prose-invert text-muted-foreground">
              <p>
                All games are provably fair using HMAC-SHA256 and server-side secret revelation.
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>House edge: 10% (Treasury)</li>
                <li>Player payout: 90% of pool</li>
                <li>Verified Randomness (VRF integration pending)</li>
              </ul>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
