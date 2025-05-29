import { http, createConfig, injected } from "wagmi";
import { base, sepolia } from "wagmi/chains"; // Added mainnet
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

export const config = createConfig({
  chains: [base, sepolia], // Added mainnet
  connectors: [farcasterFrame(), injected()],
  transports: {
    [base.id]: http(
      import.meta.env.VITE_BASE_MAINNET_RPC_URL || "https://mainnet.base.org"
    ),
    [sepolia.id]: http(
      import.meta.env.VITE_SEPOLIA_RPC_URL || "https://sepolia.base.org"
    ),
  },
  multiInjectedProviderDiscovery: true, // Enable EIP-6963
  ssr: false, // Set to true if using SSR/SSG
});
