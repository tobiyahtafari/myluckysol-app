import { WalletConnectWalletAdapter } from "@walletconnect/solana-adapter";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import type { WalletAdapter } from "./wallet-adapter";

let _wcAdapter: WalletConnectWalletAdapter | null = null;

function buildWCAdapter(network: WalletAdapterNetwork): WalletConnectWalletAdapter {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;
  return new WalletConnectWalletAdapter({
    network,
    options: {
      projectId,
      metadata: {
        name: "MyLuckySol",
        description: "Provably Fair Solana Chance Game",
        url: "https://myluckysol.fun",
        icons: ["https://myluckysol.fun/favicon.ico"],
      },
    },
  });
}

function getWCAdapter(network: WalletAdapterNetwork = WalletAdapterNetwork.Mainnet): WalletConnectWalletAdapter {
  if (!_wcAdapter) {
    _wcAdapter = buildWCAdapter(network);
  }
  return _wcAdapter;
}

export function resetWCAdapter() {
  _wcAdapter = null;
}

export function getWalletConnectAdapter(network: WalletAdapterNetwork = WalletAdapterNetwork.Mainnet): WalletAdapter | null {
  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
  if (!projectId) return null;

  const wc = getWCAdapter(network);

  const adapter: WalletAdapter = {
    get publicKey() {
      return wc.publicKey ?? null;
    },
    get connected() {
      return wc.connected;
    },
    get connecting() {
      return wc.connecting;
    },
    async connect() {
      if (!wc.connected) {
        await wc.connect();
      }
    },
    async disconnect() {
      if (wc.connected) {
        await wc.disconnect();
      }
      resetWCAdapter();
    },
    async signTransaction(transaction) {
      return wc.signTransaction(transaction);
    },
    async signAllTransactions(transactions) {
      if (wc.signAllTransactions) {
        return wc.signAllTransactions(transactions);
      }
      return Promise.all(transactions.map((tx) => wc.signTransaction(tx)));
    },
    async signMessage(message) {
      if (!wc.signMessage) throw new Error("WalletConnect signMessage not supported");
      const sig = await wc.signMessage(message);
      return { signature: sig instanceof Uint8Array ? sig : new Uint8Array(sig) };
    },
    on(event: string, handler: (...args: any[]) => void) {
      wc.on(event as any, handler as any);
    },
    off(event: string, handler: (...args: any[]) => void) {
      wc.off(event as any, handler as any);
    },
  };

  return adapter;
}
