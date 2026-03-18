import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SendOptions,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { WALLET_ICONS } from "./wallet-icons";

const MWA_IDENTITY = {
  name: "MyLuckySol",
  uri: "https://myluckysol.fun",
  icon: "/favicon.ico",
} as const;

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
    // Used only for isNativeApp() detection — actual wallet ops use transact()
    SolanaWalletBridge?: SolanaWalletBridgeType;
  }
}

/** True when running inside the MyLuckySol Android APK (native WebView) */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && window.SolanaWalletBridge?.isNativeApp() === true;
}

// ─── MWA Transact Adapter ───────────────────────────────────────────────────
// Uses the @solana-mobile/mobile-wallet-adapter-protocol-web3js `transact()`
// function which generates the `solana-wallet:` association URL. The Android
// WebView (MainActivity.kt) intercepts that URL and fires it as an Intent,
// launching the on-device wallet (Phantom, Seed Vault, Solflare, etc.).
// The wallet communicates back via a local WebSocket, resolving the promise.
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
        const storedToken = sessionStorage.getItem("mwa_auth_token");

        const result = await transact(async (wallet) => {
          // Attempt silent reauthorization with a stored token first
          if (storedToken) {
            try {
              const reauth = await wallet.reauthorize({
                auth_token: storedToken,
                identity: MWA_IDENTITY,
              });
              return { publicKey: reauth.accounts[0]?.address ?? "", authToken: reauth.auth_token };
            } catch {
              // Token expired — fall through to fresh authorize
              sessionStorage.removeItem("mwa_auth_token");
            }
          }

          // Fresh authorization — opens the wallet UI on-device
          const auth = await wallet.authorize({
            cluster: "mainnet-beta",
            identity: MWA_IDENTITY,
          });
          return { publicKey: auth.accounts[0]?.address ?? "", authToken: auth.auth_token };
        });

        if (!result.publicKey) throw new Error("Wallet did not return a public key");
        // MWA returns addresses as Base64-encoded bytes, not base58 strings
        _publicKey = new PublicKey(Buffer.from(result.publicKey, "base64"));
        _authToken = result.authToken;
        sessionStorage.setItem("mwa_auth_token", result.authToken);
        _connected = true;
        console.log("[MWA] Connected:", result.publicKey);
      } catch (err: any) {
        throw new Error(err?.message ?? "Wallet connection failed");
      } finally {
        _connecting = false;
      }
    },

    disconnect: async function () {
      if (_authToken) {
        try {
          await transact(async (wallet) => {
            await wallet.deauthorize({ auth_token: _authToken! });
          });
        } catch { /* ignore */ }
        sessionStorage.removeItem("mwa_auth_token");
      }
      _publicKey = null;
      _authToken = null;
      _connected = false;
    },

    signTransaction: async function <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (!_authToken || !_publicKey) throw new Error("Wallet not connected");
      const [signed] = await transact(async (wallet) => {
        await wallet.reauthorize({ auth_token: _authToken!, identity: MWA_IDENTITY });
        return wallet.signTransactions({ transactions: [tx] });
      });
      return signed as T;
    },

    signAllTransactions: async function <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      if (!_authToken || !_publicKey) throw new Error("Wallet not connected");
      const signed = await transact(async (wallet) => {
        await wallet.reauthorize({ auth_token: _authToken!, identity: MWA_IDENTITY });
        return wallet.signTransactions({ transactions: txs });
      });
      return signed as T[];
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
