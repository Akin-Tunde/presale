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

  // ✅ Fixed: explicitly declare number[] to avoid literal type error
  const allowedChainIds: number[] = [base.id, sepolia.id];
  const allowedChainNames = [base.name, sepolia.name].join(" or ");

  useEffect(() => {
    console.log("Detected Connectors:", connectors);
    connectors.forEach((connector) => {
      console.log(
        `- Connector ID: ${connector.id}, Name: ${connector.name}, Ready: ${connector.ready}`
      );
    });
  }, [connectors]);

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
          onClick={() => disconnect()}
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

  const readyConnectors = connectors;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setChainError(null);
        }
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
          {readyConnectors.length > 0 ? (
            readyConnectors.map((connector: Connector) => (
              <Button
                key={connector.id}
                onClick={async () => {
                  setPendingConnectorId(connector.id);
                  setChainError(null);
                  try {
                    const currentWalletChainId = await connector.getChainId();
                    if (!allowedChainIds.includes(currentWalletChainId)) {
                      setChainError(
                        `Your wallet is on an unsupported network (ID: ${currentWalletChainId}). Please switch to ${allowedChainNames} in your wallet and try again.`
                      );
                      setPendingConnectorId(null);
                      return;
                    }
                    connect({ connector });
                  } catch (err: any) {
                    console.error(
                      "Error during pre-connection check or connect:",
                      err
                    );
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
              extension (e.g., MetaMask, Backpack) is installed and enabled.
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
