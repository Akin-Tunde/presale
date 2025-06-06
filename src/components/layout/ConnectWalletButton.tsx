import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { Connector } from "@wagmi/core";
import { useNavigate, useLocation } from "react-router-dom";
import { formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { base, sepolia } from "wagmi/chains";
import { sdk } from "@farcaster/frame-sdk";

const ConnectWalletButton = () => {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(
    null
  );
  const navigate = useNavigate();
  const location = useLocation();
  const { data: balanceData } = useBalance({ address });
  const [chainError, setChainError] = useState<string | null>(null);

  const allowedChainIds: number[] = [base.id, sepolia.id];
  const allowedChainNames = [base.name, sepolia.name].join(" or ");

  // Auto-connect with Farcaster in mini app
  useEffect(() => {
    const autoConnectIfMiniApp = async () => {
      try {
        const isMiniApp = await sdk.isInMiniApp();
        if (isMiniApp && !isConnected && connectors.length > 0) {
          const farcasterConnector = connectors.find(
            (c) => c.id === "farcasterFrame"
          );
          if (farcasterConnector) {
            await connect({ connector: farcasterConnector });
          }
        }
      } catch (error) {
        console.error("Error during Mini App auto-connect:", error);
      }
    };
    autoConnectIfMiniApp();
  }, [isConnected, connect, connectors]);

  useEffect(() => {
    if (!isPending) {
      setPendingConnectorId(null);
    }
  }, [isPending]);

  useEffect(() => {
    if (isConnected && location.pathname === "/") {
      setOpen(false);
      navigate("/presales");
    }
  }, [isConnected, navigate, location.pathname]);

  // Button click handler: prefer Farcaster, then injected, then fallback
  const handleButtonClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      const farcasterConnector = connectors.find(
        (c) => c.id === "farcasterFrame"
      );
      const injectedConnector = connectors.find((c) => c.id === "injected");
      if (
        farcasterConnector &&
        "ready" in farcasterConnector &&
        farcasterConnector.ready
      ) {
        connect({ connector: farcasterConnector });
      } else if (
        injectedConnector &&
        "ready" in injectedConnector &&
        injectedConnector.ready
      ) {
        connect({ connector: injectedConnector });
      } else if (injectedConnector) {
        connect({ connector: injectedConnector });
      } else if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      } else if (connectors.length > 0) {
        connect({ connector: connectors[0] });
      }
    }
  };

  if (isConnected) {
    const isCorrectChainConnected =
      connectedChainId && allowedChainIds.includes(connectedChainId);

    const formattedBalance = balanceData
      ? parseFloat(
          formatUnits(balanceData.value, balanceData.decimals)
        ).toFixed(4)
      : "0.0000";

    return (
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <span className="text-sm font-medium hidden sm:inline order-1">
          {formattedBalance} {balanceData?.symbol || "ETH"}
        </span>
        <span
          className="text-sm truncate max-w-[100px] hidden md:inline order-2"
          title={address || ""}
        >
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          className="order-3"
        >
          Disconnect
        </Button>
        <span className="text-sm font-medium sm:hidden order-4 w-full text-right">
          {formattedBalance} {balanceData?.symbol || "ETH"}
        </span>
        {!isCorrectChainConnected && connectedChainId && (
          <p className="text-red-500 text-xs mt-1 w-full text-right order-5">
            Warning: Connected to unsupported network (ID: {connectedChainId}).
            Please switch to {allowedChainNames}.
          </p>
        )}
      </div>
    );
  }

  // Not connected: show dialog with all connectors
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setChainError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>Connect Wallet</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>
            Choose your preferred wallet provider to connect to the DApp.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {connectors.length > 0 ? (
            connectors.map((connector: Connector) => (
              <Button
                key={connector.id}
                onClick={async () => {
                  setPendingConnectorId(connector.id);
                  setChainError(null);
                  try {
                    // Only check chain for injected wallets
                    if (
                      connector.id === "injected" &&
                      "getChainId" in connector
                    ) {
                      const currentWalletChainId = await connector.getChainId();
                      if (!allowedChainIds.includes(currentWalletChainId)) {
                        setChainError(
                          `Your wallet is on an unsupported network (ID: ${currentWalletChainId}). Please switch to ${allowedChainNames} in your wallet and try again.`
                        );
                        setPendingConnectorId(null);
                        return;
                      }
                    }
                    connect({ connector });
                  } catch (err: any) {
                    setChainError(
                      `Failed to connect: ${err.message || "Unknown error"}`
                    );
                    setPendingConnectorId(null);
                  }
                }}
                disabled={isPending && pendingConnectorId === connector.id}
              >
                {connector.name}
                {isPending &&
                  pendingConnectorId === connector.id &&
                  " (connecting...)"}
              </Button>
            ))
          ) : (
            <p className="text-center text-muted-foreground">
              No compatible wallet detected. Please ensure your browser wallet
              extension (e.g., MetaMask, Backpack, or Farcaster) is installed
              and enabled.
            </p>
          )}
        </div>
        {chainError && (
          <p className="text-red-500 text-sm mt-2">{chainError}</p>
        )}
        {connectError && (
          <p className="text-red-500 text-sm mt-2">{connectError.message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConnectWalletButton;
