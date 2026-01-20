import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
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
  getWalletByName,
  connectWallet,
  disconnectWallet,
  getConnection,
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
  balanceLoading: boolean;
}

interface WalletContextType extends WalletState {
  connect: (walletName: WalletName) => Promise<void>;
  disconnect: () => Promise<void>;
  shortAddress: string | null;
  profile: PlayerProfile | undefined;
  availableWallets: WalletInfo[];
  allWallets: WalletInfo[];
  switchNetwork: (network: NetworkType) => Promise<void>;
  refreshBalance: () => Promise<void>;
  requestAirdrop: () => Promise<string>;
  connection: Connection;
  adapter: WalletAdapter | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

const WALLET_STORAGE_KEY = "myluckysol_wallet";
const NETWORK_STORAGE_KEY = "myluckysol_network";

function getSavedNetwork(): NetworkType {
  if (typeof window === "undefined") return "devnet";
  return (localStorage.getItem(NETWORK_STORAGE_KEY) as NetworkType) || "devnet";
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const adapterRef = useRef<WalletAdapter | null>(null);
  
  const [connection, setConnection] = useState<Connection>(() => getConnection(getSavedNetwork()));
  
  const [state, setState] = useState<WalletState>(() => ({
    connected: false,
    connecting: false,
    address: null,
    publicKey: null,
    balance: 0,
    wagaBalance: 0,
    walletName: null,
    network: getSavedNetwork(),
    balanceLoading: false,
  }));

  const { data: profile } = useQuery<PlayerProfile>({
    queryKey: ["/api/profile", state.address],
    enabled: state.connected && !!state.address,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (profile?.wagaEarned !== undefined) {
      setState(prev => ({
        ...prev,
        wagaBalance: profile.wagaEarned,
      }));
    }
  }, [profile?.wagaEarned]);

  const refreshBalance = useCallback(async () => {
    if (!state.publicKey || !connection) return;
    
    setState(prev => ({ ...prev, balanceLoading: true }));
    
    try {
      const balance = await connection.getBalance(state.publicKey);
      setState(prev => ({
        ...prev,
        balance: balance / LAMPORTS_PER_SOL,
        balanceLoading: false,
      }));
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setState(prev => ({ ...prev, balanceLoading: false }));
    }
  }, [state.publicKey, connection]);

  useEffect(() => {
    if (state.connected && state.publicKey) {
      refreshBalance();
      const interval = setInterval(refreshBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [state.connected, state.publicKey, refreshBalance]);

  const handleConnect = useCallback((publicKey: PublicKey) => {
    setState(prev => ({
      ...prev,
      connected: true,
      connecting: false,
      address: publicKey.toBase58(),
      publicKey,
    }));
  }, []);

  const handleDisconnect = useCallback(() => {
    setAdapter(null);
    adapterRef.current = null;
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
  }, []);

  const handleAccountChanged = useCallback((publicKey: PublicKey | null) => {
    if (publicKey) {
      setState(prev => ({
        ...prev,
        address: publicKey.toBase58(),
        publicKey,
      }));
    } else {
      handleDisconnect();
    }
  }, [handleDisconnect]);

  useEffect(() => {
    const currentAdapter = adapterRef.current;
    if (!currentAdapter?.on) return;

    const onConnect = () => {
      if (currentAdapter.publicKey) {
        handleConnect(currentAdapter.publicKey);
      }
    };

    const onDisconnect = () => {
      handleDisconnect();
    };

    const onAccountChanged = (publicKey: PublicKey | null) => {
      handleAccountChanged(publicKey);
    };

    currentAdapter.on("connect", onConnect);
    currentAdapter.on("disconnect", onDisconnect);
    currentAdapter.on("accountChanged", onAccountChanged);

    return () => {
      if (currentAdapter.off) {
        currentAdapter.off("connect", onConnect);
        currentAdapter.off("disconnect", onDisconnect);
        currentAdapter.off("accountChanged", onAccountChanged);
      }
    };
  }, [adapter, handleConnect, handleDisconnect, handleAccountChanged]);

  useEffect(() => {
    const savedWallet = localStorage.getItem(WALLET_STORAGE_KEY) as WalletName | null;
    if (!savedWallet) return;

    const attemptReconnect = async () => {
      const walletAdapter = getWalletByName(savedWallet);
      if (!walletAdapter) return;

      try {
        if (walletAdapter.connected && walletAdapter.publicKey) {
          setAdapter(walletAdapter);
          adapterRef.current = walletAdapter;
          
          const balance = await connection.getBalance(walletAdapter.publicKey);
          
          setState(prev => ({
            ...prev,
            connected: true,
            address: walletAdapter.publicKey!.toBase58(),
            publicKey: walletAdapter.publicKey,
            balance: balance / LAMPORTS_PER_SOL,
            walletName: savedWallet,
          }));
        } else {
          setState(prev => ({ ...prev, connecting: true }));
          
          const publicKey = await connectWallet(walletAdapter);
          
          setAdapter(walletAdapter);
          adapterRef.current = walletAdapter;
          
          const balance = await connection.getBalance(publicKey);
          
          setState(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            address: publicKey.toBase58(),
            publicKey,
            balance: balance / LAMPORTS_PER_SOL,
            walletName: savedWallet,
          }));
        }
      } catch (error) {
        console.error("Failed to reconnect wallet:", error);
        localStorage.removeItem(WALLET_STORAGE_KEY);
        setState(prev => ({ ...prev, connecting: false }));
      }
    };

    const timer = setTimeout(attemptReconnect, 100);
    return () => clearTimeout(timer);
  }, [connection]);

  const connect = useCallback(async (walletName: WalletName) => {
    setState(prev => ({ ...prev, connecting: true }));
    
    try {
      const walletAdapter = getWalletByName(walletName);
      
      if (!walletAdapter) {
        const allWallets = getAllWallets();
        const wallet = allWallets.find(w => w.name === walletName);
        if (wallet) {
          window.open(wallet.url, "_blank");
        }
        throw new Error(`Please install ${walletName} wallet`);
      }

      const publicKey = await connectWallet(walletAdapter);
      
      setAdapter(walletAdapter);
      adapterRef.current = walletAdapter;
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
    
    handleDisconnect();
  }, [adapter, handleDisconnect]);

  const switchNetwork = useCallback(async (network: NetworkType) => {
    setState(prev => ({ ...prev, balanceLoading: true }));
    
    const newConnection = getConnection(network);
    setConnection(newConnection);
    localStorage.setItem(NETWORK_STORAGE_KEY, network);
    
    setState(prev => ({
      ...prev,
      network,
    }));

    if (state.publicKey) {
      try {
        const balance = await newConnection.getBalance(state.publicKey);
        setState(prev => ({
          ...prev,
          balance: balance / LAMPORTS_PER_SOL,
          balanceLoading: false,
        }));
      } catch (error) {
        console.error("Failed to fetch balance on new network:", error);
        setState(prev => ({ ...prev, balanceLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, balanceLoading: false }));
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
        publicKey: state.publicKey,
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
