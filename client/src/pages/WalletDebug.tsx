import { useEffect, useState } from "react";

interface StandardWallet {
  name: string;
  version: string;
  icon: string;
  chains: string[];
  features: string[];
  accounts: { address: string; chains: string[] }[];
}

interface WalletEnv {
  userAgent: string;
  hasEthereum: boolean;
  ethereumIsMetaMask: boolean | undefined;
  ethereumHasSolana: boolean;
  ethereumKeys: string[];
  hasSolana: boolean;
  solanaIsMetaMask: boolean | undefined;
  solanaIsPhantom: boolean | undefined;
  solanaKeys: string[];
  hasPhantom: boolean;
  phantomHasSolana: boolean;
  hasOkxWallet: boolean;
  hasBackpack: boolean;
  hasXnft: boolean;
  standardWallets: StandardWallet[];
  walletStandardSupported: boolean;
  ethereumSolanaRpcMethods: string[];
}

export default function WalletDebug() {
  const [env, setEnv] = useState<WalletEnv | null>(null);

  useEffect(() => {
    const w = window as any;
    const standardWallets: StandardWallet[] = [];

    const appReadyAPI = {
      register(wallet: any) {
        if (wallet && !standardWallets.find(w => w.name === wallet.name)) {
          standardWallets.push({
            name: wallet.name ?? "unknown",
            version: wallet.version ?? "?",
            icon: wallet.icon ?? "",
            chains: wallet.chains ?? [],
            features: Object.keys(wallet.features ?? {}),
            accounts: wallet.accounts ?? [],
          });
        }
        return () => {};
      },
    };

    const handleWalletRegister = (event: any) => {
      const callback = event.detail;
      if (typeof callback === "function") {
        callback(appReadyAPI);
      }
    };

    window.addEventListener("wallet-standard:register-wallet", handleWalletRegister);
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: appReadyAPI }));

    const testEthereumSolanaMethods = async () => {
      const supportedMethods: string[] = [];
      if (w.ethereum?.request) {
        const methodsToTest = ["solana_requestAccounts", "solana_getAccounts", "solana_signTransaction", "solana_signMessage", "wallet_getCapabilities"];
        for (const method of methodsToTest) {
          try {
            await w.ethereum.request({ method });
            supportedMethods.push(method + " (OK)");
          } catch (e: any) {
            if (e?.code !== -32601 && e?.code !== 4001) {
              supportedMethods.push(method + " (err:" + e?.code + ")");
            } else if (e?.code === 4001) {
              supportedMethods.push(method + " (user rejected - exists!)");
            }
          }
        }
      }

      setTimeout(() => {
        setEnv({
          userAgent: navigator.userAgent,
          hasEthereum: !!w.ethereum,
          ethereumIsMetaMask: w.ethereum?.isMetaMask,
          ethereumHasSolana: !!w.ethereum?.solana,
          ethereumKeys: w.ethereum ? Object.keys(w.ethereum).filter((k: string) => !k.startsWith("_")) : [],
          hasSolana: !!w.solana,
          solanaIsMetaMask: w.solana?.isMetaMask,
          solanaIsPhantom: w.solana?.isPhantom,
          solanaKeys: w.solana ? Object.keys(w.solana).filter((k: string) => !k.startsWith("_")) : [],
          hasPhantom: !!w.phantom,
          phantomHasSolana: !!w.phantom?.solana,
          hasOkxWallet: !!w.okxwallet,
          hasBackpack: !!w.backpack,
          hasXnft: !!w.xnft,
          standardWallets: [...standardWallets],
          walletStandardSupported: "wallet-standard:register-wallet" in window || standardWallets.length > 0,
          ethereumSolanaRpcMethods: supportedMethods,
        });
      }, 1500);
    };

    testEthereumSolanaMethods();

    return () => {
      window.removeEventListener("wallet-standard:register-wallet", handleWalletRegister);
    };
  }, []);

  const Row = ({ label, value }: { label: string; value: unknown }) => (
    <div className="flex gap-3 py-2 border-b border-white/10 text-sm">
      <span className="text-gray-400 min-w-[240px] shrink-0">{label}</span>
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
      <h1 className="text-xl font-bold text-yellow-400 mb-2">Wallet Environment Debug</h1>
      <p className="text-gray-500 text-xs mb-4">Loading takes ~1.5s to test RPC methods. Screenshot when done.</p>
      {!env ? (
        <p className="text-yellow-400 animate-pulse">Scanning wallet environment...</p>
      ) : (
        <div className="space-y-1">
          <div className="text-yellow-300 font-bold mt-4 mb-1">User Agent</div>
          <div className="text-xs text-gray-300 break-all bg-white/5 p-2 rounded">{env.userAgent}</div>

          <div className="text-yellow-300 font-bold mt-4 mb-1">Wallet Standard (how Raydium detects)</div>
          <Row label="wallets registered" value={env.standardWallets.length} />
          {env.standardWallets.map((w, i) => (
            <div key={i} className="bg-white/5 rounded p-2 my-1 text-xs">
              <div className="text-green-400 font-bold">{w.name} v{w.version}</div>
              <div className="text-gray-400">chains: {w.chains.join(", ") || "none"}</div>
              <div className="text-gray-400">features: {w.features.slice(0, 5).join(", ")}</div>
            </div>
          ))}
          {env.standardWallets.length === 0 && (
            <div className="text-red-400 text-sm">No Wallet Standard wallets detected</div>
          )}

          <div className="text-yellow-300 font-bold mt-4 mb-1">window.ethereum Solana RPC (MetaMask Snaps)</div>
          {env.ethereumSolanaRpcMethods.length === 0 ? (
            <div className="text-red-400 text-sm">No Solana RPC methods detected</div>
          ) : (
            env.ethereumSolanaRpcMethods.map((m, i) => (
              <div key={i} className="text-green-400 text-xs py-1">{m}</div>
            ))
          )}

          <div className="text-yellow-300 font-bold mt-4 mb-1">window.ethereum</div>
          <Row label="exists" value={env.hasEthereum} />
          <Row label=".isMetaMask" value={env.ethereumIsMetaMask} />
          <Row label=".solana exists" value={env.ethereumHasSolana} />
          <Row label="keys" value={env.ethereumKeys.slice(0, 20).join(", ")} />

          <div className="text-yellow-300 font-bold mt-4 mb-1">window.solana</div>
          <Row label="exists" value={env.hasSolana} />
          <Row label=".isMetaMask" value={env.solanaIsMetaMask} />
          <Row label=".isPhantom" value={env.solanaIsPhantom} />
          <Row label="keys" value={env.solanaKeys.slice(0, 20).join(", ")} />

          <div className="text-yellow-300 font-bold mt-4 mb-1">Other Wallets</div>
          <Row label="window.phantom exists" value={env.hasPhantom} />
          <Row label="window.phantom.solana exists" value={env.phantomHasSolana} />
          <Row label="window.okxwallet exists" value={env.hasOkxWallet} />
          <Row label="window.backpack exists" value={env.hasBackpack} />
          <Row label="window.xnft exists" value={env.hasXnft} />
        </div>
      )}
      <p className="text-gray-600 text-xs mt-8">Screenshot this entire page and share it for debugging.</p>
    </div>
  );
}
