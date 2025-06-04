import {
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import {
  type Address,
  formatUnits,
  isHex,
  zeroAddress,
  erc20Abi,
  Abi,
} from "viem";
import PresaleJson from "@/abis/Presale.json";
import { ensureString, shortenAddress, formatTimestamp } from "./utils.ts";
import { getPresaleStatus, type PresaleStatusReturn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const presaleAbi = PresaleJson.abi as Abi;

interface ContributedPresaleCardProps {
  presaleAddress: Address;
  userAddress: Address;
  refetchContributedPresalesList: () => void;
}

const ContributedPresaleCard: React.FC<ContributedPresaleCardProps> = ({
  presaleAddress,
  userAddress,
  refetchContributedPresalesList,
}) => {
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
  const [actionError, setActionError] = useState<string>("");

  const presaleContract = { address: presaleAddress, abi: presaleAbi } as const;

  const {
    data: presaleInfo,
    isLoading: isLoadingPresaleInfo,
    refetch: refetchPresaleInfo,
    isError: isErrorInfoGeneralHook,
    error: errorInfoGeneralHook,
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      { ...presaleContract, functionName: "options" },
      { ...presaleContract, functionName: "state" },
      {
        ...presaleContract,
        functionName: "contributions",
        args: [userAddress as Address],
      },
      {
        ...presaleContract,
        functionName: "userClaimedAmount",
        args: [userAddress as Address],
      },
      { ...presaleContract, functionName: "getTotalContributed" },
      { ...presaleContract, functionName: "token" },
    ],
    query: { enabled: !!userAddress && !!presaleAddress },
  });

  const optionsResult = presaleInfo?.[0];
  const stateResult = presaleInfo?.[1];
  const userContributionResult = presaleInfo?.[2];
  const userClaimedAmountResult = presaleInfo?.[3];
  const totalContributedResult = presaleInfo?.[4];
  const tokenAddressCallResultContributed = presaleInfo?.[5];

  const options =
    optionsResult?.status === "success"
      ? (optionsResult.result as any[])
      : undefined;
  const state =
    stateResult?.status === "success"
      ? (stateResult.result as number)
      : undefined;

  let userContributionRaw: bigint | undefined = undefined;
  if (userContributionResult?.status === "success") {
    if (
      userContributionResult.result === null ||
      (isHex(userContributionResult.result) &&
        userContributionResult.result === "0x")
    ) {
      userContributionRaw = 0n;
    } else {
      userContributionRaw = userContributionResult.result as bigint;
    }
  }

  let userClaimedAmountRaw: bigint | undefined = undefined;
  if (userClaimedAmountResult?.status === "success") {
    if (
      userClaimedAmountResult.result === null ||
      (isHex(userClaimedAmountResult.result) &&
        userClaimedAmountResult.result === "0x")
    ) {
      userClaimedAmountRaw = 0n;
    } else {
      userClaimedAmountRaw = userClaimedAmountResult.result as bigint;
    }
  }

  let totalPresaleContributed: bigint | undefined = undefined;
  if (totalContributedResult?.status === "success") {
    if (
      totalContributedResult.result === null ||
      (isHex(totalContributedResult.result) &&
        totalContributedResult.result === "0x")
    ) {
      totalPresaleContributed = 0n;
    } else {
      totalPresaleContributed = totalContributedResult.result as bigint;
    }
  }

  const presaleTokenAddressContributed =
    tokenAddressCallResultContributed?.status === "success"
      ? (tokenAddressCallResultContributed.result as Address)
      : undefined;
  const paymentCurrencyAddress = options?.[15] as Address | undefined;
  const isNativePaymentContribution = paymentCurrencyAddress === zeroAddress;

  const softCap = options?.[2] as bigint | undefined;
  const startTime = options?.[9] as bigint | undefined;
  const endTime = options?.[10] as bigint | undefined;

  const { data: presaleTokenDetails, isLoading: isLoadingPresaleTokenDetails } =
    useReadContracts({
      allowFailure: true,
      contracts: [
        {
          address: presaleTokenAddressContributed,
          abi: erc20Abi,
          functionName: "decimals",
        },
        {
          address: presaleTokenAddressContributed,
          abi: erc20Abi,
          functionName: "symbol",
        },
      ],
    });
  const presaleTokenDecimals =
    presaleTokenDetails?.[0]?.status === "success"
      ? (presaleTokenDetails[0].result as number)
      : undefined;
  const presaleTokenSymbol =
    presaleTokenDetails?.[1]?.status === "success"
      ? (presaleTokenDetails[1].result as string)
      : undefined;

  const {
    data: paymentCurrencyDetails,
    isLoading: isLoadingPaymentCurrencyDetails,
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: paymentCurrencyAddress,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address: paymentCurrencyAddress,
        abi: erc20Abi,
        functionName: "symbol",
      },
    ],
  });

  const paymentDecimalsForDisplay = isNativePaymentContribution
    ? 18
    : paymentCurrencyDetails?.[0]?.status === "success"
    ? (paymentCurrencyDetails[0].result as number)
    : undefined;
  const paymentSymbolForDisplay = isNativePaymentContribution
    ? "ETH"
    : (paymentCurrencyDetails?.[1]?.status === "success"
        ? (paymentCurrencyDetails[1].result as string)
        : undefined) ??
      (paymentDecimalsForDisplay !== undefined ? "Tokens" : "raw units");

  const presaleStatus: PresaleStatusReturn =
    options !== undefined && state !== undefined
      ? getPresaleStatus(state, options)
      : { text: "Loading...", variant: "default" };

  const canClaim =
    state === 3 &&
    userContributionRaw !== undefined &&
    userContributionRaw > 0n &&
    (userClaimedAmountRaw !== undefined
      ? userClaimedAmountRaw < userContributionRaw
      : true);

  const canRefund =
    state === 2 &&
    userContributionRaw !== undefined &&
    userContributionRaw > 0n &&
    (userClaimedAmountRaw !== undefined ? userClaimedAmountRaw === 0n : true);

  useEffect(() => {
    if (isConfirmed && receipt) {
      toast.success("Action Confirmed!", {
        description: `Tx: ${ensureString(receipt.transactionHash)}`,
      });
      setActionError("");
      refetchPresaleInfo();
      refetchContributedPresalesList();
      resetWriteContract();
    }
  }, [
    isConfirmed,
    receipt,
    refetchPresaleInfo,
    refetchContributedPresalesList,
    resetWriteContract,
  ]);

  const handleUserAction = async (
    functionName: "claim" | "refund",
    actionName: string
  ) => {
    setActionError("");
    try {
      await writeContractAsync({
        abi: presaleAbi,
        address: presaleAddress,
        functionName: functionName,
        args: [],
      });
    } catch (err: any) {
      const msg = ensureString(err, `${actionName} failed.`);
      setActionError(msg);
      toast.error(`${actionName} Failed`, { description: msg });
    }
  };

  const isLoadingAdditionalData =
    isLoadingPresaleTokenDetails || isLoadingPaymentCurrencyDetails;

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

  if (isLoadingPresaleInfo || isLoadingAdditionalData) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  let errorMessages: string[] = [];
  if (errorInfoGeneralHook)
    errorMessages.push(
      ensureString(errorInfoGeneralHook, "General presale info hook error.")
    );
  presaleInfo?.forEach((result) => {
    if (result?.status === "failure" && result.error) {
      if (
        !(
          result === userClaimedAmountResult &&
          (result.error as any)?.message?.includes("returned no data")
        ) &&
        !(
          result === totalContributedResult &&
          (result.error as any)?.message?.includes("returned no data")
        )
      ) {
        errorMessages.push(
          ensureString(result.error, "A contract call in presaleInfo failed.")
        );
      }
    }
  });
  const combinedErrorMessage =
    errorMessages.length > 0
      ? errorMessages.join("; ")
      : "Could not load necessary information.";
  const hasReadError =
    isErrorInfoGeneralHook ||
    presaleInfo?.some(
      (r) =>
        r.status === "failure" &&
        !(
          r === userClaimedAmountResult &&
          (r.error as any)?.message?.includes("returned no data")
        ) &&
        !(
          r === totalContributedResult &&
          (r.error as any)?.message?.includes("returned no data")
        )
    );

  if (hasReadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-destructive">
            Error loading details for {shortenAddress(presaleAddress)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {combinedErrorMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  let contributionDisplay = "N/A";
  if (userContributionRaw !== undefined) {
    if (isNativePaymentContribution) {
      contributionDisplay = `${formatUnits(userContributionRaw, 18)} ETH`;
    } else if (paymentDecimalsForDisplay !== undefined) {
      contributionDisplay = `${formatUnits(
        userContributionRaw,
        paymentDecimalsForDisplay
      )} ${paymentSymbolForDisplay}`;
    } else {
      contributionDisplay = `${ensureString(
        userContributionRaw
      )} raw units (payment token details pending)`;
    }
  }

  let claimedDisplay = "N/A";
  if (userClaimedAmountRaw !== undefined) {
    if (presaleTokenDecimals !== undefined) {
      claimedDisplay = `${formatUnits(
        userClaimedAmountRaw,
        presaleTokenDecimals
      )} ${presaleTokenSymbol || "Tokens"}`;
    } else if (userClaimedAmountRaw === 0n) {
      claimedDisplay = `0 ${presaleTokenSymbol || "Tokens"} (details pending)`;
    } else {
      claimedDisplay = `${ensureString(userClaimedAmountRaw)} raw units (${
        presaleTokenSymbol || "Token"
      } details pending)`;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
          <CardTitle className="text-sm font-medium">
            {presaleTokenSymbol ? `${presaleTokenSymbol} Presale` : "Presale"}:{" "}
            {shortenAddress(presaleAddress)}
          </CardTitle>
          <Badge
            variant={presaleStatus.variant}
            className="text-xs self-start sm:self-center"
          >
            {ensureString(presaleStatus.text, "Status N/A")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Your Contribution: {contributionDisplay}
        </p>
        <p className="text-xs text-muted-foreground">
          Claimed: {claimedDisplay}
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border">
          <div>
            <p className="font-medium text-foreground">Soft Cap:</p>
            <p>
              {formatCurrencyDisplay(
                softCap,
                paymentDecimalsForDisplay,
                paymentSymbolForDisplay
              )}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Total Raised:</p>
            <p>
              {formatCurrencyDisplay(
                totalPresaleContributed,
                paymentDecimalsForDisplay,
                paymentSymbolForDisplay
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
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            size="sm"
            onClick={() => handleUserAction("claim", "Claim")}
            disabled={!canClaim || isWritePending || isConfirming}
          >
            Claim
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUserAction("refund", "Refund")}
            disabled={!canRefund || isWritePending || isConfirming}
          >
            Refund
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
            <Info className="h-4 w-4" />
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

export default ContributedPresaleCard;
