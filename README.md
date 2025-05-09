# Presale DApp Frontend

This is a React (Vite + TypeScript) frontend application for interacting with presale smart contracts on the Base Mainnet, built according to the provided prompt.

## Features

- Connect wallets (MetaMask, WalletConnect)
- View list of presales with search and pagination
- View detailed information for each presale
- Contribute to active presales (ETH and ERC20 - approve flow needed for ERC20)
- Claim tokens or refunds
- Create new presales via a form
- User profile page showing contributions, vesting schedules, and created presales
- Light/Dark theme support (via shadcn/ui defaults)
- Responsive design

## Setup

1.  **Prerequisites:**
    *   Node.js (v18 or later recommended)
    *   pnpm package manager (`npm install -g pnpm`)

2.  **Clone/Extract:**
    *   Extract the source code zip file.

3.  **Install Dependencies:**
    *   Navigate to the project root directory (`presale-dapp`).
    *   Run `pnpm install`

4.  **Environment Variables:**
    *   Create a `.env` file in the project root.
    *   Copy the contents from `.env.example` (if provided) or add the following variables:
        ```env
        VITE_PRESALE_FACTORY_ADDRESS="0x81A698158Ca312346D0cf0d6730832e19b67bD4D"
        VITE_LIQUIDITY_LOCKER_ADDRESS="0xDb4a7e2ad3e19392F40b4f476Fe44c381f1C7Ef7"
        VITE_VESTING_ADDRESS="0xaED17710e9208ce0D2AE0D1fD952c29f2F1551F4"
        VITE_BASE_MAINNET_RPC_URL="https://mainnet.base.org" # Or your preferred Base RPC URL
        VITE_UNISWAP_ROUTER_ADDRESS="0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" # Example: BaseSwap Router - Verify this!
        VITE_WETH_ADDRESS="0x4200000000000000000000000000000000000006" # WETH on Base
        VITE_WALLETCONNECT_PROJECT_ID="YOUR_WALLETCONNECT_PROJECT_ID" # Get from WalletConnect Cloud
        ```
    *   **Important:** Replace `YOUR_WALLETCONNECT_PROJECT_ID` with your actual Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/).
    *   **Verify:** Ensure the `VITE_UNISWAP_ROUTER_ADDRESS` is correct for the DEX you intend to use on Base Mainnet.

## Running the Development Server

1.  Navigate to the project root directory.
2.  Run `pnpm run dev`
3.  Open your browser and go to the local URL provided (usually `http://localhost:5173`).

## Building for Production

1.  Navigate to the project root directory.
2.  Run `pnpm run build`
3.  The production-ready static files will be generated in the `dist` directory. These files can be deployed to any static hosting service.

## Notes

*   The application interacts directly with Base Mainnet contracts.
*   ERC20 contribution requires the user to approve the presale contract first. The UI currently prompts this but doesn't fully implement the multi-step approve+contribute flow.
*   Filtering/searching on the presale list page is currently basic (address only). For better performance with many presales, especially filtering by status or token name, integrating a subgraph or backend indexer is recommended.
*   Ensure all contract addresses and the RPC URL in the `.env` file are correct.

