import { http, createConfig } from 'wagmi';
import { base, mainnet } from 'wagmi/chains'; // Added mainnet
import { injected } from 'wagmi/connectors';

// const projectId = 'YOUR_WALLETCONNECT_PROJECT_ID'; // Replace with your actual WalletConnect Project ID

export const config = createConfig({
  chains: [base, mainnet], // Added mainnet
  connectors: [
    injected(),
    // walletConnect({ projectId }),
    // Add other connectors like Coinbase Wallet if needed
  ],
  transports: {
    [base.id]: http(import.meta.env.VITE_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org'),
    [mainnet.id]: http(import.meta.env.VITE_MAINNET_RPC_URL || 'https://cloudflare-eth.com'), // Added mainnet transport
  },
  multiInjectedProviderDiscovery: true, // Enable EIP-6963
  ssr: false, // Set to true if using SSR/SSG
});

