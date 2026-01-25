import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { Wallet, LogOut, User, Trophy, Gamepad2, Droplets, Loader2, Coins, Repeat, Menu, X } from "lucide-react";
import headerLogo from "@assets/myluckysol-header-logo_1768586127704.png";
import { WalletModal } from "./WalletModal";
import { useSolPrice } from "@/lib/price-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

import solanaLogo from "@assets/solanaLogoMark_1769362416276.png";
import wagaLogo from "@assets/waga-5000px-modified_1769362416276.png";

function PriceWidget() {
  const { solPrice } = useSolPrice();
  const [displayType, setDisplayType] = useState<"SOL" | "WAGA">("SOL");
  
  // Mock WAGA price for now
  const wagaPrice = 0.001;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 h-9 border-border/50 bg-background/50 hover:bg-background/80 transition-all duration-300 group"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDisplayType(prev => prev === "SOL" ? "WAGA" : "SOL");
      }}
      data-testid="button-price-widget"
    >
      <div className="flex items-center gap-1.5">
        {displayType === "SOL" ? (
          <>
            <img src={solanaLogo} alt="Solana" className="w-5 h-5 object-contain" />
            <span className="text-sm font-mono font-medium text-gradient-solana">
              ${solPrice?.toFixed(2) || "---"}
            </span>
          </>
        ) : (
          <>
            <img src={wagaLogo} alt="WAGA" className="w-5 h-5 object-contain" />
            <span className="text-sm font-mono font-medium text-gradient-gold">
              ${wagaPrice.toFixed(4)}
            </span>
          </>
        )}
        <Repeat className="w-3 h-3 text-muted-foreground transition-opacity" />
      </div>
    </Button>
  );
}

export function Header() {
  const { 
    connected, 
    shortAddress, 
    balance, 
    wagaBalance, 
    disconnect, 
    profile,
    network,
    switchNetwork,
    requestAirdrop,
    walletName,
  } = useWallet();
  const [location] = useLocation();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [airdropLoading, setAirdropLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const navItems = [
    { href: "/play", label: "Play", icon: Gamepad2 },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  const handleAirdrop = async () => {
    setAirdropLoading(true);
    try {
      await requestAirdrop();
      toast({
        title: "Airdrop successful",
        description: "1 SOL has been added to your wallet",
      });
    } catch (error) {
      toast({
        title: "Airdrop failed",
        description: error instanceof Error ? error.message : "Failed to request airdrop",
        variant: "destructive",
      });
    } finally {
      setAirdropLoading(false);
    }
  };

  const getWalletDisplayName = () => {
    const names: Record<string, string> = {
      phantom: "Phantom",
      solflare: "Solflare",
      okx: "OKX",
      backpack: "Backpack",
    };
    return walletName ? names[walletName] : null;
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 h-full pt-4 pb-2">
              <img
                src={headerLogo}
                alt="MyLuckySol"
                className="h-14 w-auto md:h-14 md:pt-0"
                data-testid="img-header-logo"
              />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`gap-2 ${isActive ? "text-secondary-foreground" : "text-muted-foreground"}`}
                      data-testid={`link-nav-${item.label.toLowerCase()}`}
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <PriceWidget />
              </div>
              
              {connected ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-wallet-dropdown">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      {profile?.username || shortAddress}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Connected via {getWalletDisplayName()}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`h-6 px-2 text-[10px] uppercase font-bold tracking-wider ${network === "devnet" ? "text-purple-400 bg-purple-400/10" : "text-green-400 bg-green-400/10"}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            switchNetwork(network === "devnet" ? "mainnet-beta" : "devnet");
                          }}
                        >
                          {network === "devnet" ? "Devnet" : "Mainnet"}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">SOL Balance</span>
                        <span className="text-sm font-medium font-mono text-gradient-gold">
                          {balance.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">WAGA Tokens</span>
                        <span className="text-sm font-medium font-mono text-secondary">
                          {wagaBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    
                    {network === "devnet" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleAirdrop}
                          disabled={airdropLoading}
                          className="cursor-pointer"
                          data-testid="button-airdrop"
                        >
                          {airdropLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Droplets className="h-4 w-4 mr-2 text-cyan-400" />
                          )}
                          Request Devnet SOL
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={disconnect}
                      className="text-destructive focus:text-destructive cursor-pointer"
                      data-testid="button-disconnect"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button 
                  onClick={() => setWalletModalOpen(true)} 
                  className="gap-2" 
                  data-testid="button-connect-wallet"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
              )}

              {/* Mobile Sandwich Menu */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-muted-foreground"
                  data-testid="button-mobile-menu"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom Row Mobile Only: Price Widget positioned to the right */}
          <div className="flex md:hidden h-10 items-center justify-end pb-2">
            <PriceWidget />
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border/50 bg-background px-4 py-4 space-y-2 animate-in slide-in-from-top-4 duration-200">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-3 h-12 ${isActive ? "text-secondary-foreground" : "text-muted-foreground"}`}
                    data-testid={`link-nav-mobile-${item.label.toLowerCase()}`}
                  >
                    {item.icon && <item.icon className="h-5 w-5" />}
                    <span className="text-base font-medium">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </>
  );
}
