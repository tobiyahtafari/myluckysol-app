import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet-context";
import { Header } from "@/components/Header";
import { MobileNav } from "@/components/MobileNav";
import { Footer } from "@/components/Footer";
import Home from "@/pages/Home";
import Play from "@/pages/Play";
import GameRoom from "@/pages/GameRoom";
import Profile from "@/pages/Profile";
import Leaderboard from "@/pages/Leaderboard";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import HowToPlay from "@/pages/HowToPlay";
import Docs from "@/pages/Docs";
import Fairness from "@/pages/Fairness";
import Giveaway from "@/pages/Giveaway";
import Chat from "@/pages/Chat";
import ReferralTracking from "@/pages/ReferralTracking";
import NotFound from "@/pages/not-found";
import { GameNotificationManager } from "@/components/GameNotification";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/play" component={Play} />
        <Route path="/game/:id" component={GameRoom} />
        <Route path="/profile" component={Profile} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/how-to-play" component={HowToPlay} />
        <Route path="/docs" component={Docs} />
        <Route path="/fairness" component={Fairness} />
        <Route path="/giveaway" component={Giveaway} />
        <Route path="/chat" component={Chat} />
        <Route path="/profile/referrals" component={ReferralTracking} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

import { PriceProvider } from "./lib/price-context";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PriceProvider>
        <TooltipProvider>
          <WalletProvider>
            <div className="min-h-screen bg-background pb-24 md:pb-0 flex flex-col">
              <Header />
              <main className="flex-1">
                <Router />
              </main>
              <Footer />
              <MobileNav />
            </div>
            <GameNotificationManager />
            <Toaster />
          </WalletProvider>
        </TooltipProvider>
      </PriceProvider>
    </QueryClientProvider>
  );
}

export default App;
