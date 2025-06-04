import { useParams, Link } from "react-router-dom";
import {
  useAccount,
  useReadContracts,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
  useFeeData,
} from "wagmi";
import PresaleJson from "@/abis/Presale.json";
import { type Abi, erc20Abi } from "viem";
import {
  formatUnits,
  parseUnits,
  zeroAddress,
  bytesToHex,
  isBytes,
  formatEther,
  type Address,
  encodeFunctionData,
} from "viem";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import { getPresaleStatus, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  RefreshCw,
  Fuel,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Users,
  Wallet,
  Share, // Added Share icon
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { sdk } from "@farcaster/frame-sdk"; // Added Farcaster SDK import

const presaleAbi = PresaleJson.abi as Abi;

// Custom theme colors
const themeColors = {
  primary: "#134942",
  white: "#FFFFFF",
  lightTeal: "#ecf5f3",
  midTeal: "#79ada4",
  darkText: "#172135",
  mutedText: "#646e83",
  borderColor: "#e3e8ef",
  warningBg: "#fff8e9",
  successBg: "#eefbf2",
  errorBg: "#feeeee",
};

// Helper to parse Merkle proof input
const parseMerkleProof = (input: string): `0x${string}`[] => {
  try {
    const proofArray = JSON.parse(input);
    if (
      Array.isArray(proofArray) &&
      proofArray.every(
        (item) => typeof item === "string" && item.startsWith("0x")
      )
    ) {
      return proofArray as `0x${string}`[];
    }
  } catch (e) {}
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) =>
      s.startsWith("0x") ? (s as `0x${string}`) : (`0x${s}` as `0x${string}`)
    )
    .filter((s) => isBytes(s));
};

// Helper to format lockup duration from seconds to days
const formatLockupDuration = (seconds: bigint | undefined): string => {
  if (seconds === undefined || seconds === 0n) return "0 days";
  const days = Number(seconds) / (60 * 60 * 24);
  return `${days.toFixed(0)} days`;
};

// Helper to format liquidity BPS to percentage
const formatLiquidityBps = (bps: bigint | undefined): string => {
  if (bps === undefined) return "N/A";
  const percentage = Number(bps) / 100;
  return `${percentage.toFixed(2)}%`;
};

// Helper to interpret leftover token option
const getLeftoverTokenDestination = (option: bigint | undefined): string => {
  if (option === undefined) return "N/A";
  switch (option) {
    case 0n: // Assuming 0 is Refund based on common patterns
      return "Burn";
    case 1n: // Assuming 1 is Burn
      return "Refund to Creator";
    case 2n: // Assuming 2 is Vest or similar
      return "Sent to vesting contract"; // This might need adjustment based on actual contract logic
    default:
      return "Undefined option";
  }
};

// Styled Skeleton Component for Detail Page
const PresaleDetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <Card className="bg-background border border-primary-100/20 shadow-card rounded-xl">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full bg-primary-100/50" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 bg-primary-100/50" />
              <Skeleton className="h-4 w-full bg-primary-100/50" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 bg-primary-100/50 rounded-full" />
        </div>
      </div>
      <CardContent className="space-y-6 p-6">
        <div>
          <Skeleton className="h-4 w-full bg-primary-100/50" />
          <Skeleton className="h-3 w-1/2 mx-auto mt-2 bg-primary-100/50" />
          <Skeleton className="h-3 w-1/3 mx-auto mt-2 bg-primary-100/50" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-6 border-t border-primary-100/20">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-full bg-primary-100/50" />
          ))}
        </div>
        <div className="pt-6 border-t border-primary-100/20">
          <Skeleton className="h-6 w-1/3 mb-2 bg-primary-100/50" />
          <Skeleton className="h-4 w-full bg-primary-100/50" />
          <Skeleton className="h-4 w-2/3 mt-2 bg-primary-100/50" />
        </div>
        <div className="pt-6 border-t border-primary-100/20">
          <Skeleton className="h-6 w-1/3 mb-4 bg-primary-100/50" />
          <Skeleton className="h-10 w-full bg-primary-100/50 rounded-md" />
        </div>
      </CardContent>
    </Card>
  </div>
);

// Styled helper to display estimated fee
export const EstimatedFeeDisplay = ({
  fee,
  label,
}: {
  fee: bigint | undefined;
  label?: string;
}) => {
  if (fee === undefined || fee === 0n) return null;
  return (
    <span className="text-xs text-muted-foreground ml-2 flex items-center">
      {label && <span className="mr-1">{label}:</span>}
      <Fuel className="h-3 w-3 mr-1 text-primary-700" />~{formatEther(fee)} ETH
    </span>
  );
};

interface PresaleStatus {
  text: string;
  variant:
    | "default"
    | "success"
    | "error"
    | "warning"
    | "primary"
    | "destructive";
}

// Custom badge styles based on theme
const StyledBadge = ({
  variant,
  children,
  className,
}: {
  variant: PresaleStatus["variant"];
  children: React.ReactNode;
  className?: string;
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "default":
        return "bg-primary-50 text-primary-900 border-primary-200 hover:bg-primary-100";
      case "success":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200";
      case "primary":
        return `bg-[${themeColors.lightTeal}] text-[${themeColors.primary}] border-[${themeColors.primary}]/20 hover:bg-[${themeColors.midTeal}] hover:text-white`;
      case "destructive":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      default:
        return "bg-primary-50 text-primary-900 border-primary-200 hover:bg-primary-100";
    }
  };

  return (
    <span
      className={cn(
        `inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border ${getVariantStyles()} transition-all duration-200 group-hover:scale-105`,
        className
      )}
    >
      {children}
    </span>
  );
};

const PresaleDetailPage = () => {
  const { address: presaleAddressParam } = useParams<{ address: string }>();
  const presaleAddress = presaleAddressParam as Address | undefined;
  const { address: userAddress, isConnected } = useAccount();
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

  const [contributionAmount, setContributionAmount] = useState("");
  const [merkleProofInput, setMerkleProofInput] = useState("");
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [logoError, setLogoError] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  const presaleContractConfig = {
    address: presaleAddress,
    abi: presaleAbi,
  } as const;

  // --- Data Fetching ---
  const contractsToRead = useMemo(() => {
    if (!presaleAddress) return [];
    const baseContracts: any[] = [
      { ...presaleContractConfig, functionName: "options" },
      { ...presaleContractConfig, functionName: "state" },
      { ...presaleContractConfig, functionName: "token" },
      { ...presaleContractConfig, functionName: "getTotalContributed" },
      { ...presaleContractConfig, functionName: "paused" },
      { ...presaleContractConfig, functionName: "getContributorCount" },
      { ...presaleContractConfig, functionName: "claimDeadline" },
      { ...presaleContractConfig, functionName: "whitelistEnabled" },
      { ...presaleContractConfig, functionName: "merkleRoot" },
      { ...presaleContractConfig, functionName: "vestingOptions" },
    ];
    if (userAddress) {
      baseContracts.push({
        ...presaleContractConfig,
        functionName: "contributions",
        args: [userAddress],
      });
      baseContracts.push({
        ...presaleContractConfig,
        functionName: "claimableTokens",
        args: [userAddress],
      });
      // Fetch userClaimedAmount to potentially refine claim/refund logic if needed
      baseContracts.push({
        ...presaleContractConfig,
        functionName: "userClaimedAmount",
        args: [userAddress],
      });
    }
    return baseContracts;
  }, [presaleAddress, userAddress]);

  const {
    data: presaleData,
    isLoading: isLoadingPresale,
    refetch: refetchPresaleData,
    isRefetching,
  } = useReadContracts({
    allowFailure: true,
    contracts: contractsToRead,
    query: { enabled: !!presaleAddress, refetchInterval: 30000 },
  });

  const [
    options,
    stateResult,
    tokenAddressResult,
    totalContributed,
    paused,
    contributorCount,
    claimDeadline,
    whitelistEnabled,
    merkleRoot,
    vestingOptions,
    userContribution,
    userClaimableTokens,
    userClaimedAmount, // Added userClaimedAmount
  ] = useMemo(() => {
    return (
      presaleData?.map((d) => d.result) ??
      Array(contractsToRead.length).fill(undefined)
    );
  }, [presaleData, contractsToRead.length]);

  const tokenAddress = tokenAddressResult as Address | undefined;
  const state = stateResult as number | undefined;
  const isVestingEnabled = (vestingOptions as any)?.enabled;

  const { data: tokenSymbol, isLoading: isLoadingTokenSymbol } =
    useReadContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "symbol",
      query: { enabled: !!tokenAddress },
    });

  const currencyAddress = options?.[15] as Address | undefined;
  const currencyIsEth = currencyAddress === zeroAddress;

  const { data: currencySymbol, isLoading: isLoadingCurrencySymbol } =
    useReadContract({
      address: currencyAddress,
      abi: erc20Abi,
      functionName: "symbol",
      query: { enabled: !!currencyAddress && !currencyIsEth },
    });

  const { data: currencyDecimalsResult, isLoading: isLoadingCurrencyDecimals } =
    useReadContract({
      address: currencyAddress,
      abi: erc20Abi,
      functionName: "decimals",
      query: { enabled: !!currencyAddress && !currencyIsEth },
    });
  const currencyDecimals = (currencyDecimalsResult as number | undefined) ?? 18;

  const {
    data: allowanceResult,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: currencyAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [userAddress!, presaleAddress!],
    query: { enabled: !!userAddress && !!presaleAddress && !currencyIsEth },
  });
  const allowance = allowanceResult as bigint | undefined;

  // --- Derived State & Calculations ---
  const presaleStatus = getPresaleStatus(state, options) as PresaleStatus;
  const hardCap = options?.[1] as bigint | undefined;
  const softCap = options?.[2] as bigint | undefined;
  const minContrib = options?.[3] as bigint | undefined;
  const maxContrib = options?.[4] as bigint | undefined;
  const presaleRate = options?.[5] as bigint | undefined;
  const startTime = options?.[9] as bigint | undefined;
  const endTime = options?.[10] as bigint | undefined;
  const liquidityBps = options?.[7] as bigint | undefined;
  const lockupDurationSeconds = options?.[11] as bigint | undefined;
  const leftoverTokenOption = options?.[14] as bigint | undefined;
  const progress =
    hardCap && totalContributed && hardCap > 0n
      ? Number(((totalContributed as bigint) * 10000n) / (hardCap as bigint)) /
        100
      : 0;
  const totalContributedFormatted =
    totalContributed !== undefined
      ? formatUnits(totalContributed as bigint, currencyDecimals)
      : "0";
  const hardCapFormatted =
    hardCap !== undefined ? formatUnits(hardCap, currencyDecimals) : "N/A";
  const softCapFormatted =
    softCap !== undefined ? formatUnits(softCap, currencyDecimals) : "N/A";
  const minContribFormatted =
    minContrib !== undefined
      ? formatUnits(minContrib, currencyDecimals)
      : "N/A";
  const maxContribFormatted =
    maxContrib !== undefined
      ? formatUnits(maxContrib, currencyDecimals)
      : "N/A";
  const userContributionFormatted =
    userContribution !== undefined
      ? formatUnits(userContribution as bigint, currencyDecimals)
      : "0";
  const userClaimableTokensFormatted =
    userClaimableTokens !== undefined
      ? formatUnits(userClaimableTokens as bigint, 18) // Assuming presale token is 18 decimals
      : "0";
  const currencyDisplaySymbol = currencyIsEth
    ? "ETH"
    : currencySymbol ?? "Tokens";
  const merkleProof = useMemo(
    () => parseMerkleProof(merkleProofInput),
    [merkleProofInput]
  );
  const contributionAmountParsed = useMemo(() => {
    try {
      return parseUnits(contributionAmount || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [contributionAmount, currencyDecimals]);

  const logoUrl = tokenAddress
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png`
    : undefined;

  // --- Action Eligibility ---
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const canContribute =
    state === 1 &&
    !paused &&
    startTime !== undefined &&
    endTime !== undefined &&
    nowSeconds >= startTime &&
    nowSeconds <= endTime;
  const softCapMet =
    totalContributed !== undefined &&
    softCap !== undefined &&
    (totalContributed as bigint) >= softCap;

  // Determine if user has contributed
  const hasContributed = isConnected && userContribution !== undefined && (userContribution as bigint) > 0n;

  // Determine if user has already claimed/refunded (using userClaimedAmount)
  const hasAlreadyClaimedOrRefunded = userClaimedAmount !== undefined && (userClaimedAmount as bigint) > 0n;

  const canClaim =

    isConnected &&
    state === 3 && // Finalized (Success)

    hasContributed &&
    !hasAlreadyClaimedOrRefunded && // Check if already claimed
    state === 2 && // Finalized

    softCapMet &&
    claimDeadline !== undefined &&
    nowSeconds < (claimDeadline as bigint) &&
    userClaimableTokens !== undefined &&
    (userClaimableTokens as bigint) > 0n &&
    !paused;

  const canRefund =

    isConnected &&
    (state === 2 || // Canceled (Failed)
      (state === 1 &&
        endTime !== undefined &&
        nowSeconds > endTime &&
        !softCapMet)) &&
    userContribution !== undefined &&
    (userContribution as bigint) > 0n;

    hasContributed &&
    !hasAlreadyClaimedOrRefunded && // Check if already refunded (uses same variable)
    (state === 3 || // Canceled
      (state === 1 && // Active but ended
        endTime !== undefined &&
        nowSeconds > endTime &&
        !softCapMet)) && // Soft cap not met
    !paused;


  // --- Gas Estimation ---
  const { data: approveGas } = useEstimateGas({
    to: currencyAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [presaleAddress!, contributionAmountParsed],
    }),
    account: userAddress,
    query: {
      enabled:
        !currencyIsEth &&
        needsApproval &&
        !!userAddress &&
        !!presaleAddress &&
        contributionAmountParsed > 0n,
    },
  });
  const { data: contributeGas } = useEstimateGas({
    to: presaleContractConfig.address,
    data: encodeFunctionData({
      abi: presaleContractConfig.abi,
      functionName: currencyIsEth ? "contribute" : "contributeStablecoin",
      args: currencyIsEth
        ? [merkleProof]
        : [contributionAmountParsed, merkleProof],
    }),
    value: currencyIsEth ? contributionAmountParsed : 0n,
    account: userAddress,
    query: {
      enabled:
        canContribute &&
        !!userAddress &&
        contributionAmountParsed > 0n &&
        (!whitelistEnabled || merkleProof.length > 0),
    },
  });
  const { data: claimGas } = useEstimateGas({
    to: presaleContractConfig.address,
    data: encodeFunctionData({
      abi: presaleContractConfig.abi,
      functionName: "claim",
    }),
    account: userAddress,
    query: { enabled: canClaim && !!userAddress }, // Estimate only if actually clickable
  });
  const { data: refundGas } = useEstimateGas({
    to: presaleContractConfig.address,
    data: encodeFunctionData({
      abi: presaleContractConfig.abi,
      functionName: "refund",
    }),
    account: userAddress,
    query: { enabled: canRefund && !!userAddress }, // Estimate only if actually clickable
  });
  const calculateFee = (gas: bigint | undefined) =>
    gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;
  const approveFee = calculateFee(approveGas);
  const contributeFee = calculateFee(contributeGas);
  const claimFee = calculateFee(claimGas);
  const refundFee = calculateFee(refundGas);

  // --- Effect Hooks ---
  useEffect(() => {
    if (currencyIsEth || !contributionAmount || !allowance) {
      setNeedsApproval(false);
      return;
    }
    try {
      const required = parseUnits(contributionAmount, currencyDecimals);
      setNeedsApproval(allowance < required);
    } catch {
      setNeedsApproval(true);
    }
  }, [currencyIsEth, contributionAmount, allowance, currencyDecimals]);

  useEffect(() => {
    if (isConfirmed && receipt) {
      toast.success(
        `${
          currentAction?.charAt(0).toUpperCase() + currentAction!.slice(1)
        } Successful!`,
        {
          description: `Tx: ${receipt.transactionHash}`,
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        }
      );
      setActionError("");
      refetchPresaleData();
      if (currentAction === "approve" && !currencyIsEth) refetchAllowance();
      if (currentAction === "contribute") setContributionAmount("");
      setCurrentAction(null);
      resetWriteContract();
    }
  }, [
    isConfirmed,
    receipt,
    refetchPresaleData,
    refetchAllowance,
    currencyIsEth,
    currentAction,
    resetWriteContract,
  ]);

  // --- Action Handlers ---
  const handleApprove = async () => {
    if (
      !presaleAddress ||
      !contributionAmountParsed ||
      contributionAmountParsed <= 0n ||
      !currencyAddress
    )
      return;
    setActionError("");
    setIsApproving(true);
    setCurrentAction("approve");
    try {
      await writeContractAsync({
        address: currencyAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [presaleAddress, contributionAmountParsed],
      });
    } catch (err: any) {
      const errorMsg = err.shortMessage || err.message || "Approval failed.";
      setActionError(errorMsg);
      toast.error("Approval Failed", {
        description: errorMsg,
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      });
      setCurrentAction(null);
    } finally {
      setIsApproving(false);
    }
  };

  const handleContribute = async () => {
    if (
      !contributionAmountParsed ||
      contributionAmountParsed <= 0n ||
      !presaleContractConfig.address
    )
      return;
    if (
      whitelistEnabled &&
      merkleProof.length === 0 &&
      merkleRoot &&
      merkleRoot !== bytesToHex(new Uint8Array(32).fill(0))
    ) {
      const errorMsg = "Merkle proof is required for this whitelisted presale.";
      setActionError(errorMsg);
      toast.error("Merkle Proof Required", {
        description: errorMsg,
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      });
      return;
    }
    setActionError("");
    setCurrentAction("contribute");
    try {
      await writeContractAsync({
        address: presaleContractConfig.address,
        abi: presaleContractConfig.abi,
        functionName: currencyIsEth ? "contribute" : "contributeStablecoin",
        args: currencyIsEth
          ? [merkleProof]
          : [contributionAmountParsed, merkleProof],
        value: currencyIsEth ? contributionAmountParsed : 0n,
      });
    } catch (err: any) {
      const errorMsg =
        err.shortMessage || err.message || "Contribution failed.";
      setActionError(errorMsg);
      toast.error("Contribution Failed", {
        description: errorMsg,
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      });
      setCurrentAction(null);
    }
  };

  const handleClaimOrRefund = async (actionType: "claim" | "refund") => {
    if (!presaleContractConfig.address) return;
    setActionError("");
    setCurrentAction(actionType);
    try {
      await writeContractAsync({
        address: presaleContractConfig.address,
        abi: presaleContractConfig.abi,
        functionName: actionType,
      });
    } catch (err: any) {
      const errorMsg =
        err.shortMessage ||
        err.message ||
        `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} failed.`;
      setActionError(errorMsg);
      toast.error(
        `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Failed`,
        {
          description: errorMsg,
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        }
      );
      setCurrentAction(null);
    }
  };

  // --- Farcaster Share Handler ---
  const handleSharePresale = async () => {
    if (!presaleAddress || !tokenSymbol) {
      toast.error("Cannot share: Presale details missing.");
      return;
    }
    // Use window.location.href for the current page URL
    const shareUrl = window.location.href;
    const shareText = `Check out the ${
      tokenSymbol || "token"
    } presale!\nJoin here:`;

    try {
      await sdk.actions.composeCast({ text: shareText, embeds: [shareUrl] });
      console.log(
        "Farcaster composer opened for sharing:",
        shareText,
        shareUrl
      );
    } catch (error) {
      console.error("Failed to compose cast for sharing presale:", error);
      toast.error("Could not open Farcaster composer to share.");
    }
  };

  if (isLoadingPresale && !presaleData) return <PresaleDetailSkeleton />;
  if (!presaleAddress || !options)
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-foreground text-lg font-medium">
          Presale not found or invalid address.
        </p>
        <Link to="/presales">
          <Button
            variant="outline"
            className="mt-4 border-primary-200 text-primary-900 hover:bg-primary-50 hover:text-primary-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Presales
          </Button>
        </Link>
      </div>
    );

  const isPageLoading =
    isLoadingPresale ||
    isLoadingTokenSymbol ||
    isLoadingCurrencySymbol ||
    isLoadingCurrencyDecimals ||
    isLoadingAllowance ||
    isRefetching;
  const isActionInProgress = isWritePending || isConfirming || isApproving;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-4xl">
      <div className="animate-fade-in">
        <Link to="/presales">
          <Button
            variant="outline"
            className="border-primary-200 text-primary-900 hover:bg-primary-50 hover:text-primary-800 transition-all duration-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Presales
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden border-0 shadow-card rounded-xl bg-background/95 backdrop-blur-sm animate-slide-up">
        <div className="bg-gradient-to-r from-primary-900 to-primary-800 text-white p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {logoUrl && !logoError ? (
                <Avatar className="h-16 w-16 ring-4 ring-white/20 group-hover:scale-105 transition-transform duration-300">
                  <AvatarImage
                    src={logoUrl}
                    alt={tokenSymbol || "Token Logo"}
                    onError={() => setLogoError(true)}
                  />
                  <AvatarFallback className="bg-primary-100 text-primary-900 font-bold text-xl">
                    {getInitials(tokenSymbol || "T")}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-16 w-16 ring-4 ring-white/20 group-hover:scale-105 transition-transform duration-300">
                  <AvatarFallback className="bg-primary-100 text-primary-900 font-bold text-xl">
                    {getInitials(tokenSymbol || "T")}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <h1 className="text-2xl font-heading font-semibold flex items-center">
                  {tokenSymbol || "Presale Token"} Presale
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refetchPresaleData()}
                    disabled={isPageLoading || isActionInProgress}
                    className="ml-2 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        isPageLoading ? "animate-spin" : ""
                      }`}
                    />
                  </Button>
                  {/* Added Share Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSharePresale}
                    disabled={isActionInProgress} // Disable during other actions
                    className="ml-1 text-white/80 hover:text-white hover:bg-white/10"
                    title="Share on Farcaster"
                  >
                    <Share className="h-4 w-4" />
                  </Button>
                </h1>
                <div className="flex items-center mt-2 gap-3">
                  <span className="flex items-center text-sm">
                    <span className="mr-1 text-white/80">Status:</span>
                    <StyledBadge variant={presaleStatus.variant || "default"}>
                      {presaleStatus.text}
                    </StyledBadge>
                  </span>
                  {paused && (
                    <StyledBadge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> PAUSED
                    </StyledBadge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2 text-white/90">
              <span>
                Raised: {totalContributedFormatted} {currencyDisplaySymbol}
              </span>
              <span>{progress.toFixed(2)}%</span>
            </div>
            <Progress
              value={progress}
              className={cn(
                "w-full h-3 rounded-full",
                progress >= 90
                  ? "bg-green-100"
                  : progress >= 50
                  ? "bg-primary-100"
                  : "bg-primary-50"
              )}
            />
            <div className="flex justify-between text-xs text-white/70 mt-2">
              <span>
                Soft Cap: {softCapFormatted} {currencyDisplaySymbol}
              </span>
              <span>
                Hard Cap: {hardCapFormatted} {currencyDisplaySymbol}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-8 bg-background">
          {/* Contribution Section */}
          {canContribute && (
            <div className="pt-6 border-t border-primary-100/20">
              <h3 className="text-lg font-heading font-semibold mb-4 text-foreground">
                Contribute to Presale
              </h3>
              <div className="space-y-4">
                <Input
                  type="number"
                  placeholder={`Amount in ${currencyDisplaySymbol}`}
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  disabled={isActionInProgress}
                  className="border-primary-200 focus:border-primary-500 focus:ring-primary-500"
                  min={
                    minContribFormatted !== "N/A" ? minContribFormatted : "0"
                  }
                  max={
                    maxContribFormatted !== "N/A"
                      ? maxContribFormatted
                      : undefined
                  }
                  step="any"
                />
                {whitelistEnabled &&
                  merkleRoot &&
                  merkleRoot !== bytesToHex(new Uint8Array(32).fill(0)) && (
                    <Textarea
                      placeholder="Enter your Merkle Proof (comma or newline separated 0x... hashes)"
                      value={merkleProofInput}
                      onChange={(e) => setMerkleProofInput(e.target.value)}
                      disabled={isActionInProgress}
                      rows={3}
                      className="border-primary-200 focus:border-primary-500 focus:ring-primary-500 font-mono text-xs"
                    />
                  )}
                <div className="flex flex-col sm:flex-row gap-2">
                  {!currencyIsEth && needsApproval && (
                    <Button
                      onClick={handleApprove}
                      disabled={isActionInProgress || !contributionAmountParsed}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-yellow-900 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {currentAction === "approve" && isActionInProgress ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve"
                      )}
                      <EstimatedFeeDisplay fee={approveFee} />
                    </Button>
                  )}
                  <Button
                    onClick={handleContribute}
                    disabled={
                      isActionInProgress ||
                      !contributionAmountParsed ||
                      (!currencyIsEth && needsApproval)
                    }
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {currentAction === "contribute" && isActionInProgress ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Contributing...
                      </>
                    ) : (
                      "Contribute"
                    )}
                    <EstimatedFeeDisplay fee={contributeFee} />
                  </Button>
                </div>

                {actionError && (
                  <Alert
                    variant="destructive"
                    className="bg-errorBg border-red-200"

                {actionError && currentAction === 'contribute' && (
                  <Alert
                    variant="destructive"
                    className="mt-4 bg-errorBg border-red-200"

                  >
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">Error</AlertTitle>
                    <AlertDescription className="text-red-700">
                      {actionError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {/* Claim/Refund Section - MODIFIED: Show if user has contributed */}
          {hasContributed && (
            <div className="pt-6 border-t border-primary-100/20">
              <h3 className="text-lg font-heading font-semibold mb-4 text-foreground">
                Actions
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">

                {canClaim && (
                  <Button
                    onClick={() => handleClaimOrRefund("claim")}
                    disabled={isActionInProgress}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {currentAction === "claim" && isActionInProgress ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      `Claim ${userClaimableTokensFormatted} ${
                        tokenSymbol || "Tokens"
                      }`
                    )}
                    <EstimatedFeeDisplay fee={claimFee} />
                  </Button>
                )}
                {canRefund && (
                  <Button
                    onClick={() => handleClaimOrRefund("refund")}
                    disabled={isActionInProgress}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {currentAction === "refund" && isActionInProgress ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Refunding...
                      </>
                    ) : (
                      `Refund ${userContributionFormatted} ${currencyDisplaySymbol}`
                    )}
                    <EstimatedFeeDisplay fee={refundFee} />
                  </Button>
                )}
              </div>
              {actionError && currentAction && (canClaim || canRefund) && (

                {/* Claim Button - Always show if contributed, disable based on canClaim */}
                <Button
                  onClick={() => handleClaimOrRefund("claim")}
                  disabled={isActionInProgress || !canClaim} // Updated disabled logic
                  className={cn(
                    "flex-1 bg-green-600 hover:bg-green-700 text-white transition-all duration-200 shadow-sm hover:shadow-md",
                    !canClaim && "opacity-50 cursor-not-allowed" // Add disabled style
                  )}
                >
                  {currentAction === "claim" && isActionInProgress ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    `Claim ${userClaimableTokensFormatted} ${
                      tokenSymbol || "Tokens"
                    }`
                  )}
                  <EstimatedFeeDisplay fee={claimFee} />
                </Button>

                {/* Refund Button - Always show if contributed, disable based on canRefund */}
                <Button
                  onClick={() => handleClaimOrRefund("refund")}
                  disabled={isActionInProgress || !canRefund} // Updated disabled logic
                  className={cn(
                    "flex-1 bg-red-600 hover:bg-red-700 text-white transition-all duration-200 shadow-sm hover:shadow-md",
                    !canRefund && "opacity-50 cursor-not-allowed" // Add disabled style
                  )}
                >
                  {currentAction === "refund" && isActionInProgress ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Refunding...
                    </>
                  ) : (
                    `Refund ${userContributionFormatted} ${currencyDisplaySymbol}`
                  )}
                  <EstimatedFeeDisplay fee={refundFee} />
                </Button>
              </div>
              {/* Keep the error alert logic, ensure it shows for relevant actions */}
              {actionError && currentAction && (currentAction === 'claim' || currentAction === 'refund') && (

                <Alert
                  variant="destructive"
                  className="mt-4 bg-errorBg border-red-200"
                >
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Error</AlertTitle>
                  <AlertDescription className="text-red-700">
                    {actionError}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}


          {/* User Info Section */}
          {isConnected &&
            userContribution !== undefined &&
            (userContribution as bigint) > 0n && (

          {/* User Info Section - Show if user has contributed */}
          {hasContributed && (

              <div className="pt-6 border-t border-primary-100/20">
                <h3 className="text-lg font-heading font-semibold mb-2 text-foreground">
                  Your Contribution
                </h3>
                <p className="text-sm text-muted-foreground">
                  You contributed:{" "}

                  <span className="font-semibold text-foreground">
                    {userContributionFormatted} {currencyDisplaySymbol}
                  </span>
                </p>
                {/* Optionally show claimable amount here too, even if button is disabled */}
                <p className="text-sm text-muted-foreground mt-1">
                  Claimable:{" "}

                  <span className="font-semibold text-foreground">
                    {userContributionFormatted} {currencyDisplaySymbol}
                  </span>
                </p>

                {canClaim && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Claimable:{" "}
                    <span className="font-semibold text-foreground">
                      {userClaimableTokensFormatted} {tokenSymbol || "Tokens"}
                    </span>
                  </p>

                {/* Optionally show if already claimed/refunded */}
                {hasAlreadyClaimedOrRefunded && (
                   <p className="text-sm text-yellow-600 mt-1">
                     (Already Claimed/Refunded)
                   </p>

                )}
              </div>
            )}

          {/* Presale Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-primary-100/20">
            <div className="bg-primary-50 rounded-lg p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="text-primary-900 font-medium mb-2 flex items-center">
                <Wallet className="h-4 w-4 mr-2" /> Token Economics
              </div>
              <div className="text-sm text-muted-foreground">
                Rate:{" "}
                <span className="font-semibold text-foreground">
                  1 {currencyDisplaySymbol} ={" "}
                  {presaleRate ? formatUnits(presaleRate, 0) : "N/A"}{" "}
                  {tokenSymbol || "Tokens"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Min:{" "}
                <span className="font-semibold text-foreground">
                  {minContribFormatted} {currencyDisplaySymbol}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Max:{" "}
                <span className="font-semibold text-foreground">
                  {maxContribFormatted} {currencyDisplaySymbol}
                </span>
              </div>
            </div>
            <div className="bg-primary-50 rounded-lg p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="text-primary-900 font-medium mb-2 flex items-center">
                <Calendar className="h-4 w-4 mr-2" /> Timeline
              </div>
              <div className="text-sm text-muted-foreground">
                Start:{" "}
                <span className="font-semibold text-foreground">
                  {startTime
                    ? new Date(Number(startTime) * 1000).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                End:{" "}
                <span className="font-semibold text-foreground">
                  {endTime
                    ? new Date(Number(endTime) * 1000).toLocaleString()
                    : "N/A"}
                </span>
              </div>
              {claimDeadline && (
                <div className="text-sm text-muted-foreground mt-1">
                  Claim Deadline:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(Number(claimDeadline) * 1000).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-primary-50 rounded-lg p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="text-primary-900 font-medium mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2" /> Participation
              </div>
              <div className="text-sm text-muted-foreground">
                Contributors:{" "}
                <span className="font-semibold text-foreground">
                  {contributorCount?.toString() ?? "N/A"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Whitelist:{" "}
                <span className="font-semibold text-foreground">
                  {whitelistEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {whitelistEnabled &&
                merkleRoot &&
                merkleRoot !== bytesToHex(new Uint8Array(32).fill(0)) && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Merkle Root:{" "}
                    <span className="font-mono text-xs text-foreground truncate block">
                      {merkleRoot}
                    </span>
                  </div>
                )}
            </div>
            {/* Liquidity & Unsold Tokens Section */}
            <div className="bg-primary-50 rounded-lg p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="text-primary-900 font-medium mb-2 flex items-center">
                <Lock className="h-4 w-4 mr-2 text-primary-700" /> Liquidity &
                Unsold
              </div>
              <div className="text-sm text-muted-foreground">
                Liquidity Percent:{" "}
                <span className="font-semibold text-foreground">
                  {liquidityBps !== undefined
                    ? formatLiquidityBps(liquidityBps)
                    : "N/A"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Lockup Duration:{" "}
                <span className="font-semibold text-foreground">
                  {lockupDurationSeconds !== undefined
                    ? formatLockupDuration(lockupDurationSeconds)
                    : "N/A"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Unsold Tokens:{" "}
                <span className="font-semibold text-foreground">
                  {leftoverTokenOption !== undefined
                    ? getLeftoverTokenDestination(leftoverTokenOption)
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {isVestingEnabled && (
            <div className="pt-6 border-t border-primary-100/20">
              <h3 className="text-lg font-heading font-semibold flex items-center text-foreground">
                <Lock className="h-5 w-5 mr-2 text-primary-700" /> Vesting
                Details
              </h3>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <p>
                  Initial Release:{" "}
                  <span className="font-semibold text-foreground">
                    {(vestingOptions as any)?.initialReleasePercentage / 100}%
                  </span>
                </p>
                <p>
                  Vesting Period:{" "}
                  <span className="font-semibold text-foreground">
                    {(vestingOptions as any)?.vestingPeriodSeconds
                      ? formatLockupDuration(
                          (vestingOptions as any)?.vestingPeriodSeconds
                        )
                      : "N/A"}
                  </span>
                </p>
                <p>
                  Cliff Period:{" "}
                  <span className="font-semibold text-foreground">
                    {(vestingOptions as any)?.cliffSeconds
                      ? formatLockupDuration(
                          (vestingOptions as any)?.cliffSeconds
                        )
                      : "0 days"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Contract Address Info */}
          <div className="pt-6 border-t border-primary-100/20 text-center">
            <p className="text-sm text-muted-foreground">
              Presale Contract:{" "}
              <a
                href={`https://basescan.org/address/${presaleAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary-600 hover:text-primary-800 hover:underline break-all"
              >
                {presaleAddress}
              </a>
            </p>
            {tokenAddress && (
              <p className="text-sm text-muted-foreground mt-1">
                Token Contract:{" "}
                <a
                  href={`https://basescan.org/address/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary-600 hover:text-primary-800 hover:underline break-all"
                >
                  {tokenAddress}
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresaleDetailPage;
