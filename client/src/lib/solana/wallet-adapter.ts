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
  }
}

export type WalletName = "phantom" | "solflare" | "okx" | "backpack";

export interface WalletInfo {
  name: WalletName;
  displayName: string;
  icon: string;
  adapter: WalletAdapter | null;
  installed: boolean;
  url: string;
}

export function getPhantomWallet(): PhantomProvider | null {
  if (typeof window !== "undefined" && window.phantom?.solana?.isPhantom) {
    return window.phantom.solana;
  }
  return null;
}

export function getSolflareWallet(): SolflareProvider | null {
  if (typeof window !== "undefined" && window.solflare?.isSolflare) {
    return window.solflare;
  }
  return null;
}

export function getOKXWallet(): OKXProvider | null {
  if (typeof window !== "undefined" && window.okxwallet?.solana) {
    return window.okxwallet.solana;
  }
  return null;
}

export function getBackpackWallet(): BackpackProvider | null {
  if (typeof window !== "undefined") {
    if (window.backpack?.isBackpack) {
      return window.backpack;
    }
    if (window.xnft?.solana) {
      return window.xnft.solana;
    }
  }
  return null;
}

export function getAllWallets(): WalletInfo[] {
  const phantom = getPhantomWallet();
  const solflare = getSolflareWallet();
  const okx = getOKXWallet();
  const backpack = getBackpackWallet();

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

  if (adapter.sendTransaction) {
    return adapter.sendTransaction(transaction, connection);
  }

  const signedTransaction = await adapter.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTransaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  
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

export const DEVNET_RPC = "https://api.devnet.solana.com";
export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export type NetworkType = "devnet" | "mainnet-beta";

export function getConnection(network: NetworkType = "devnet"): Connection {
  const rpc = network === "devnet" ? DEVNET_RPC : MAINNET_RPC;
  return new Connection(rpc, "confirmed");
}
