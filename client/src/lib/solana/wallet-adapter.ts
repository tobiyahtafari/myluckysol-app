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

// The native Android JavaScript bridge injected by MainActivity.kt
interface SolanaWalletBridgeType {
  isNativeApp(): boolean;
  connect(callbackId: string): void;
  reauthorize(authToken: string, callbackId: string): void;
  signTransaction(base64Tx: string, authToken: string, callbackId: string): void;
  disconnect(authToken: string): void;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solflare?: SolflareProvider;
    okxwallet?: { solana?: OKXProvider };
    backpack?: BackpackProvider;
    xnft?: { solana?: BackpackProvider };
    ethereum?: MetaMaskProvider & { solana?: MetaMaskProvider };
    solana?: SeekerProvider & PhantomProvider & SolflareProvider;
    // Injected by MainActivity.kt WalletBridge @JavascriptInterface
    SolanaWalletBridge?: SolanaWalletBridgeType;
    // Internal MWA callback registry
    __mwaCb?: Record<string, (...args: any[]) => void>;
  }
}

/** True when running inside the MyLuckySol Android APK (native WebView) */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && window.SolanaWalletBridge?.isNativeApp() === true;
}

// ─── Native Bridge Helpers ──────────────────────────────────────────────────
// Promise wrapper around the Android @JavascriptInterface callback pattern
function nativeBridgeCall<T>(
  fn: (callbackId: string) => void,
  parseResult: (...args: any[]) => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const callbackId = "mwa_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    if (!window.__mwaCb) window.__mwaCb = {};
    window.__mwaCb[callbackId] = (...args: any[]) => {
      delete window.__mwaCb![callbackId];
      const error = args[0];
      if (error) {
        reject(new Error(error));
      } else {
        resolve(parseResult(...args));
      }
    };
    fn(callbackId);
  });
}

// ─── Native Bridge Adapter ──────────────────────────────────────────────────
// Creates a WalletAdapter that delegates to the Android @JavascriptInterface.
// This is the correct mechanism for Seeker / Solana Mobile WebView apps.
function createNativeBridgeAdapter(): SeekerProvider {
  let _publicKey: PublicKey | null = null;
  let _authToken: string | null = null;
  let _connected = false;
  let _connecting = false;

  const adapter: SeekerProvider = {
    get publicKey() { return _publicKey; },
    get connected() { return _connected; },
    get connecting() { return _connecting; },

    connect: async function () {
      _connecting = true;
      try {
        // If we have a stored auth token, try to reauthorize silently first
        const storedToken = sessionStorage.getItem("mwa_auth_token");
        if (storedToken) {
          try {
            const result = await nativeBridgeCall<{ publicKey: string; authToken: string }>(
              (cbId) => window.SolanaWalletBridge!.reauthorize(storedToken, cbId),
              (_err, pk, token) => ({ publicKey: pk, authToken: token })
            );
            if (result.publicKey) {
              _publicKey = new PublicKey(result.publicKey);
              _authToken = result.authToken;
              sessionStorage.setItem("mwa_auth_token", result.authToken);
              _connected = true;
              return;
            }
          } catch (_e) {
            // Token expired — fall through to fresh connect
            sessionStorage.removeItem("mwa_auth_token");
          }
        }

        // Fresh authorization via MWA
        console.log("[NativeBridge] Starting fresh MWA authorization...");
        const result = await nativeBridgeCall<{ publicKey: string; authToken: string }>(
          (cbId) => window.SolanaWalletBridge!.connect(cbId),
          (_err, pk, token) => ({ publicKey: pk, authToken: token })
        );
        _publicKey = new PublicKey(result.publicKey);
        _authToken = result.authToken;
        sessionStorage.setItem("mwa_auth_token", result.authToken);
        _connected = true;
        console.log("[NativeBridge] Connected:", result.publicKey);
      } catch (err: any) {
        _connecting = false;
        throw new Error(err?.message ?? "Wallet connection failed");
      } finally {
        _connecting = false;
      }
    },

    disconnect: async function () {
      if (_authToken) {
        window.SolanaWalletBridge?.disconnect(_authToken);
        sessionStorage.removeItem("mwa_auth_token");
      }
      _publicKey = null;
      _authToken = null;
      _connected = false;
    },

    signTransaction: async function <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (!_authToken) throw new Error("Wallet not connected. Please reconnect.");
      const serialized = Buffer.from((tx as Transaction).serialize({ requireAllSignatures: false })).toString("base64");
      const signedB64 = await nativeBridgeCall<string>(
        (cbId) => window.SolanaWalletBridge!.signTransaction(serialized, _authToken!, cbId),
        (_err, signed) => signed
      );
      const signedBytes = Buffer.from(signedB64, "base64");
      return Transaction.from(signedBytes) as unknown as T;
    },

    signAllTransactions: async function <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      // Sign one by one via the bridge
      const results: T[] = [];
      for (const tx of txs) {
        results.push(await (adapter as any).signTransaction(tx));
      }
      return results;
    },

    on: function () {},
    off: function () {},
  };

  return adapter;
}

let _nativeBridgeInstance: SeekerProvider | null = null;

export function getSeekerWallet(): SeekerProvider | null {
  if (isNativeApp()) {
    if (!_nativeBridgeInstance) {
      _nativeBridgeInstance = createNativeBridgeAdapter();
    }
    return _nativeBridgeInstance;
  }
  return null;
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
    if (window.backpack?.isBackpack === true) return window.backpack;
    if (window.xnft?.solana?.isBackpack === true) return window.xnft.solana;
  }
  return null;
}

export function getMetaMaskWallet(): MetaMaskProvider | null {
  if (typeof window === "undefined") return null;
  if (window.ethereum?.solana && (window.ethereum as any).isMetaMask === true) {
    return window.ethereum.solana;
  }
  if (window.solana && (window.solana as any).isMetaMask === true) {
    return window.solana as MetaMaskProvider;
  }
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
          throw new Error("MetaMask does not expose a Solana provider in this browser. Please use Phantom, OKX, or another Solana-native wallet.");
        }
        return p.connect();
      },
      disconnect: async function () {
        const p = lazyGetSolana();
        if (p?.disconnect) await p.disconnect();
      },
      signTransaction: async function (tx: any) {
        const p = lazyGetSolana();
        if (!p?.signTransaction) throw new Error("MetaMask Solana provider unavailable");
        return p.signTransaction(tx);
      },
      signAllTransactions: async function (txs: any[]) {
        const p = lazyGetSolana();
        if (!p?.signAllTransactions) throw new Error("MetaMask Solana provider unavailable");
        return p.signAllTransactions(txs);
      },
      signMessage: async function (msg: any) {
        const p = lazyGetSolana();
        if (!p?.signMessage) throw new Error("MetaMask Solana provider unavailable");
        return p.signMessage(msg);
      },
    } as unknown as MetaMaskProvider;
  }
  return null;
}

export function getWalletByName(name: WalletName): WalletAdapter | null {
  switch (name) {
    case "seeker": return getSeekerWallet();
    case "phantom": return getPhantomWallet();
    case "solflare": return getSolflareWallet();
    case "okx": return getOKXWallet();
    case "backpack": return getBackpackWallet();
    case "metamask": return getMetaMaskWallet();
    default: return null;
  }
}

export async function getWalletByNameAsync(name: WalletName): Promise<WalletAdapter | null> {
  if (name === "seeker") return getSeekerWallet();
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
  const phantom = getPhantomWallet();
  const solflare = getSolflareWallet();
  const okx = getOKXWallet();
  const backpack = getBackpackWallet();
  const metamask = getMetaMaskWallet();

  return [
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
    {
      name: "metamask",
      displayName: "MetaMask",
      icon: WALLET_ICONS.metamask,
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
  if (!adapter.connected) await adapter.connect();
  if (!adapter.publicKey) throw new Error("Failed to connect wallet");
  return adapter.publicKey;
}

export async function disconnectWallet(adapter: WalletAdapter): Promise<void> {
  if (adapter.connected) await adapter.disconnect();
}

export async function signAndSendTransaction(
  adapter: WalletAdapter,
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  if (!adapter.publicKey) throw new Error("Wallet not connected");
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
  const signature = await connection.requestAirdrop(publicKey, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export const DEVNET_RPC = import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
export const getActiveRpc = (_network: NetworkType = "mainnet-beta"): string => MAINNET_RPC;

export type NetworkType = "devnet" | "mainnet-beta";

export function getConnection(network: NetworkType = "mainnet-beta"): Connection {
  return new Connection(MAINNET_RPC, "confirmed");
}
