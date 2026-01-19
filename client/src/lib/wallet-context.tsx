import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { PlayerProfile } from "@shared/schema";
import {
  type WalletAdapter,
  type WalletInfo,
  type WalletName,
  type NetworkType,
  getAllWallets,
  getAvailableWallets,
  connectWallet,
  disconnectWallet,
  getConnection,
  DEVNET_RPC,
  MAINNET_RPC,
} from "./solana/wallet-adapter";

interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  publicKey: PublicKey | null;
  balance: number;
  wagaBalance: number;
  walletName: WalletName | null;
  network: NetworkType;
}

interface WalletContextType extends WalletState {
  connect: (walletName: WalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  shortAddress: string | null;
  profile: PlayerProfile | undefined;
  availableWallets: WalletInfo[];
  allWallets: WalletInfo[];
  switchNetwork: (network: NetworkType) => void;
  refreshBalance: () => Promise<void>;
  requestAirdrop: () => Promise<string>;
  connection: Connection;
  adapter: WalletAdapter | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

const WALLET_STORAGE_KEY = "myluckysol_wallet";
const NETWORK_STORAGE_KEY = "myluckysol_network";

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [connection, setConnection] = useState<Connection>(() => getConnection("devnet"));
  
  const [state, setState] = useState<WalletState>(() => {
    const savedNetwork = typeof window !== "undefined" 
      ? (localStorage.getItem(NETWORK_STORAGE_KEY) as NetworkType) || "devnet"
      : "devnet";
    return {
      connected: false,
      connecting: false,
      address: null,
      publicKey: null,
      balance: 0,
      wagaBalance: 0,
      walletName: null,
      network: savedNetwork,
    };
  });

  const { data: profile } = useQuery<PlayerProfile>({
    queryKey: ["/api/profile", state.address],
    enabled: state.connected && !!state.address,
  });

  const refreshBalance = useCallback(async () => {
    if (!state.publicKey || !connection) return;
    
    try {
      const balance = await connection.getBalance(state.publicKey);
      setState(prev => ({
        ...prev,
        balance: balance / LAMPORTS_PER_SOL,
      }));
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  }, [state.publicKey, connection]);

  useEffect(() => {
    if (state.connected && state.publicKey) {
      refreshBalance();
      const interval = setInterval(refreshBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [state.connected, state.publicKey, refreshBalance]);

  useEffect(() => {
    const savedWallet = localStorage.getItem(WALLET_STORAGE_KEY) as WalletName | null;
    if (savedWallet) {
      const wallets = getAllWallets();
      const wallet = wallets.find(w => w.name === savedWallet);
      if (wallet?.installed && wallet.adapter) {
        if (wallet.adapter.connected && wallet.adapter.publicKey) {
          setAdapter(wallet.adapter);
          setState(prev => ({
            ...prev,
            connected: true,
            address: wallet.adapter!.publicKey!.toBase58(),
            publicKey: wallet.adapter!.publicKey,
            walletName: savedWallet,
          }));
        }
      }
    }
  }, []);

  const connect = useCallback(async (walletName: WalletName) => {
    setState(prev => ({ ...prev, connecting: true }));
    
    try {
      const wallets = getAllWallets();
      const wallet = wallets.find(w => w.name === walletName);
      
      if (!wallet) {
        throw new Error(`Wallet ${walletName} not found`);
      }
      
      if (!wallet.installed || !wallet.adapter) {
        window.open(wallet.url, "_blank");
        throw new Error(`Please install ${wallet.displayName} wallet`);
      }

      const publicKey = await connectWallet(wallet.adapter);
      
      setAdapter(wallet.adapter);
      localStorage.setItem(WALLET_STORAGE_KEY, walletName);
      
      const balance = await connection.getBalance(publicKey);
      
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        address: publicKey.toBase58(),
        publicKey,
        balance: balance / LAMPORTS_PER_SOL,
        walletName,
      }));

      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch (error) {
      setState(prev => ({ ...prev, connecting: false }));
      throw error;
    }
  }, [connection, queryClient]);

  const disconnect = useCallback(async () => {
    if (adapter) {
      try {
        await disconnectWallet(adapter);
      } catch (error) {
        console.error("Error disconnecting:", error);
      }
    }
    
    setAdapter(null);
    localStorage.removeItem(WALLET_STORAGE_KEY);
    
    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      address: null,
      publicKey: null,
      balance: 0,
      wagaBalance: 0,
      walletName: null,
    }));
  }, [adapter]);

  const switchNetwork = useCallback((network: NetworkType) => {
    const newConnection = getConnection(network);
    setConnection(newConnection);
    localStorage.setItem(NETWORK_STORAGE_KEY, network);
    
    setState(prev => ({
      ...prev,
      network,
    }));

    if (state.publicKey) {
      newConnection.getBalance(state.publicKey).then(balance => {
        setState(prev => ({
          ...prev,
          balance: balance / LAMPORTS_PER_SOL,
        }));
      });
    }
  }, [state.publicKey]);

  const requestAirdrop = useCallback(async (): Promise<string> => {
    if (!state.publicKey) {
      throw new Error("Wallet not connected");
    }
    
    if (state.network !== "devnet") {
      throw new Error("Airdrop only available on devnet");
    }

    const signature = await connection.requestAirdrop(
      state.publicKey,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature, "confirmed");
    
    await refreshBalance();
    
    return signature;
  }, [state.publicKey, state.network, connection, refreshBalance]);

  const shortAddress = state.address
    ? `${state.address.slice(0, 4)}...${state.address.slice(-4)}`
    : null;

  const allWallets = getAllWallets();
  const availableWallets = getAvailableWallets();

  return (
    <WalletContext.Provider 
      value={{ 
        ...state, 
        connect, 
        disconnect, 
        shortAddress, 
        profile,
        availableWallets,
        allWallets,
        switchNetwork,
        refreshBalance,
        requestAirdrop,
        connection,
        adapter,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
