import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SendOptions,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { WALLET_ICONS } from "./wallet-icons";

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

export interface SeekerProvider extends WalletAdapter {
  isSaga?: boolean;
  isSeeker?: boolean;
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
    solana?: SeekerProvider & PhantomProvider & SolflareProvider;
  }
}

export function isSeekerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isSeeker = ua.includes("MyLuckySolApp") || ua.includes("SolanaSeeker") || ua.includes("Saga");
  console.log("[isSeekerDevice] UA:", ua, "→ isSeeker:", isSeeker);
  return isSeeker;
}

// Returns the native Solana wallet injected into window.solana (non-Phantom)
// or null if not available
function getNativeWindowSolana(): SeekerProvider | null {
  if (typeof window === "undefined") return null;
  const provider = window.solana;
  if (!provider) return null;
  if (typeof provider.connect !== "function") return null;
  // Exclude Phantom — it also injects window.solana
  if (provider.isPhantom) return null;
  // Exclude Solflare — it also uses window.solana in some builds
  if ((provider as any).isSolflare) return null;
  return provider as SeekerProvider;
}

// Creates a virtual adapter for Seeker devices.
// On connect: tries window.solana first, then guides user to install a compatible wallet.
function createSeekerAdapter(): SeekerProvider {
  const events: Record<string, ((...args: any[]) => void)[]> = {};

  return {
    publicKey: null,
    connected: false,
    connecting: false,

    connect: async function () {
      // Try the natively injected wallet first
      const native = getNativeWindowSolana();
      if (native) {
        await native.connect();
        (this as any).publicKey = native.publicKey;
        (this as any).connected = !!native.publicKey;
        return;
      }

      // Check if any Solana provider exists at all
      if (window.solana && typeof window.solana.connect === "function") {
        await window.solana.connect();
        (this as any).publicKey = window.solana.publicKey;
        (this as any).connected = !!window.solana.publicKey;
        return;
      }

      // No wallet found — throw a helpful message
      throw new Error(
        "No Solana wallet detected. Please install Phantom or Solflare from the Solana dApp Store, then reopen the app."
      );
    },

    disconnect: async function () {
      const native = getNativeWindowSolana();
      if (native?.disconnect) await native.disconnect();
      (this as any).publicKey = null;
      (this as any).connected = false;
    },

    signTransaction: async function <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      const native = getNativeWindowSolana() ?? window.solana;
      if (!native || typeof (native as any).signTransaction !== "function") {
        throw new Error("Wallet not available for signing");
      }
      return (native as any).signTransaction(tx);
    },

    signAllTransactions: async function <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      const native = getNativeWindowSolana() ?? window.solana;
      if (!native || typeof (native as any).signAllTransactions !== "function") {
        throw new Error("Wallet not available for signing");
      }
      return (native as any).signAllTransactions(txs);
    },

    on: function (event: string, callback: (...args: any[]) => void) {
      if (!events[event]) events[event] = [];
      events[event].push(callback);
      const native = getNativeWindowSolana() ?? window.solana;
      if (native?.on) native.on(event, callback);
    },

    off: function (event: string, callback: (...args: any[]) => void) {
      events[event] = (events[event] || []).filter(cb => cb !== callback);
      const native = getNativeWindowSolana() ?? window.solana;
      if (native?.off) native.off(event, callback);
    },
  };
}

let _seekerAdapterInstance: SeekerProvider | null = null;

export function getSeekerWallet(): SeekerProvider | null {
  if (!isSeekerDevice()) return null;
  // Return cached instance so event listeners persist
  if (!_seekerAdapterInstance) {
    _seekerAdapterInstance = createSeekerAdapter();
  }
  return _seekerAdapterInstance;
}

export type WalletName = "seeker" | "phantom" | "solflare" | "okx" | "backpack" | "metamask";

export interface WalletInfo {
  name: WalletName;
  displayName: string;
  icon: string;
  adapter: WalletAdapter | null;
  installed: boolean;
  url: string;
  warning?: string;
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

  // Desktop MetaMask extension: injects window.ethereum.solana with isMetaMask flag
  if (window.ethereum?.solana && (window.ethereum as any).isMetaMask === true) {
    return window.ethereum.solana;
  }

  // window.solana explicitly from MetaMask
  if (window.solana && (window.solana as any).isMetaMask === true) {
    return window.solana as MetaMaskProvider;
  }

  // Mobile MetaMask browser (and desktop MetaMask without Solana sub-provider):
  // MetaMask injects window.ethereum with isMetaMask=true in its mobile in-app browser.
  // NOTE: MetaMask mobile UA is standard Chrome — do NOT use navigator.userAgent to detect.
  if (window.ethereum && (window.ethereum as any).isMetaMask === true) {
    const lazyGetSolana = () =>
      ((window.solana as any) ?? (window.ethereum as any)?.solana) ?? null;

    return {
      publicKey: null,
      connected: false,
      connecting: false,
      connect: async function () {
        const p = lazyGetSolana();
        if (!p || typeof p.connect !== "function") {
          throw new Error(
            "MetaMask does not expose a Solana provider in this browser. " +
            "Please use Phantom, OKX, or another Solana-native wallet on mobile."
          );
        }
        return p.connect();
      },
      disconnect: async function () {
        const p = lazyGetSolana();
        if (p?.disconnect) await p.disconnect();
      },
      signTransaction: async function (tx: any) {
        const p = lazyGetSolana();
        if (!p?.signTransaction)
          throw new Error("MetaMask Solana provider unavailable");
        return p.signTransaction(tx);
      },
      signAllTransactions: async function (txs: any[]) {
        const p = lazyGetSolana();
        if (!p?.signAllTransactions)
          throw new Error("MetaMask Solana provider unavailable");
        return p.signAllTransactions(txs);
      },
      signMessage: async function (msg: any) {
        const p = lazyGetSolana();
        if (!p?.signMessage)
          throw new Error("MetaMask Solana provider unavailable");
        return p.signMessage(msg);
      },
    } as unknown as MetaMaskProvider;
  }

  return null;
}

export function getWalletByName(name: WalletName): WalletAdapter | null {
  switch (name) {
    case "seeker":
      return getSeekerWallet();
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

export async function getWalletByNameAsync(name: WalletName): Promise<WalletAdapter | null> {
  if (name === "seeker") {
    return getSeekerWallet();
  }
  if (name === "metamask") {
    const { getStandardWallets, waitForStandardWallet, wrapStandardWallet } = await import("./wallet-standard-adapter");
    const stWallets = getStandardWallets();
    const mmStandard = stWallets.find(w =>
      w.name.toLowerCase().includes("metamask") || w.name.toLowerCase().includes("meta mask")
    );
    if (mmStandard) return wrapStandardWallet(mmStandard);

    const waited = await waitForStandardWallet("MetaMask", 1000);
    if (waited) return wrapStandardWallet(waited);

    return getMetaMaskWallet();
  }

  return getWalletByName(name);
}

export async function detectMetaMaskStandardWallet(): Promise<WalletAdapter | null> {
  const { getStandardWallets, waitForStandardWallet, wrapStandardWallet } = await import("./wallet-standard-adapter");
  const stWallets = getStandardWallets();
  const mmWallet = stWallets.find(w =>
    w.name.toLowerCase().includes("metamask") || w.name.toLowerCase().includes("meta mask")
  );
  if (mmWallet) return wrapStandardWallet(mmWallet);
  const waited = await waitForStandardWallet("MetaMask", 2000);
  if (waited) return wrapStandardWallet(waited);
  return null;
}

export function getAllWallets(): WalletInfo[] {
  const seeker = getSeekerWallet();
  const phantom = getPhantomWallet();
  const solflare = getSolflareWallet();
  const okx = getOKXWallet();
  const backpack = getBackpackWallet();
  const metamask = getMetaMaskWallet();

  const wallets: WalletInfo[] = [];
  const onSeeker = isSeekerDevice();

  // Seeker native wallet — always first on Seeker devices, always marked installed
  // (the virtual adapter handles the "no wallet injected" case with a helpful error)
  if (onSeeker) {
    wallets.push({
      name: "seeker",
      displayName: "Seeker Wallet",
      icon: WALLET_ICONS.seeker,
      adapter: seeker,
      installed: true,
      url: "https://solanamobile.com/",
    });
  }

  wallets.push(
    {
      name: "phantom",
      displayName: "Phantom",
      icon: WALLET_ICONS.phantom,
      adapter: phantom,
      installed: !!phantom,
      url: "https://phantom.app/",
    },
    {
      name: "solflare",
      displayName: "Solflare",
      icon: WALLET_ICONS.solflare,
      adapter: solflare,
      installed: !!solflare,
      url: "https://solflare.com/",
    },
    {
      name: "okx",
      displayName: "OKX Wallet",
      icon: WALLET_ICONS.okx,
      adapter: okx,
      installed: !!okx,
      url: "https://www.okx.com/web3",
    },
    {
      name: "backpack",
      displayName: "Backpack",
      icon: WALLET_ICONS.backpack,
      adapter: backpack,
      installed: !!backpack,
      url: "https://backpack.app/",
    },
  );

  // MetaMask cannot sign Solana transactions on mobile — hide it on Seeker
  if (!onSeeker) {
    wallets.push({
      name: "metamask",
      displayName: "MetaMask",
      icon: WALLET_ICONS.metamask,
      adapter: metamask,
      installed: !!metamask,
      url: "https://metamask.io/",
    });
  }

  return wallets;
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
