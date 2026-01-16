import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import { Wallet, LogOut, User, Trophy, Gamepad2 } from "lucide-react";
import headerLogo from "@assets/myluckysol-header-logo_1768586127704.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useSolPrice, SolToUsd } from "@/lib/price-context";

export function Header() {
  const { connected, shortAddress, balance, wagaBalance, connect, disconnect, profile } = useWallet();
  const { solPrice } = useSolPrice();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home", icon: null },
    { href: "/play", label: "Play", icon: Gamepad2 },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={headerLogo}
              alt="MyLuckySol"
              className="h-14 w-auto"
              data-testid="img-header-logo"
            />
          </Link>

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

          <div className="flex items-center gap-3">
            {connected ? (
              <>
                <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-lg bg-card border border-card-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm font-medium text-gradient-gold">
                      {balance.toFixed(2)} SOL <SolToUsd sol={balance} className="text-[10px] opacity-70 ml-1" />
                    </span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <span className="text-sm font-medium text-secondary">
                    {wagaBalance.toLocaleString()} WAGA
                  </span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-wallet-dropdown">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      {profile?.username || shortAddress}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
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
              </>
            ) : (
              <Button onClick={connect} className="gap-2" data-testid="button-connect-wallet">
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>

      <nav className="md:hidden flex items-center justify-center gap-1 pb-2 px-4">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={`gap-1 ${isActive ? "text-secondary-foreground" : "text-muted-foreground"}`}
                data-testid={`link-nav-mobile-${item.label.toLowerCase()}`}
              >
                {item.icon && <item.icon className="h-3 w-3" />}
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
