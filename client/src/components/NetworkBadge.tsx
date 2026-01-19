import { useWallet } from "@/lib/wallet-context";
import type { NetworkType } from "@/lib/solana/wallet-adapter";

export function NetworkBadge() {
  const { network, switchNetwork, connected } = useWallet();

  if (!connected) return null;

  const isDevnet = network === "devnet";

  return (
    <button
      onClick={() => switchNetwork(isDevnet ? "mainnet-beta" : "devnet")}
      className={`
        px-2 py-1 rounded-md text-xs font-medium transition-colors
        ${isDevnet 
          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30" 
          : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
        }
      `}
      data-testid="button-network-toggle"
    >
      {isDevnet ? "Devnet" : "Mainnet"}
    </button>
  );
}

export function NetworkIndicator() {
  const { network } = useWallet();
  const isDevnet = network === "devnet";

  return (
    <div className="flex items-center gap-1.5">
      <div 
        className={`w-2 h-2 rounded-full ${isDevnet ? "bg-purple-500" : "bg-green-500"}`} 
      />
      <span className="text-xs text-gray-400">
        {isDevnet ? "Devnet" : "Mainnet"}
      </span>
    </div>
  );
}
