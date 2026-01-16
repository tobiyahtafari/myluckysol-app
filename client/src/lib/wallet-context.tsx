import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number;
  wagaBalance: number;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  shortAddress: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

function generateMockAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "";
  for (let i = 0; i < 44; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    balance: 0,
    wagaBalance: 0,
  });

  const connect = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const address = generateMockAddress();
    setState({
      connected: true,
      address,
      balance: Math.random() * 10 + 1,
      wagaBalance: Math.floor(Math.random() * 10000) + 100,
    });
  }, []);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      address: null,
      balance: 0,
      wagaBalance: 0,
    });
  }, []);

  const shortAddress = state.address
    ? `${state.address.slice(0, 4)}...${state.address.slice(-4)}`
    : null;

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, shortAddress }}>
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
