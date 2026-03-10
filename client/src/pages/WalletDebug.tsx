import { useEffect, useState } from "react";

interface WalletEnv {
  userAgent: string;
  hasEthereum: boolean;
  ethereumIsMetaMask: boolean | undefined;
  ethereumHasSolana: boolean;
  ethereumKeys: string[];
  ethereumSolanaKeys: string[];
  hasSolana: boolean;
  solanaIsMetaMask: boolean | undefined;
  solanaIsPhantom: boolean | undefined;
  solanaIsSolflare: boolean | undefined;
  solanaKeys: string[];
  hasPhantom: boolean;
  phantomHasSolana: boolean;
  hasOkxWallet: boolean;
  hasBackpack: boolean;
  hasXnft: boolean;
}

export default function WalletDebug() {
  const [env, setEnv] = useState<WalletEnv | null>(null);

  useEffect(() => {
    const w = window as any;
    setEnv({
      userAgent: navigator.userAgent,
      hasEthereum: !!w.ethereum,
      ethereumIsMetaMask: w.ethereum?.isMetaMask,
      ethereumHasSolana: !!w.ethereum?.solana,
      ethereumKeys: w.ethereum ? Object.keys(w.ethereum).filter((k: string) => !k.startsWith("_")) : [],
      ethereumSolanaKeys: w.ethereum?.solana ? Object.keys(w.ethereum.solana).filter((k: string) => !k.startsWith("_")) : [],
      hasSolana: !!w.solana,
      solanaIsMetaMask: w.solana?.isMetaMask,
      solanaIsPhantom: w.solana?.isPhantom,
      solanaIsSolflare: w.solana?.isSolflare,
      solanaKeys: w.solana ? Object.keys(w.solana).filter((k: string) => !k.startsWith("_")) : [],
      hasPhantom: !!w.phantom,
      phantomHasSolana: !!w.phantom?.solana,
      hasOkxWallet: !!w.okxwallet,
      hasBackpack: !!w.backpack,
      hasXnft: !!w.xnft,
    });
  }, []);

  const Row = ({ label, value }: { label: string; value: unknown }) => (
    <div className="flex gap-3 py-2 border-b border-white/10 text-sm">
      <span className="text-gray-400 min-w-[220px] shrink-0">{label}</span>
      <span className={
        value === true ? "text-green-400" :
        value === false ? "text-red-400" :
        value === undefined || value === null ? "text-gray-500" :
        "text-yellow-300"
      }>
        {value === undefined ? "undefined" : value === null ? "null" : String(value)}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 font-mono">
      <h1 className="text-xl font-bold text-yellow-400 mb-4">Wallet Environment Debug</h1>
      {!env ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-1">
          <div className="text-yellow-300 font-bold mt-4 mb-1">User Agent</div>
          <div className="text-xs text-gray-300 break-all bg-white/5 p-2 rounded">{env.userAgent}</div>

          <div className="text-yellow-300 font-bold mt-4 mb-1">window.ethereum</div>
          <Row label="exists" value={env.hasEthereum} />
          <Row label=".isMetaMask" value={env.ethereumIsMetaMask} />
          <Row label=".solana exists" value={env.ethereumHasSolana} />
          <Row label="keys" value={env.ethereumKeys.slice(0, 20).join(", ")} />
          {env.ethereumHasSolana && (
            <Row label=".solana keys" value={env.ethereumSolanaKeys.slice(0, 20).join(", ")} />
          )}

          <div className="text-yellow-300 font-bold mt-4 mb-1">window.solana</div>
          <Row label="exists" value={env.hasSolana} />
          <Row label=".isMetaMask" value={env.solanaIsMetaMask} />
          <Row label=".isPhantom" value={env.solanaIsPhantom} />
          <Row label=".isSolflare" value={env.solanaIsSolflare} />
          <Row label="keys" value={env.solanaKeys.slice(0, 20).join(", ")} />

          <div className="text-yellow-300 font-bold mt-4 mb-1">Other Wallets</div>
          <Row label="window.phantom exists" value={env.hasPhantom} />
          <Row label="window.phantom.solana exists" value={env.phantomHasSolana} />
          <Row label="window.okxwallet exists" value={env.hasOkxWallet} />
          <Row label="window.backpack exists" value={env.hasBackpack} />
          <Row label="window.xnft exists" value={env.hasXnft} />
        </div>
      )}
      <p className="text-gray-600 text-xs mt-8">Screenshot this page and share it for debugging.</p>
    </div>
  );
}
