import { Link, useLocation } from "wouter";
import { Home, Gamepad2, Trophy, User, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/play?tab=live", label: "Live", icon: Activity },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/leaderboard", label: "Rankings", icon: Trophy },
  ];

  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2, 4);

  return (
    <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 px-4 pointer-events-none">
      <div className="max-w-md mx-auto relative h-16 pointer-events-auto">
        {/* Glass Background */}
        <div className="absolute inset-0 bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/50" />
        
        <div className="relative h-full flex items-center justify-between px-2">
          {/* Left Items */}
          <div className="flex flex-1 justify-around items-center">
            {leftItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}>
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Central Join Button */}
          <div className="relative -top-6">
            <Link href="/play?tab=join">
              <div className="flex flex-col items-center gap-2 group cursor-pointer" data-testid="link-mobile-nav-join">
                <div className="w-14 h-14 rounded-full bg-primary shadow-[0_0_20px_rgba(245,184,0,0.4)] flex items-center justify-center transition-transform duration-300 group-active:scale-90 border-4 border-background">
                  <Gamepad2 className="h-7 w-7 text-black fill-black" />
                </div>
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider drop-shadow-md">Join Game</span>
              </div>
            </Link>
          </div>

          {/* Right Items */}
          <div className="flex flex-1 justify-around items-center">
            {rightItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-1 transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}>
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
