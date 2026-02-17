import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="py-8 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <p className="text-sm text-muted-foreground">
            Built on Solana. Powered by HMAC-SHA256 Provably Fair.
            <span className="block mt-1 font-semibold text-primary">A TryUnity Foundation DApp</span>
          </p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
