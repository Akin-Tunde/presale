import { http, createConfig } from 'wagmi';
import { base, mainnet, sepolia } from 'wagmi/chains'; // Added mainnet

 

export const config = createConfig({
  chains: [base, mainnet, sepolia], // Added mainnet
  connectors: [
  
  ],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'),
    [mainnet.id]: http(import.meta.env.VITE_MAINNET_RPC_URL || 'https://cloudflare-eth.com'), 
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL)
  },
  multiInjectedProviderDiscovery: true, // Enable EIP-6963
  ssr: false, // Set to true if using SSR/SSG
});

