import { Link } from "wouter";
import tryUnityLogo from "@assets/tryunity_1772463876592.png";

export function Footer() {
  return (
    <footer className="py-8 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <p className="text-sm text-muted-foreground">
            Built on Solana.
          </p>
          <p className="text-sm text-muted-foreground">
            Powered by HMAC-SHA256 Provably Fair.
          </p>
          <a 
            href="http://tryunity.life" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity flex items-center gap-1.5"
          >
            A TryUnity 
            <img src={tryUnityLogo} alt="TryUnity Logo" className="w-4 h-4 object-contain" />
            Foundation DApp
          </a>
          <div className="flex items-center gap-6 mt-2">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/fairness" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Fairness
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
