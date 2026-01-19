import { useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { Loader2 } from "lucide-react";
import type { NetworkType } from "@/lib/solana/wallet-adapter";

export function NetworkBadge() {
  const { network, switchNetwork, connected, balanceLoading } = useWallet();
  const [switching, setSwitching] = useState(false);

  if (!connected) return null;

  const isDevnet = network === "devnet";

  const handleSwitch = async () => {
    const newNetwork: NetworkType = isDevnet ? "mainnet-beta" : "devnet";
    
    if (!isDevnet) {
      const confirmed = window.confirm(
        "You are about to switch to Mainnet where real SOL is used. Continue?"
      );
      if (!confirmed) return;
    }
    
    setSwitching(true);
    try {
      await switchNetwork(newNetwork);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <button
      onClick={handleSwitch}
      disabled={switching || balanceLoading}
      className={`
        px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1
        ${isDevnet 
          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30" 
          : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      data-testid="button-network-toggle"
    >
      {(switching || balanceLoading) && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
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
