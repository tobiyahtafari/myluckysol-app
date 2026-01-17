import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

interface PriceContextType {
  solPrice: number | null;
  isLoading: boolean;
  convertSolToUsd: (solAmount: number) => string;
}

const PriceContext = createContext<PriceContextType | null>(null);

export function PriceProvider({ children }: { children: ReactNode }) {
  const { data: price, isLoading } = useQuery({
    queryKey: ["/api/sol-price"],
    queryFn: async () => {
      // Using a public API like CoinGecko or similar. For demo/MVP, we can use a reliable source.
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
      const data = await response.json();
      return data.solana.usd as number;
    },
    refetchInterval: 30000, // 30 seconds
    staleTime: 25000,
  });

  const convertSolToUsd = (solAmount: number) => {
    if (!price) return "$0.00";
    const usdValue = solAmount * price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(usdValue);
  };

  return (
    <PriceContext.Provider value={{ solPrice: price || null, isLoading, convertSolToUsd }}>
      {children}
    </PriceContext.Provider>
  );
}

export function useSolPrice() {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error("useSolPrice must be used within a PriceProvider");
  }
  return context;
}

export function SolToUsd({ sol, className }: { sol: number; className?: string }) {
  const { convertSolToUsd } = useSolPrice();
  return <span className={`text-lime-400 ${className || ""}`}>({convertSolToUsd(sol)})</span>;
}
