import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
  useFeeData,
  useReadContract,
} from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import {
  type Abi,
  encodeFunctionData,
  type Address,
  formatUnits,
  isHex,
  zeroAddress,
  erc20Abi,
} from "viem";
import PresaleJson from "@/abis/Presale.json";
import { getPresaleStatus, type PresaleStatusReturn } from "@/lib/utils";
import { ensureString, shortenAddress, formatTimestamp } from "./utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import EstimatedFeeDisplay from "./EstimatedFeeDisplay";

const presaleAbi = PresaleJson.abi as Abi;

interface CreatorPresaleCardProps {
  presaleAddress: Address;
  refetchCreatedPresalesList: () => void;
}

const CreatorPresaleCard: React.FC<CreatorPresaleCardProps> = ({
  presaleAddress,
  refetchCreatedPresalesList,
}) => {
  const { address: userAddress } = useAccount();
  const {
    writeContractAsync,
    data: hash,
    isPending: isWritePending,
    reset: resetWriteContract,
  } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash });
  const { data: feeData } = useFeeData();

  const [actionError, setActionError] = useState<string>("");
  
  const presaleContract = { address: presaleAddress, abi: presaleAbi } as const;

  const {
    data: presaleDetailsResults,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
    isError: isDetailsError,
    error: detailsErrorHook,
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      { ...presaleContract, functionName: "options" },
      { ...presaleContract, functionName: "state" },
      { ...presaleContract, functionName: "paused" },
      { ...presaleContract, functionName: "whitelistEnabled" },
      { ...presaleContract, functionName: "getTotalContributed" },
      { ...presaleContract, functionName: "owner" },
      { ...presaleContract, functionName: "token" },
      { ...presaleContract, functionName: "ownerBalance" },
    ],
  });

  const ownerCallResult = presaleDetailsResults?.[5];
  const fetchedOwner =
    ownerCallResult?.status === "success"
      ? (ownerCallResult.result as Address)
      : undefined;
  const isOwner =
    !!userAddress &&
    !!fetchedOwner &&
    fetchedOwner.toLowerCase() === userAddress.toLowerCase();

  const optionsResult = presaleDetailsResults?.[0];
  const stateCallResult = presaleDetailsResults?.[1];
  const pausedCallResult = presaleDetailsResults?.[2];
  const whitelistEnabledCallResult = presaleDetailsResults?.[3];
  const totalContributedCallResult = presaleDetailsResults?.[4];
  const tokenAddressCallResult = presaleDetailsResults?.[6];
  const ownerBalanceCallResult = presaleDetailsResults?.[7];

  const options =
    optionsResult?.status === "success"
      ? (optionsResult.result as any[])
      : undefined;

  const state =
    stateCallResult?.status === "success"
      ? (stateCallResult.result as number)
      : undefined;
  const paused =
    pausedCallResult?.status === "success"
      ? (pausedCallResult.result as boolean)
      : undefined;
  const whitelistEnabled =
    whitelistEnabledCallResult?.status === "success"
      ? (whitelistEnabledCallResult.result as boolean)
      : undefined;
  const ownerBalance =
    ownerBalanceCallResult?.status === "success"
      ? (ownerBalanceCallResult.result as bigint)
      : undefined;
  const presaleTokenAddress =
    tokenAddressCallResult?.status === "success"
      ? (tokenAddressCallResult.result as Address)
      : undefined;

  const {
    data: fetchedPresaleTokenSymbol,
    isLoading: isLoadingPresaleTokenSymbol,
  } = useReadContract({
    address: presaleTokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!presaleTokenAddress },
  });
  const presaleTokenSymbol = fetchedPresaleTokenSymbol as string | undefined;

  const currencyAddressFromOptions = options?.[15] as Address | undefined;
  const currencyIsEth = currencyAddressFromOptions === zeroAddress;

  const {
    data: fetchedCurrencySymbol,
    isLoading: isLoadingCurrencySymbolCreator,
  } = useReadContract({
    address: currencyAddressFromOptions,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!currencyAddressFromOptions && !currencyIsEth },
  });

  const {
    data: fetchedCurrencyDecimals,
    isLoading: isLoadingCurrencyDecimalsCreator,
  } = useReadContract({
    address: currencyAddressFromOptions,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: !!currencyAddressFromOptions && !currencyIsEth },
  });

  const paymentDecimalsToUse = currencyIsEth
    ? 18
    : (fetchedCurrencyDecimals as number | undefined);
  const paymentSymbolToUse = currencyIsEth
    ? "ETH"
    : (fetchedCurrencySymbol as string | undefined) ??
      (paymentDecimalsToUse !== undefined ? "Tokens" : "raw units");

  useEffect(() => {
    if (isConfirmed && receipt) {
      toast.success("Action Confirmed!", {
        description: `Tx: ${ensureString(receipt.transactionHash)}`,
      });
      setActionError("");
     
      refetchCreatedPresalesList();
      refetchDetails();
      resetWriteContract();
    }
  }, [
    isConfirmed,
    receipt,
    refetchCreatedPresalesList,
    refetchDetails,
    resetWriteContract,
  ]);

  let totalContributed: bigint | undefined = undefined;
  if (totalContributedCallResult?.status === "success") {
    if (
      totalContributedCallResult.result === null ||
      (isHex(totalContributedCallResult.result) &&
        totalContributedCallResult.result === "0x")
    ) {
      totalContributed = 0n;
    } else {
      totalContributed = totalContributedCallResult.result as bigint;
    }
  }

  const presaleDataAvailable =
    options !== undefined &&
    state !== undefined &&
    paused !== undefined &&
    whitelistEnabled !== undefined &&
    totalContributed !== undefined &&
    fetchedOwner !== undefined;
  const presaleStatus: PresaleStatusReturn =
    presaleDataAvailable && state !== undefined && options !== undefined
      ? getPresaleStatus(state, options)
      : { text: "Loading...", variant: "default" };

  const softCap = options?.[2] as bigint | undefined;
  const startTime = options?.[9] as bigint | undefined;
  const endTime = options?.[10] as bigint | undefined;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

  const canFinalize =
    isOwner &&
    presaleDataAvailable &&
    state === 1 &&
    endTime !== undefined &&
    nowSeconds > endTime &&
    totalContributed !== undefined &&
    softCap !== undefined &&
    totalContributed >= softCap;
  const canCancel =
    isOwner &&
    presaleDataAvailable &&
    (state === 0 ||
      (state === 1 &&
        totalContributed !== undefined &&
        softCap !== undefined &&
        totalContributed < softCap));
  const canWithdraw =
    isOwner &&
    presaleDataAvailable &&
    (state === 2 || state === 3) &&
    ownerBalance !== undefined &&
    ownerBalance > 0n;
  const canPauseUnpause = isOwner && presaleDataAvailable && state === 1;
  const canToggleWhitelist = isOwner && presaleDataAvailable && state === 0;
 
  const { data: finalizeGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "finalize",
      args: [],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canFinalize },
  });
  const { data: cancelGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "cancel",
      args: [],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canCancel },
  });
  const { data: withdrawGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "withdraw",
      args: [],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canWithdraw },
  });
  const { data: pauseGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "pause",
      args: [],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canPauseUnpause && paused === false },
  });
  const { data: unpauseGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "unpause",
      args: [],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canPauseUnpause && paused === true },
  });
  const { data: toggleWhitelistGas } = useEstimateGas({
    to: presaleAddress,
    data: encodeFunctionData({
      abi: presaleAbi,
      functionName: "toggleWhitelist",
      args: [!(whitelistEnabled ?? false)],
    }),
    account: userAddress,
    query: { enabled: !!userAddress && canToggleWhitelist },
  });
  
  const isLoadingAdditionalData =
    (!currencyIsEth &&
      (isLoadingCurrencySymbolCreator || isLoadingCurrencyDecimalsCreator)) ||
    isLoadingPresaleTokenSymbol;

  if (isLoadingDetails || isLoadingAdditionalData) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  let errorMessagesToDisplay: string[] = [];
  if (detailsErrorHook)
    errorMessagesToDisplay.push(
      ensureString(detailsErrorHook, "Presale details hook error.")
    );
  presaleDetailsResults?.forEach((result) => {
    if (result?.status === "failure" && result.error) {
      if (
        !(
          result === totalContributedCallResult &&
          (result.error as any)?.message?.includes("returned no data")
        )
      ) {
        errorMessagesToDisplay.push(
          ensureString(result.error, "A contract call failed.")
        );
      }
    }
  });
  if (
    totalContributedCallResult?.status === "failure" &&
    (totalContributedCallResult.error as any)?.message?.includes(
      "returned no data"
    ) &&
    totalContributed === undefined
  ) {
    errorMessagesToDisplay.push(
      ensureString(
        totalContributedCallResult.error,
        "Failed to get total contributed."
      )
    );
  }

  const combinedDisplayError =
    errorMessagesToDisplay.length > 0
      ? errorMessagesToDisplay.join("; ")
      : "Unknown error loading presale data.";

  if (
    isDetailsError ||
    presaleDetailsResults?.some(
      (r) =>
        r.status === "failure" &&
        !(
          r === totalContributedCallResult &&
          (r.error as any)?.message?.includes("returned no data") &&
          totalContributed !== undefined
        )
    )
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium text-destructive">
            Error Loading Presale Data
          </CardTitle>
          <CardDescription className="text-xs font-mono break-all pt-1">
            {ensureString(presaleAddress)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {combinedDisplayError}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xs text-orange-500">
            Access Denied (Not Owner)
          </CardTitle>
          <CardDescription className="text-xs font-mono break-all pt-1">
            {ensureString(presaleAddress)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs">You are not the owner of this presale.</p>
        </CardContent>
      </Card>
    );
  }

  const calculateFee = (gas: bigint | undefined) =>
    gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;

  const handleCreatorAction = async (
    functionName: string,
    args: any[] = [],
    actionName: string
  ) => {
    if (!isOwner) {
      toast.error("Unauthorized", {
        description: "You are not the owner of this presale.",
      });
      return;
    }
    setActionError("");
    try {
      await writeContractAsync({
        abi: presaleAbi,
        address: presaleAddress,
        functionName: functionName,
        args: args,
      });
    } catch (err: any) {
      const originalErrorMessage = err.shortMessage || err.message;
      const detailedErrorText = ensureString(
        originalErrorMessage,
        `An unknown error occurred during ${actionName}.`
      );

      if (
        functionName === "finalize" &&
        ((typeof originalErrorMessage === "string" &&
          (originalErrorMessage.includes("User denied transaction signature") ||
            originalErrorMessage.includes("User rejected the request"))) ||
          err.code === 4001 ||
          (err.cause &&
            typeof err.cause === "object" &&
            (err.cause as any).code === 4001))
      ) {
        toast.error("User cancel the finalize");
        setActionError("User cancel the finalize");
      } else if (
        functionName === "refund" &&
        ((typeof originalErrorMessage === "string" &&
          (originalErrorMessage.includes("User denied transaction signature") ||
            originalErrorMessage.includes("User rejected the request"))) ||
          err.code === 4001 ||
          (err.cause &&
            typeof err.cause === "object" &&
            (err.cause as any).code === 4001))
      ) {
        toast.error("user reject refund");
        setActionError("user reject refund");
      } else {
        toast.error(`${actionName} Failed`, { description: detailedErrorText });
        setActionError(detailedErrorText);
      }
      console.error(`${actionName} error details:`, err);
    }
  };

  const formatCurrencyDisplay = (
    value: bigint | undefined,
    decimals: number | undefined,
    symbol: string
  ): string => {
    if (value === undefined) return "N/A";
    if (decimals !== undefined) {
      return `${formatUnits(value, decimals)} ${symbol}`;
    }
    if (symbol !== "ETH" && value === 0n) return `0 ${symbol}`;
    if (symbol !== "ETH")
      return `${ensureString(value)} raw units (${symbol} details pending)`;
    return `${ensureString(value)} raw units`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base font-medium">
            <Badge variant={presaleStatus.variant} className="mr-2">
              {ensureString(presaleStatus.text, "Status N/A")}
            </Badge>
            {presaleTokenSymbol ? `${presaleTokenSymbol} Presale` : "Presale"}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetchDetails()}
            disabled={
              isWritePending ||
              isConfirming ||
              isLoadingDetails ||
              isLoadingAdditionalData
            }
            className="h-6 w-6 self-end sm:self-center"
          >
            <RefreshCw
              className={`h-3 w-3 ${
                isWritePending ||
                isConfirming ||
                isLoadingDetails ||
                isLoadingAdditionalData
                  ? "animate-spin"
                  : ""
              }`}
            />
          </Button>
        </div>
        <CardDescription className="text-xs font-mono break-all pt-1">
          {ensureString(presaleAddress)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border">
          <div>
            <p className="font-medium text-foreground">Soft Cap:</p>
            <p>
              {formatCurrencyDisplay(
                softCap,
                paymentDecimalsToUse,
                paymentSymbolToUse
              )}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Total Raised:</p>
            <p>
              {formatCurrencyDisplay(
                totalContributed,
                paymentDecimalsToUse,
                paymentSymbolToUse
              )}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Start Time:</p>
            <p>{formatTimestamp(startTime, "startTime")}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">End Time:</p>
            <p>{formatTimestamp(endTime, "endTime")}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCreatorAction("finalize", [], "Finalize")}
            disabled={!canFinalize || isWritePending || isConfirming}
          >
            Finalize <EstimatedFeeDisplay fee={calculateFee(finalizeGas)} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCreatorAction("cancel", [], "Cancel")}
            disabled={!canCancel || isWritePending || isConfirming}
          >
            Cancel <EstimatedFeeDisplay fee={calculateFee(cancelGas)} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCreatorAction("withdraw", [], "Withdraw")}
            disabled={!canWithdraw || isWritePending || isConfirming}
          >
            Withdraw <EstimatedFeeDisplay fee={calculateFee(withdrawGas)} />
          </Button>
          {canWithdraw && ownerBalance !== undefined && ownerBalance > 0n && (
            <p className="text-xs text-muted-foreground self-center ml-2">
              Withdrawable:{" "}
              {formatCurrencyDisplay(
                ownerBalance,
                paymentDecimalsToUse,
                paymentSymbolToUse
              )}
            </p>
          )}
          {paused ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreatorAction("unpause", [], "Unpause")}
              disabled={!canPauseUnpause || isWritePending || isConfirming}
            >
              Unpause <EstimatedFeeDisplay fee={calculateFee(unpauseGas)} />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCreatorAction("pause", [], "Pause")}
              disabled={!canPauseUnpause || isWritePending || isConfirming}
            >
              Pause <EstimatedFeeDisplay fee={calculateFee(pauseGas)} />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleCreatorAction(
                "toggleWhitelist",
                [!(whitelistEnabled ?? false)],
                whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist"
              )
            }
            disabled={!canToggleWhitelist || isWritePending || isConfirming}
          >
            {whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist"}{" "}
            <EstimatedFeeDisplay fee={calculateFee(toggleWhitelistGas)} />
          </Button>

        </div>
        {actionError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{ensureString(actionError)}</AlertDescription>
          </Alert>
        )}
        {(isWritePending || isConfirming) && (
          <Alert variant="default" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isConfirming
                ? "Confirming transaction..."
                : "Processing action..."}{" "}
              Tx: {shortenAddress(hash || undefined)}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default CreatorPresaleCard;
