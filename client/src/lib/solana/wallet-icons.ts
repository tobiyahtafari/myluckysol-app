import phantomIcon from "@assets/image_1773165043655.png";
import solflareIcon from "@assets/image_1773165062599.png";
import okxIcon from "@assets/image_1773165075564.png";
import backpackIcon from "@assets/image_1773165105473.png";
import metamaskIcon from "@assets/image_1773165159490.png";

const seekerIcon = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%230f0f0f"/><text x="50" y="68" font-family="monospace" font-size="58" font-weight="bold" fill="%23F5B800" text-anchor="middle">S</text></svg>`;

export const WALLET_ICONS: Record<string, string> = {
  seeker: seekerIcon,
  phantom: phantomIcon,
  solflare: solflareIcon,
  okx: okxIcon,
  backpack: backpackIcon,
  metamask: metamaskIcon,
};
