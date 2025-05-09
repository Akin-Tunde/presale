import { useState, useEffect } from 'react'; // Added useEffect
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi'; // Added useBalance
import { Connector } from "@wagmi/core"; // Added import
import { useNavigate, useLocation } from 'react-router-dom'; // Added useNavigate and useLocation
import { formatUnits } from "viem"; // Added formatUnits
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
// Removed Framer Motion imports for simplification

const ConnectWalletButton = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(null); // State to track pending connector
  const navigate = useNavigate(); // Get navigate function
  const location = useLocation(); // Get current location
  const { data: balanceData } = useBalance({ address }); // Fetch balance

  // Log connectors when the component mounts or connectors change
  useEffect(() => {
    console.log('Detected Connectors:', connectors);
    connectors.forEach(connector => {
      console.log(`- Connector ID: ${connector.id}, Name: ${connector.name}, Ready: ${connector.ready}`);
    });
  }, [connectors]);

  // Reset pending connector ID when connection status changes
  useEffect(() => {
    if (!isPending) {
      setPendingConnectorId(null);
    }
  }, [isPending]);

  // Redirect to /presales when connected from home page
  useEffect(() => {
    if (isConnected && location.pathname === '/') {
      // Close the dialog if open
      setOpen(false);
      // Navigate to the presales page
      navigate("/presales");
    }
    // Dependency array includes isConnected, navigate, and location.pathname
  }, [isConnected, navigate, location.pathname]);

  if (isConnected) {
    // Format balance to 4 decimal places
    const formattedBalance = balanceData
      ? parseFloat(formatUnits(balanceData.value, balanceData.decimals)).toFixed(4)
      : "0.0000";

    return (
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        {/* Balance - Show on sm+ */}
        <span className="text-sm font-medium hidden sm:inline order-1">
          {formattedBalance} {balanceData?.symbol || "ETH"}
        </span>
        {/* Address - Show on md+ */}
        <span className="text-sm truncate max-w-[100px] hidden md:inline order-2" title={address || ""}>{address}</span>
        {/* Button - Always show */}
        <Button variant="outline" size="sm" onClick={() => disconnect()} className="order-3">Disconnect</Button>
        {/* Balance for mobile - Show only below sm */}
        <span className="text-sm font-medium sm:hidden order-4 w-full text-right">
          {formattedBalance} {balanceData?.symbol || "ETH"}
        </span>
      </div>
    );
  }

  // Determine if any connectors are ready to be displayed
  const readyConnectors = connectors; // Temporarily remove readiness filter for debugging

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Connect Wallet</Button>
      </DialogTrigger>
      {/* Removed AnimatePresence and conditional rendering - DialogContent handles visibility */}
      <DialogContent className="sm:max-w-[425px]">
          {/* Removed motion.div wrapper */}
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogDescription>
              Choose your preferred wallet provider to connect to the DApp.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {readyConnectors.length > 0 ? (
              readyConnectors.map((connector: Connector) => (
                <Button
                  key={connector.id}
                  onClick={() => {
                    setPendingConnectorId(connector.id); // Set pending connector ID before connecting
                    connect({ connector });
                    // No need to setOpen(false) here, onOpenChange handles it
                  }}
                  disabled={isPending}
                >
                  {connector.name}
                  {/* Check pending state using local state variable */}
                  {isPending && pendingConnectorId === connector.id && ' (connecting...)'}
                </Button>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No compatible wallet detected. Please ensure your browser wallet extension (e.g., MetaMask, Backpack) is installed and enabled.</p>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error.message}</p>}
      </DialogContent>
    </Dialog>
  );
};

export default ConnectWalletButton;

