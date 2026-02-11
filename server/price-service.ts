// Price service for fetching SOL/USD and token prices
// For testing, we'll use a mock WAGA price since it's not yet trading

let cachedSolPrice: number | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds
const FALLBACK_SOL_PRICE = 100; // Fallback price if API fails

// Mock WAGA price for testing (will be replaced with real DEX price once live)
const MOCK_WAGA_PRICE_USD = 0.001; // $0.001 per WAGA for testing

export async function getSolPrice(): Promise<number> {
  const now = Date.now();
  
  if (cachedSolPrice && cachedSolPrice > 0 && now - lastFetchTime < CACHE_DURATION) {
    return cachedSolPrice;
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch SOL price: HTTP ${response.status}`);
      return cachedSolPrice && cachedSolPrice > 0 ? cachedSolPrice : FALLBACK_SOL_PRICE;
    }
    
    const data = await response.json();
    
    if (data?.solana?.usd && typeof data.solana.usd === 'number' && data.solana.usd > 0) {
      cachedSolPrice = data.solana.usd;
      lastFetchTime = now;
      return cachedSolPrice!;
    }
    
    console.error("Invalid SOL price data:", data);
    return cachedSolPrice && cachedSolPrice > 0 ? cachedSolPrice : FALLBACK_SOL_PRICE;
  } catch (error) {
    console.error("Failed to fetch SOL price:", error);
    return cachedSolPrice && cachedSolPrice > 0 ? cachedSolPrice : FALLBACK_SOL_PRICE;
  }
}

export function getWagaPrice(): number {
  // For testing purposes, return mock price
  // In production, this will fetch from Raydium DEX
  return MOCK_WAGA_PRICE_USD;
}

export async function getUsernameUpdateCostSol(updateCount: number): Promise<{ costSol: number; costUsd: number; isFirstUpdate: boolean }> {
  const isFirstUpdate = updateCount === 0;
  const costUsd = isFirstUpdate ? 1.0 : 0.5;
  const solPrice = await getSolPrice();
  const costSol = parseFloat((costUsd / solPrice).toFixed(6));
  return { costSol, costUsd, isFirstUpdate };
}

export function calculateWagaReward(
  solAmount: number,
  multiplier: number
): number {
  if (!solAmount || solAmount <= 0 || !multiplier || multiplier <= 0) {
    return 0;
  }
  return Math.floor(solAmount * multiplier);
}
