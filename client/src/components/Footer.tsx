import { Link } from "wouter";

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
          <p className="text-sm font-semibold text-primary">
            A TryUnity Foundation DApp
          </p>
          <div className="flex items-center gap-6">
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
