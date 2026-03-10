import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { WalletAdapter } from "./wallet-adapter";

export interface StandardWalletAccount {
  address: string;
  publicKey: Uint8Array;
  chains: string[];
  features: string[];
}

export interface StandardWallet {
  name: string;
  version: string;
  icon: string;
  chains: string[];
  features: Record<string, any>;
  accounts: StandardWalletAccount[];
}

const SOLANA_CHAIN_PREFIX = "solana:";

function isSolanaWallet(wallet: StandardWallet): boolean {
  return wallet.chains.some((c: string) => c.startsWith(SOLANA_CHAIN_PREFIX));
}

const _registeredWallets: Map<string, StandardWallet> = new Map();
let _ready = false;

function registerWallet(wallet: StandardWallet) {
  if (!_registeredWallets.has(wallet.name)) {
    _registeredWallets.set(wallet.name, wallet);
  }
}

const _appReadyAPI = {
  register(wallet: StandardWallet) {
    registerWallet(wallet);
    return () => { _registeredWallets.delete(wallet.name); };
  },
};

function initWalletStandard() {
  if (_ready || typeof window === "undefined") return;
  _ready = true;

  window.addEventListener("wallet-standard:register-wallet", (event: Event) => {
    const callback = (event as CustomEvent).detail;
    if (typeof callback === "function") {
      callback(_appReadyAPI);
    }
  });

  window.dispatchEvent(
    Object.assign(new CustomEvent("wallet-standard:app-ready", { detail: _appReadyAPI }), {
      preventDefault() { throw new Error("preventDefault not allowed"); },
      stopImmediatePropagation() { throw new Error("stopImmediatePropagation not allowed"); },
      stopPropagation() { throw new Error("stopPropagation not allowed"); },
    })
  );
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWalletStandard, { once: true });
  } else {
    initWalletStandard();
  }
}

export function getStandardWallets(): StandardWallet[] {
  initWalletStandard();
  return Array.from(_registeredWallets.values()).filter(isSolanaWallet);
}

export function getStandardWalletByName(name: string): StandardWallet | null {
  initWalletStandard();
  const wallet = _registeredWallets.get(name);
  return wallet && isSolanaWallet(wallet) ? wallet : null;
}

export function wrapStandardWallet(wallet: StandardWallet): WalletAdapter {
  let _publicKey: PublicKey | null = null;
  let _connected = false;
  let _connecting = false;
  const _listeners: Record<string, ((...args: any[]) => void)[]> = {};

  function emit(event: string, ...args: any[]) {
    (_listeners[event] ?? []).forEach(fn => fn(...args));
  }

  const StandardConnect = "standard:connect";
  const StandardDisconnect = "standard:disconnect";
  const StandardEvents = "standard:events";
  const SolanaSignTransaction = "solana:signTransaction";
  const SolanaSignMessage = "solana:signMessage";

  return {
    get publicKey() { return _publicKey; },
    get connected() { return _connected; },
    get connecting() { return _connecting; },

    async connect() {
      _connecting = true;
      try {
        const connectFeature = wallet.features[StandardConnect];
        if (!connectFeature?.connect) {
          throw new Error(`${wallet.name} does not support standard:connect`);
        }

        const result = await connectFeature.connect();
        const accounts: StandardWalletAccount[] = result?.accounts ?? [];
        const solanaAccount = accounts.find(a =>
          (a.chains ?? []).some((c: string) => c.startsWith(SOLANA_CHAIN_PREFIX))
        ) ?? accounts[0];

        if (!solanaAccount) throw new Error("No Solana account returned");

        _publicKey = new PublicKey(solanaAccount.publicKey);
        _connected = true;
        emit("connect", _publicKey);
      } finally {
        _connecting = false;
      }
    },

    async disconnect() {
      const disconnectFeature = wallet.features[StandardDisconnect];
      if (disconnectFeature?.disconnect) {
        await disconnectFeature.disconnect().catch(() => {});
      }
      _publicKey = null;
      _connected = false;
      emit("disconnect");
    },

    async signTransaction(transaction: Transaction | VersionedTransaction) {
      const feature = wallet.features[SolanaSignTransaction];
      if (!feature?.signTransaction) {
        throw new Error(`${wallet.name} does not support solana:signTransaction`);
      }

      const account = wallet.accounts[0];
      const isVersioned = "version" in transaction;
      const serialized = isVersioned
        ? (transaction as VersionedTransaction).serialize()
        : (transaction as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });

      const [result] = await feature.signTransaction({
        account,
        transaction: serialized,
        chain: "solana:mainnet",
      });

      if (!result?.signedTransaction) throw new Error("No signed transaction returned");

      if (isVersioned) {
        return VersionedTransaction.deserialize(result.signedTransaction) as typeof transaction;
      }
      return Transaction.from(result.signedTransaction) as typeof transaction;
    },

    async signAllTransactions(transactions: (Transaction | VersionedTransaction)[]) {
      const feature = wallet.features[SolanaSignTransaction];
      if (!feature?.signTransaction) {
        throw new Error(`${wallet.name} does not support solana:signTransaction`);
      }
      const account = wallet.accounts[0];
      const results = await Promise.all(
        transactions.map(async (tx) => {
          const isVersioned = "version" in tx;
          const serialized = isVersioned
            ? (tx as VersionedTransaction).serialize()
            : (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });
          const [res] = await feature.signTransaction({ account, transaction: serialized, chain: "solana:mainnet" });
          if (!res?.signedTransaction) return tx;
          return isVersioned
            ? VersionedTransaction.deserialize(res.signedTransaction)
            : Transaction.from(res.signedTransaction);
        })
      );
      return results as typeof transactions;
    },

    async signMessage(message: Uint8Array) {
      const feature = wallet.features[SolanaSignMessage];
      if (!feature?.signMessage) {
        throw new Error(`${wallet.name} does not support solana:signMessage`);
      }
      const account = wallet.accounts[0];
      const [result] = await feature.signMessage({ account, message });
      const sig = result?.signature;
      return { signature: sig instanceof Uint8Array ? sig : new Uint8Array(sig) };
    },

    on(event: string, handler: (...args: any[]) => void) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(handler);

      if (event === "connect" || event === "disconnect") {
        const eventsFeature = wallet.features[StandardEvents];
        if (eventsFeature?.on) {
          eventsFeature.on("change", ({ accounts }: any) => {
            if (!accounts?.length) {
              _publicKey = null;
              _connected = false;
              emit("disconnect");
            } else {
              _publicKey = new PublicKey(accounts[0].publicKey);
              _connected = true;
              emit("connect", _publicKey);
            }
          });
        }
      }
    },

    off(event: string, handler: (...args: any[]) => void) {
      _listeners[event] = (_listeners[event] ?? []).filter(fn => fn !== handler);
    },
  };
}

export async function waitForStandardWallet(name: string, timeoutMs = 3000): Promise<StandardWallet | null> {
  initWalletStandard();
  const existing = getStandardWalletByName(name);
  if (existing) return existing;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("wallet-standard:register-wallet", handler);
      resolve(null);
    }, timeoutMs);

    function handler(event: Event) {
      const callback = (event as CustomEvent).detail;
      if (typeof callback === "function") {
        const captured: StandardWallet[] = [];
        callback({
          register(wallet: StandardWallet) {
            registerWallet(wallet);
            captured.push(wallet);
            return () => {};
          },
        });
        const found = captured.find(w => w.name === name && isSolanaWallet(w));
        if (found) {
          clearTimeout(timer);
          window.removeEventListener("wallet-standard:register-wallet", handler);
          resolve(found);
        }
      }
    }

    window.addEventListener("wallet-standard:register-wallet", handler);
  });
}
