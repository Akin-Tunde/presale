import { http, createConfig } from 'wagmi';
import { base} from 'wagmi/chains'; // Added mainnet
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
 

export const config = createConfig({
  chains: [base], // Added mainnet
  connectors: [
  farcasterFrame()
  ],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org')
  },
  multiInjectedProviderDiscovery: true, // Enable EIP-6963
  ssr: false, // Set to true if using SSR/SSG
});

