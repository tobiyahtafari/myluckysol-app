import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SendOptions,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
  sendTransaction?(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<string>;
  on?(event: string, callback: (...args: any[]) => void): void;
  off?(event: string, callback: (...args: any[]) => void): void;
}

export interface PhantomProvider extends WalletAdapter {
  isPhantom?: boolean;
}

export interface SolflareProvider extends WalletAdapter {
  isSolflare?: boolean;
}

export interface OKXProvider extends WalletAdapter {
  isOkxWallet?: boolean;
}

export interface BackpackProvider extends WalletAdapter {
  isBackpack?: boolean;
}

export interface MetaMaskProvider extends WalletAdapter {
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomProvider;
    };
    solflare?: SolflareProvider;
    okxwallet?: {
      solana?: OKXProvider;
    };
    backpack?: BackpackProvider;
    xnft?: {
      solana?: BackpackProvider;
    };
    ethereum?: MetaMaskProvider & {
      solana?: MetaMaskProvider;
    };
  }
}

export type WalletName = "phantom" | "solflare" | "okx" | "backpack" | "metamask";

export interface WalletInfo {
  name: WalletName;
  displayName: string;
  icon: string;
  adapter: WalletAdapter | null;
  installed: boolean;
  url: string;
}

export function getPhantomWallet(): PhantomProvider | null {
  if (typeof window !== "undefined" && window.phantom?.solana?.isPhantom === true) {
    return window.phantom.solana;
  }
  return null;
}

export function getSolflareWallet(): SolflareProvider | null {
  if (typeof window !== "undefined" && window.solflare?.isSolflare === true) {
    return window.solflare;
  }
  return null;
}

export function getOKXWallet(): OKXProvider | null {
  if (typeof window !== "undefined" && window.okxwallet?.solana) {
    const provider = window.okxwallet.solana;
    if (provider.isOkxWallet === true || provider.publicKey !== undefined) {
      return provider;
    }
  }
  return null;
}

export function getBackpackWallet(): BackpackProvider | null {
  if (typeof window !== "undefined") {
    if (window.backpack?.isBackpack === true) {
      return window.backpack;
    }
    if (window.xnft?.solana?.isBackpack === true) {
      return window.xnft.solana;
    }
  }
  return null;
}

export function getMetaMaskWallet(): MetaMaskProvider | null {
  if (typeof window === "undefined") return null;

  const isMetaMaskBrowser = 
    typeof navigator !== "undefined" && 
    navigator.userAgent.includes("MetaMask");

  // Desktop: window.ethereum.solana with MetaMask flag
  if (window.ethereum?.solana) {
    if ((window.ethereum as any).isMetaMask === true) {
      return window.ethereum.solana;
    }
  }

  // Desktop: window.solana with MetaMask flag
  if (window.solana) {
    if ((window.solana as any).isMetaMask === true) {
      return window.solana as MetaMaskProvider;
    }
  }

  // Mobile MetaMask browser: Create a lazy proxy that will connect to MetaMask when called
  // MetaMask mobile may not inject immediately, so we return a provider stub that
  // will work once the user interacts with the page
  if (isMetaMaskBrowser) {
    // Return a proxy that will attempt to find the provider when methods are called
    return {
      publicKey: null,
      connected: false,
      connecting: false,
      connect: async function() {
        // On mobile MetaMask, Solana might be available at window.solana or window.ethereum.solana
        const provider = (window.solana as any) || (window.ethereum as any)?.solana;
        if (!provider || !provider.connect) {
          throw new Error("MetaMask Solana provider not available. Please ensure MetaMask is properly installed.");
        }
        return provider.connect();
      },
      disconnect: async function() {
        const provider = (window.solana as any) || (window.ethereum as any)?.solana;
        if (provider?.disconnect) {
          return provider.disconnect();
        }
      },
      signTransaction: async function(tx) {
        const provider = (window.solana as any) || (window.ethereum as any)?.solana;
        if (!provider?.signTransaction) {
          throw new Error("MetaMask Solana provider not available");
        }
        return provider.signTransaction(tx);
      },
      signAllTransactions: async function(txs) {
        const provider = (window.solana as any) || (window.ethereum as any)?.solana;
        if (!provider?.signAllTransactions) {
          throw new Error("MetaMask Solana provider not available");
        }
        return provider.signAllTransactions(txs);
      },
      signMessage: async function(msg) {
        const provider = (window.solana as any) || (window.ethereum as any)?.solana;
        if (!provider?.signMessage) {
          throw new Error("MetaMask Solana provider not available");
        }
        return provider.signMessage(msg);
      },
    } as unknown as MetaMaskProvider;
  }

  return null;
}

export function getWalletByName(name: WalletName): WalletAdapter | null {
  switch (name) {
    case "phantom":
      return getPhantomWallet();
    case "solflare":
      return getSolflareWallet();
    case "okx":
      return getOKXWallet();
    case "backpack":
      return getBackpackWallet();
    case "metamask":
      return getMetaMaskWallet();
    default:
      return null;
  }
}

export function getAllWallets(): WalletInfo[] {
  const phantom = getPhantomWallet();
  const solflare = getSolflareWallet();
  const okx = getOKXWallet();
  const backpack = getBackpackWallet();
  const metamask = getMetaMaskWallet();

  return [
    {
      name: "phantom",
      displayName: "Phantom",
      icon: "https://phantom.app/img/phantom-logo.svg",
      adapter: phantom,
      installed: !!phantom,
      url: "https://phantom.app/",
    },
    {
      name: "solflare",
      displayName: "Solflare",
      icon: "https://solflare.com/favicon.ico",
      adapter: solflare,
      installed: !!solflare,
      url: "https://solflare.com/",
    },
    {
      name: "okx",
      displayName: "OKX Wallet",
      icon: "https://static.okx.com/cdn/assets/imgs/221/C5E8D9D5E0D48F8D.png",
      adapter: okx,
      installed: !!okx,
      url: "https://www.okx.com/web3",
    },
    {
      name: "backpack",
      displayName: "Backpack",
      icon: "https://backpack.app/favicon.ico",
      adapter: backpack,
      installed: !!backpack,
      url: "https://backpack.app/",
    },
    {
      name: "metamask",
      displayName: "MetaMask",
      icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
      adapter: metamask,
      installed: !!metamask,
      url: "https://metamask.io/",
    },
  ];
}

export function getAvailableWallets(): WalletInfo[] {
  return getAllWallets().filter(w => w.installed);
}

export async function connectWallet(adapter: WalletAdapter): Promise<PublicKey> {
  if (!adapter.connected) {
    await adapter.connect();
  }
  
  if (!adapter.publicKey) {
    throw new Error("Failed to connect wallet");
  }
  
  return adapter.publicKey;
}

export async function disconnectWallet(adapter: WalletAdapter): Promise<void> {
  if (adapter.connected) {
    await adapter.disconnect();
  }
}

export async function signAndSendTransaction(
  adapter: WalletAdapter,
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  if (!adapter.publicKey) {
    throw new Error("Wallet not connected");
  }

  // Sign client-side only, then submit through server RPC to avoid domain restrictions
  const signedTransaction = await adapter.signTransaction(transaction);
  const signedTx = Buffer.from(signedTransaction.serialize()).toString("base64");

  const res = await fetch("/api/submit-tx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTx }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Transaction submission failed");
  }

  const { signature } = await res.json();
  return signature;
}

export async function getWalletBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

export async function requestDevnetAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 1
): Promise<string> {
  const signature = await connection.requestAirdrop(
    publicKey,
    amount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export const DEVNET_RPC = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
// Fallback to public RPC for client-side to avoid CORS/403 issues with private RPCs
export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

// Add specific Helius support if provided
export const getActiveRpc = (network: NetworkType = "mainnet-beta"): string => {
  return MAINNET_RPC;
};

export type NetworkType = "devnet" | "mainnet-beta";

export function getConnection(network: NetworkType = "mainnet-beta"): Connection {
  const rpc = MAINNET_RPC;
  return new Connection(rpc, "confirmed");
}
