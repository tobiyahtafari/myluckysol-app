import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, Wallet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet-context";
import type { WalletName } from "@/lib/solana/wallet-adapter";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, connecting, allWallets } = useWallet();
  const [connectingWallet, setConnectingWallet] = useState<WalletName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (walletName: WalletName) => {
    setError(null);
    setConnectingWallet(walletName);
    
    try {
      await connect(walletName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setConnectingWallet(null);
    }
  };

  // Check if we're in a mobile/app context (WebView)
  // Desktop detection: if UA doesn't have mobile/Android/iOS, it's desktop
  const isMobileOrApp = /android|ios|iphone|ipad|mobile|webview|app/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  // Always show Seeker on mobile/app context, or if getAllWallets includes it
  const seekerWallet = allWallets.find(w => w.name === "seeker");
  const otherWallets = allWallets.filter(w => w.name !== "seeker");
  const showSeekerProminent = isMobileOrApp || seekerWallet;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md pointer-events-auto">
              <div className="bg-[#1a1a2e] border border-[#F5B800]/20 rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#F5B800]" />
                    <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                    data-testid="button-close-wallet-modal"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="p-4 space-y-3">
                  {/* Seeker prominent connect button on mobile/app */}
                  {showSeekerProminent && (
                    <div className="space-y-3">
                      <button
                        onClick={() => handleConnect("seeker")}
                        disabled={connecting || connectingWallet !== null}
                        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#F5B800] hover:bg-[#F5B800]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="button-connect-seeker"
                      >
                        {connectingWallet === "seeker" ? (
                          <Loader2 className="w-5 h-5 text-black animate-spin" />
                        ) : (
                          <Smartphone className="w-5 h-5 text-black" />
                        )}
                        <span className="font-bold text-black text-base">
                          {connectingWallet === "seeker" ? "Connecting..." : "Connect Wallet"}
                        </span>
                      </button>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-gray-500 uppercase tracking-wider">or select installed wallet</span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>
                    </div>
                  )}

                  {/* Standard wallet list */}
                  {otherWallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleConnect(wallet.name)}
                      disabled={connecting || connectingWallet !== null}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-[#F5B800]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`button-connect-${wallet.name}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                        <img 
                          src={wallet.icon} 
                          alt={wallet.displayName}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const fallback = document.createElement('span');
                              fallback.textContent = wallet.displayName.charAt(0);
                              fallback.className = 'text-white font-bold text-lg';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-white">{wallet.displayName}</div>
                        {wallet.warning ? (
                          <div className="text-xs text-yellow-500/80">{wallet.warning}</div>
                        ) : !wallet.installed ? (
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            Not installed <ExternalLink className="w-3 h-3" />
                          </div>
                        ) : null}
                      </div>
                      {connectingWallet === wallet.name ? (
                        <Loader2 className="w-5 h-5 text-[#F5B800] animate-spin" />
                      ) : wallet.warning ? (
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      ) : wallet.installed ? (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      ) : null}
                    </button>
                  ))}

                  {/* Install guidance for mobile/app users */}
                  {isMobileOrApp && (
                    <div className="p-3 rounded-lg bg-[#F5B800]/5 border border-[#F5B800]/20">
                      <p className="text-xs text-[#F5B800]/80 leading-relaxed">
                        For the best experience, install <strong>Phantom</strong> or <strong>Solflare</strong> from the Solana dApp Store.
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="px-4 pb-4">
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      {error}
                    </div>
                  </div>
                )}

                <div className="p-4 border-t border-white/10 bg-white/5">
                  <p className="text-xs text-gray-400 text-center">
                    By connecting, you agree to the Terms of Service and Privacy Policy
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
