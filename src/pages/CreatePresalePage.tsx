import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
  useFeeData,
  useReadContract,
} from "wagmi";
import {
  parseUnits,
  zeroAddress,
  type Abi,
  formatUnits,
  encodeFunctionData,
  type Address,
  isAddress,
  maxUint256,
} from "viem";
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import ERC20Json from "@/abis/ERC20.json";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarIcon,
  Info,
  Loader2,
  ServerCrash,
  X,
  CheckCircle2,
  ArrowDownUp,
  BadgeEuro,
  ArrowDown,
  ArrowUp,
  Droplets,
  Percent,
  Clock,
  Coins,
  Copy,
  Rocket,
  ClipboardCheck,
  CircleDollarSign,
  Lock,
  Hash,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EstimatedFeeDisplay } from "@/pages/PresaleDetailPage";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMinutes, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const factoryAbi = PresaleFactoryJson.abi as Abi;
const erc20Abi = ERC20Json as Abi;

// const CREATION_FEE_CONSTANT = 10000000000000n; // 0.01 ETH in wei
// const FEE_TOKEN_DECIMALS = 18; // Always assume 18 decimals for ETH fee
// const FEE_TOKEN_SYMBOL = "ETH"; // Always assume ETH symbol

// Attempt to get addresses from environment variables
let factoryAddress: Address | undefined;
let wethAddress: Address | undefined;
let uniswapRouterAddress: Address | undefined;

try {
  const envFactory = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS;
  if (envFactory && typeof envFactory === "string" && isAddress(envFactory)) {
    factoryAddress = envFactory;
  } else {
    console.error(
      "VITE_PRESALE_FACTORY_ADDRESS is missing or invalid in environment variables."
    );
  }

  const envWeth = import.meta.env.VITE_WETH_ADDRESS;
  if (envWeth && typeof envWeth === "string" && isAddress(envWeth)) {
    wethAddress = envWeth;
  } else {
    console.error(
      "VITE_WETH_ADDRESS is missing or invalid in environment variables."
    );
  }

  const envRouter = import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS;
  if (envRouter && typeof envRouter === "string" && isAddress(envRouter)) {
    uniswapRouterAddress = envRouter;
  } else {
    console.error(
      "VITE_UNISWAP_ROUTER_ADDRESS is missing or invalid in environment variables."
    );
  }
} catch (e) {
  console.error("Error accessing environment variables:", e);
}

// Default values
const DEFAULT_LISTING_RATE = 100;
const DEFAULT_LIQUIDITY_RATE = 80;
const DEFAULT_LIQUIDITY_LOCK_DAYS = 30;
const DEFAULT_LIQUIDITY_PERCENT = 51;
const DEFAULT_START_DELAY_MINUTES = 5;
const DEFAULT_END_DURATION_DAYS = 7;
const DEFAULT_CLAIM_DELAY_MINUTES = 10;

// Helper function for strict numeric input handling
const handleNumericInput = (
  value: string,
  setter: (value: string) => void,
  allowDecimal: boolean = false,
  maxDigits?: number, // Max total digits (optional)
  maxDecimalPlaces?: number, // Max decimal places (optional)
  maxValue?: number // Max numeric value (optional)
) => {
  let sanitizedValue = value;

  // Remove non-numeric characters, except decimal point if allowed
  const regex = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
  sanitizedValue = sanitizedValue.replace(regex, "");

  // Handle multiple decimal points if decimals are allowed
  if (allowDecimal) {
    const parts = sanitizedValue.split(".");
    if (parts.length > 2) {
      sanitizedValue = parts[0] + "." + parts.slice(1).join("");
    }
    // Limit decimal places
    if (
      maxDecimalPlaces !== undefined &&
      parts[1] &&
      parts[1].length > maxDecimalPlaces
    ) {
      sanitizedValue = parts[0] + "." + parts[1].substring(0, maxDecimalPlaces);
    }
  }

  // Limit total digits if specified
  if (maxDigits !== undefined) {
    const currentDigits = sanitizedValue.replace(".", "").length;
    if (currentDigits > maxDigits) {
      // This logic might need refinement depending on desired behavior (e.g., truncate vs. prevent)
      // For now, let's prevent further input if max digits are exceeded
      return; // Or potentially truncate: sanitizedValue = sanitizedValue.substring(0, maxDigits + (sanitizedValue.includes('.') ? 1 : 0));
    }
  }

  // Prevent leading zeros unless it's the only digit or followed by a decimal
  if (
    sanitizedValue.length > 1 &&
    sanitizedValue.startsWith("0") &&
    !sanitizedValue.startsWith("0.")
  ) {
    sanitizedValue = sanitizedValue.substring(1);
  }
  if (sanitizedValue === ".") {
    sanitizedValue = "0.";
  }

  // Enforce max value if specified
  if (maxValue !== undefined) {
    try {
      const numericValue = parseFloat(sanitizedValue);
      if (!isNaN(numericValue) && numericValue > maxValue) {
        sanitizedValue = maxValue.toString();
      }
    } catch {
      /* Ignore parsing errors */
    }
  }

  setter(sanitizedValue);
};

const CreatePresalePage = () => {
  const navigate = useNavigate();
  const { address: userAddress, isConnected } = useAccount();
  const {
    writeContractAsync,
    data: hash,
    isPending: isWritePending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });
  const { data: feeData } = useFeeData();

  // --- Approval State & Hooks ---
  const [approvalHash, setApprovalHash] = useState<Address | undefined>();
  const { writeContractAsync: approveAsync } = useWriteContract(); // Removed isPending: isApprovingWrite
  const { isLoading: isConfirmingApproval, isSuccess: isApprovedSuccess } =
    useWaitForTransactionReceipt({ hash: approvalHash });

  // --- Fee Token Approval State & Hooks ---
  const [feeTokenApprovalHash, setFeeTokenApprovalHash] = useState<
    Address | undefined
  >();
  const { writeContractAsync: approveFeeTokenAsync } = useWriteContract();
  const {
    isLoading: isConfirmingFeeTokenApproval,
    isSuccess: isFeeTokenApprovedSuccess,
  } = useWaitForTransactionReceipt({ hash: feeTokenApprovalHash });
  const [isApprovingFeeToken, setIsApprovingFeeToken] = useState(false);
  const [hasSufficientFeeTokenAllowance, setHasSufficientFeeTokenAllowance] =
    useState(false);

  // Form State
  const [tokenAddress, setTokenAddress] = useState<Address | "">("");
  const [currencyAddress] = useState<Address>(zeroAddress); // Assuming ETH presales only for now
  const [ratePresale, setRatePresale] = useState(
    DEFAULT_LISTING_RATE.toString()
  );
  const [rateLiquidity, setRateLiquidity] = useState(
    DEFAULT_LIQUIDITY_RATE.toString()
  );
  const [hardCap, setHardCap] = useState("");
  const [softCap, setSoftCap] = useState("");
  const [minContribution, setMinContribution] = useState("");
  const [maxContribution, setMaxContribution] = useState("");
  const [liquidityPercent, setLiquidityPercent] = useState(
    DEFAULT_LIQUIDITY_PERCENT.toString()
  );
  const [liquidityLockDays, setLiquidityLockDays] = useState(
    DEFAULT_LIQUIDITY_LOCK_DAYS.toString()
  );
  const [startTime, setStartTime] = useState<Date | undefined>(
    addMinutes(new Date(), DEFAULT_START_DELAY_MINUTES)
  );
  const [endTime, setEndTime] = useState<Date | undefined>(
    addDays(new Date(), DEFAULT_END_DURATION_DAYS)
  );
  const [claimDelay, setClaimDelay] = useState(
    DEFAULT_CLAIM_DELAY_MINUTES.toString()
  );
  const [useVesting, setUseVesting] = useState(false);
  const [vestingTgePercent, setVestingTgePercent] = useState("10");
  const [vestingCycleDays, setVestingCycleDays] = useState("30");
  const [vestingCyclePercent, setVestingCyclePercent] = useState("10");
  const [leftoverTokenOption, setLeftoverTokenOption] = useState(2); // Default to third option (index 2)

  // Whitelist State
  const [whitelistType, setWhitelistType] = useState<number>(0); // 0: None, 1: Merkle (Not Implemented), 2: NFT
  const [nftContractAddress, setNftContractAddress] = useState<Address | "">(
    ""
  );

  // UI/Error State
  const [actionError, setActionError] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [hasSufficientAllowance, setHasSufficientAllowance] = useState(false);

  // --- Check Config Addresses ---
  useEffect(() => {
    if (!factoryAddress) {
      setConfigError(
        "Configuration Error: Presale Factory address is not set."
      );
    } else if (!wethAddress) {
      setConfigError("Configuration Error: WETH address is not set.");
    } else if (!uniswapRouterAddress) {
      setConfigError("Configuration Error: Uniswap Router address is not set.");
    }
  }, []);

  // --- Factory Config ---
  // const creationFee = CREATION_FEE_CONSTANT; // Old hardcoded fee
  // const feeTokenDecimals = FEE_TOKEN_DECIMALS; // Old hardcoded fee decimals
  // const feeTokenSymbol = FEE_TOKEN_SYMBOL; // Old hardcoded fee symbol

  const {
    data: factoryCreationFeeData,
    isLoading: isLoadingFactoryCreationFee,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "creationFee",
    query: { enabled: !!factoryAddress && isConnected },
  });
  const factoryCreationFee = useMemo(
    () =>
      typeof factoryCreationFeeData === "bigint"
        ? factoryCreationFeeData
        : undefined,
    [factoryCreationFeeData]
  );

  const {
    data: factoryFeeTokenAddressData,
    isLoading: isLoadingFactoryFeeToken,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "feeToken",
    query: { enabled: !!factoryAddress && isConnected },
  });
  const factoryFeeTokenAddress = useMemo(
    () =>
      typeof factoryFeeTokenAddressData === "string" &&
      isAddress(factoryFeeTokenAddressData)
        ? factoryFeeTokenAddressData
        : undefined,
    [factoryFeeTokenAddressData]
  );

  const {
    data: factoryFeeTokenDecimalsData,
    isLoading: isLoadingFactoryFeeTokenDecimals,
  } = useReadContract({
    address:
      factoryFeeTokenAddress === zeroAddress
        ? undefined
        : factoryFeeTokenAddress, // Only fetch if it's an ERC20 token
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled:
        !!factoryFeeTokenAddress &&
        factoryFeeTokenAddress !== zeroAddress &&
        isConnected,
    },
  });
  const factoryFeeTokenDecimals = useMemo(() => {
    if (factoryFeeTokenAddress === zeroAddress) return 18; // ETH default
    return typeof factoryFeeTokenDecimalsData === "number" ||
      typeof factoryFeeTokenDecimalsData === "bigint"
      ? Number(factoryFeeTokenDecimalsData)
      : undefined;
  }, [factoryFeeTokenAddress, factoryFeeTokenDecimalsData]);

  const {
    data: factoryFeeTokenSymbolData,
    isLoading: isLoadingFactoryFeeTokenSymbol,
  } = useReadContract({
    address:
      factoryFeeTokenAddress === zeroAddress
        ? undefined
        : factoryFeeTokenAddress, // Only fetch if it's an ERC20 token
    abi: erc20Abi,
    functionName: "symbol",
    query: {
      enabled:
        !!factoryFeeTokenAddress &&
        factoryFeeTokenAddress !== zeroAddress &&
        isConnected,
    },
  });
  const factoryFeeTokenSymbol = useMemo(() => {
    if (factoryFeeTokenAddress === zeroAddress) return "ETH"; // ETH default
    return typeof factoryFeeTokenSymbolData === "string"
      ? factoryFeeTokenSymbolData
      : undefined;
  }, [factoryFeeTokenAddress, factoryFeeTokenSymbolData]);

  // --- Check Fee Token Allowance ---
  const { data: currentFeeTokenAllowance, refetch: refetchFeeTokenAllowance } =
    useReadContract({
      address:
        factoryFeeTokenAddress === zeroAddress
          ? undefined
          : factoryFeeTokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress!, factoryAddress!],
      query: {
        enabled:
          !!factoryFeeTokenAddress &&
          factoryFeeTokenAddress !== zeroAddress &&
          !!userAddress &&
          !!factoryAddress &&
          isConnected &&
          factoryCreationFee !== undefined &&
          factoryCreationFee > 0n,
      },
    });

  useEffect(() => {
    if (
      factoryFeeTokenAddress &&
      factoryFeeTokenAddress !== zeroAddress &&
      typeof factoryCreationFee === "bigint" &&
      typeof currentFeeTokenAllowance === "bigint"
    ) {
      setHasSufficientFeeTokenAllowance(
        currentFeeTokenAllowance >= factoryCreationFee
      );
    } else if (factoryFeeTokenAddress === zeroAddress) {
      setHasSufficientFeeTokenAllowance(true); // For ETH fee, no allowance needed
    }
  }, [factoryFeeTokenAddress, currentFeeTokenAllowance, factoryCreationFee]);

  // Effect to refetch fee token allowance when approval is successful
  useEffect(() => {
    if (isFeeTokenApprovedSuccess) {
      toast.success("Fee Token Approved Successfully!");
      refetchFeeTokenAllowance();
      setIsApprovingFeeToken(false);
    }
  }, [isFeeTokenApprovedSuccess, refetchFeeTokenAllowance]);

  // --- Derived Values ---
  const currencyDecimals = 18; // Assuming ETH
  const calculatedStartTime = useMemo(() => {
    return startTime ? BigInt(Math.floor(startTime.getTime() / 1000)) : 0n;
  }, [startTime]);
  const calculatedEndTime = useMemo(() => {
    return endTime ? BigInt(Math.floor(endTime.getTime() / 1000)) : 0n;
  }, [endTime]);
  const hardCapParsed = useMemo(() => {
    try {
      return parseUnits(hardCap || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [hardCap, currencyDecimals]);
  const softCapParsed = useMemo(() => {
    try {
      return parseUnits(softCap || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [softCap, currencyDecimals]);
  const minContributionParsed = useMemo(() => {
    try {
      return parseUnits(minContribution || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [minContribution, currencyDecimals]);
  const maxContributionParsed = useMemo(() => {
    try {
      return parseUnits(maxContribution || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [maxContribution, currencyDecimals]);

  // --- Fetch Token Decimals ---
  const { data: tokenDecimalsData, isLoading: isLoadingTokenDecimals } =
    useReadContract({
      address: tokenAddress || undefined,
      abi: erc20Abi,
      functionName: "decimals",
      query: {
        enabled: !!tokenAddress && isAddress(tokenAddress),
      },
    });
  const tokenDecimals = useMemo(() => {
    return typeof tokenDecimalsData === "number" ||
      typeof tokenDecimalsData === "bigint"
      ? Number(tokenDecimalsData)
      : undefined;
  }, [tokenDecimalsData]);

  // --- Calculate Required Token Deposit ---
  const calculationOptions = useMemo(
    () => ({
      tokenDeposit: 0n, // This is the first field in the ABI struct for PresaleOptions
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n, // Default slippage, consistent with presaleOptionsArgs
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration: BigInt(parseInt(liquidityLockDays || "0") * 24 * 60 * 60),
      vestingPercentage: useVesting
        ? BigInt(parseInt(vestingTgePercent || "0") * 100)
        : 0n,
      vestingDuration: useVesting
        ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60)
        : 0n,
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      whitelistType: BigInt(whitelistType),
      merkleRoot:
        "0x0000000000000000000000000000000000000000000000000000000000000000", // Default
      nftContractAddress:
        whitelistType === 2 && isAddress(nftContractAddress)
          ? nftContractAddress
          : zeroAddress,
    }),
    [
      hardCapParsed,
      softCapParsed,
      minContributionParsed,
      maxContributionParsed,
      ratePresale,
      rateLiquidity,
      liquidityPercent,
      calculatedStartTime,
      calculatedEndTime,
      liquidityLockDays,
      useVesting,
      vestingTgePercent,
      vestingCycleDays,
      leftoverTokenOption,
      currencyAddress,
      whitelistType,
      nftContractAddress,
    ]
  );

  const {
    data: calculatedTokenDeposit,
    isLoading: isLoadingDepositCalc,
    error: depositCalcError,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "calculateTotalTokensNeededForPresale",
    args: [calculationOptions, tokenAddress || zeroAddress],
    query: {
      enabled:
        !!factoryAddress &&
        !!tokenAddress &&
        isAddress(tokenAddress) &&
        hardCapParsed > 0n &&
        BigInt(ratePresale || "0") > 0n &&
        BigInt(rateLiquidity || "0") > 0n &&
        BigInt(parseInt(liquidityPercent || "0")) > 0n &&
        !isLoadingTokenDecimals && // Ensure decimals are loaded before calculating
        tokenDecimals !== undefined,
      // Refetch when relevant inputs change
      refetchInterval: false, // Only refetch manually or on mount/dependency change
    },
  });

  // --- Check Allowance (Moved AFTER calculatedTokenDeposit declaration) ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: tokenAddress || undefined,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress!, factoryAddress!],
      query: {
        enabled:
          !!tokenAddress &&
          isAddress(tokenAddress) &&
          !!userAddress &&
          !!factoryAddress &&
          isConnected,
      },
    }
  );

  useEffect(() => {
    if (
      typeof calculatedTokenDeposit === "bigint" &&
      typeof currentAllowance === "bigint"
    ) {
      setHasSufficientAllowance(currentAllowance >= calculatedTokenDeposit);
    }
  }, [currentAllowance, calculatedTokenDeposit]);

  // Effect to refetch allowance when approval is successful
  useEffect(() => {
    if (isApprovedSuccess) {
      toast.success("Token Approved Successfully!");
      refetchAllowance();
      setIsApproving(false); // Reset approving state
    }
  }, [isApprovedSuccess, refetchAllowance]);

  // --- Prepare Contract Arguments (including calculated deposit) ---
  const presaleOptionsArgs = useMemo(
    () => ({
      tokenDeposit:
        typeof calculatedTokenDeposit === "bigint"
          ? calculatedTokenDeposit
          : 0n, // Use calculated value
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n, // Default slippage
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration: BigInt(parseInt(liquidityLockDays || "0") * 24 * 60 * 60),
      vestingPercentage: useVesting
        ? BigInt(parseInt(vestingTgePercent || "0") * 100)
        : 0n,
      vestingDuration: useVesting
        ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60)
        : 0n,
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      // --- Whitelist Params ---
      whitelistType: BigInt(whitelistType), // Use state variable
      merkleRoot:
        "0x0000000000000000000000000000000000000000000000000000000000000000", // Default for now
      nftContractAddress:
        whitelistType === 2 && isAddress(nftContractAddress)
          ? nftContractAddress
          : zeroAddress, // Use state or zero address
    }),
    [
      calculatedTokenDeposit,
      hardCapParsed,
      softCapParsed,
      minContributionParsed,
      maxContributionParsed,
      ratePresale,
      rateLiquidity,
      liquidityPercent,
      calculatedStartTime,
      calculatedEndTime,
      liquidityLockDays,
      useVesting,
      vestingTgePercent,
      vestingCycleDays,
      leftoverTokenOption,
      currencyAddress,
      vestingCyclePercent,
      whitelistType,
      nftContractAddress, // Added whitelist dependencies
    ]
  );

  // --- Gas Estimation ---
  const { data: createGas } = useEstimateGas({
    to: factoryAddress,
    data: encodeFunctionData({
      abi: factoryAbi,
      functionName: "createPresale",
      args: [
        presaleOptionsArgs,
        tokenAddress || zeroAddress,
        wethAddress ?? zeroAddress,
        uniswapRouterAddress ?? zeroAddress,
      ],
    }),
    value:
      factoryFeeTokenAddress === zeroAddress &&
      typeof factoryCreationFee === "bigint"
        ? factoryCreationFee
        : 0n, // Dynamic fee for gas estimation
    account: userAddress,
    query: {
      enabled:
        !!factoryAddress &&
        !!wethAddress &&
        !!uniswapRouterAddress &&
        isConnected &&
        !!tokenAddress &&
        hardCapParsed > 0n &&
        softCapParsed > 0n &&
        presaleOptionsArgs.tokenDeposit > 0n && // Ensure deposit is calculated before estimating gas
        !isLoadingDepositCalc, // Don't estimate if calculation is loading
    },
  });
  const calculateFee = (gas: bigint | undefined) =>
    gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;
  const createFeeCost = calculateFee(createGas);

  // --- Effect Hooks ---
  useEffect(() => {
    if (isConfirmed) {
      toast.success("Presale Created Successfully!");
      navigate("/presales");
    }
  }, [isConfirmed, navigate]);

  // --- Action Handlers ---
  const handleApproveFeeToken = async () => {
    if (
      !factoryFeeTokenAddress ||
      factoryFeeTokenAddress === zeroAddress ||
      !factoryAddress ||
      typeof factoryCreationFee !== "bigint" ||
      factoryCreationFee <= 0n
    ) {
      toast.error("Fee Approval Error", {
        description:
          "Missing fee token address, factory address, or fee amount for approval.",
      });
      return;
    }
    setActionError("");
    setIsApprovingFeeToken(true);
    try {
      const hash = await approveFeeTokenAsync({
        address: factoryFeeTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [factoryAddress, factoryCreationFee], // Approve for the exact fee amount
      });
      setFeeTokenApprovalHash(hash);
      toast.info("Fee Token Approval Sent", {
        description: "Waiting for confirmation...",
      });
    } catch (error: any) {
      console.error("Fee token approval error:", error);
      const displayError =
        error?.shortMessage ||
        error?.message ||
        "An unknown error occurred during fee token approval.";
      setActionError(`Fee token approval failed: ${displayError}`);
      toast.error("Fee Token Approval Failed", { description: displayError });
      setIsApprovingFeeToken(false);
    }
  };

  const handleApprove = async () => {
    if (
      !tokenAddress ||
      !isAddress(tokenAddress) ||
      !factoryAddress ||
      typeof calculatedTokenDeposit !== "bigint" ||
      calculatedTokenDeposit <= 0n
    ) {
      toast.error("Approval Error", {
        description:
          "Missing token address, factory address, or deposit amount for approval.",
      });
      return;
    }
    setActionError("");
    setIsApproving(true);
    try {
      const hash = await approveAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [factoryAddress, maxUint256], // Approve for maxUint256 to avoid re-approval
      });
      setApprovalHash(hash);
      toast.info("Approval Transaction Sent", {
        description: "Waiting for confirmation...",
      });
    } catch (error: any) {
      console.error("Approval error:", error);
      const displayError =
        error?.shortMessage ||
        error?.message ||
        "An unknown error occurred during approval.";
      setActionError(`Approval failed: ${displayError}`);
      toast.error("Approval Failed", { description: displayError });
      setIsApproving(false);
    }
  };

  const handleCreatePresale = async () => {
    if (!factoryAddress || !wethAddress || !uniswapRouterAddress) {
      const missing = !factoryAddress
        ? "Factory"
        : !wethAddress
        ? "WETH"
        : "Router";
      setActionError(`Configuration Error: ${missing} address not available.`);
      toast.error("Config Error", {
        description: `${missing} address missing.`,
      });
      return;
    }
    // Basic form validations (already present, ensure they are comprehensive)
    if (
      !isConnected ||
      !tokenAddress ||
      !isAddress(tokenAddress) ||
      hardCapParsed <= 0n ||
      softCapParsed <= 0n ||
      minContributionParsed <= 0n ||
      maxContributionParsed < minContributionParsed ||
      !ratePresale ||
      !rateLiquidity ||
      !liquidityPercent ||
      !liquidityLockDays ||
      !startTime ||
      !endTime ||
      !claimDelay ||
      (whitelistType === 2 &&
        (!nftContractAddress || !isAddress(nftContractAddress)))
    ) {
      setActionError("Please fill in all required fields correctly.");
      toast.error("Validation Error", {
        description: "Check all fields before creating.",
      });
      return;
    }
    if (softCapParsed > hardCapParsed) {
      setActionError("Soft Cap cannot be greater than Hard Cap.");
      toast.error("Validation Error", {
        description: "Soft Cap cannot exceed Hard Cap.",
      });
      return;
    }
    if (endTime <= startTime) {
      setActionError("End time must be after start time.");
      toast.error("Validation Error", {
        description: "End time must be after start time.",
      });
      return;
    }
    if (startTime <= new Date()) {
      setActionError("Start time must be in the future.");
      toast.error("Validation Error", {
        description: "Start time must be in the future.",
      });
      return;
    }
    if (isLoadingDepositCalc) {
      setActionError("Calculating required token deposit, please wait...");
      toast.warning("Calculation Pending", {
        description: "Waiting for token deposit calculation.",
      });
      return;
    }
    if (
      depositCalcError ||
      typeof calculatedTokenDeposit !== "bigint" ||
      calculatedTokenDeposit <= 0n
    ) {
      setActionError(
        `Failed to calculate required token deposit. Error: ${
          depositCalcError?.message || "Unknown error"
        }`
      );
      toast.error("Calculation Error", {
        description: "Could not calculate token deposit.",
      });
      return;
    }
    if (!hasSufficientAllowance) {
      setActionError(
        "Approval Error: Presale tokens not sufficiently approved."
      );
      toast.error("Approval Error", {
        description: "Presale tokens not sufficiently approved.",
      });
      return;
    }
    if (
      factoryFeeTokenAddress &&
      factoryFeeTokenAddress !== zeroAddress &&
      !hasSufficientFeeTokenAllowance
    ) {
      setActionError("Approval Error: Fee tokens not sufficiently approved.");
      toast.error("Approval Error", {
        description: "Fee tokens not sufficiently approved.",
      });
      return;
    }
    if (factoryCreationFee === undefined) {
      setActionError("Fee Error: Creation fee not loaded or invalid.");
      toast.error("Fee Error", {
        description: "Creation fee not loaded or invalid.",
      });
      return;
    }

    setActionError("");
    try {
      const ethToSend =
        factoryFeeTokenAddress === zeroAddress &&
        typeof factoryCreationFee === "bigint"
          ? factoryCreationFee
          : 0n;

      await writeContractAsync({
        // Removed const presaleTxHash assignment
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "createPresale",
        args: [
          presaleOptionsArgs,
          tokenAddress || zeroAddress,
          wethAddress,
          uniswapRouterAddress,
        ],
        value: ethToSend,
      });
      // Removed setHash(presaleTxHash); as 'hash' from useWriteContract hook is used by useWaitForTransactionReceipt
      toast.info("Create Presale Transaction Sent", {
        description: "Waiting for confirmation...",
      });
    } catch (error: any) {
      console.error("Create presale error:", error);
      const displayError =
        error?.shortMessage ||
        error?.message ||
        "An unknown error occurred during presale creation.";
      setActionError(`Presale creation failed: ${displayError}`);
      toast.error("Presale Creation Failed", { description: displayError });
    }
  };

  // --- Render Logic ---
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
        <Alert
          variant="destructive"
          className="max-w-md bg-destructive/10 border-destructive/20 text-destructive shadow-card"
        >
          <ServerCrash className="h-5 w-5" />
          <AlertTitle className="text-lg font-heading">
            Configuration Error
          </AlertTitle>
          <AlertDescription className="text-sm">{configError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
        <Alert
          variant="destructive"
          className="max-w-md bg-destructive/10 border-destructive/20 text-destructive shadow-card"
        >
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-heading">
            Wallet Not Connected
          </AlertTitle>
          <AlertDescription className="text-sm">
            Please connect your wallet to create a presale.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isActionLoading = isWritePending || isConfirming;

  // Determine if calculation is possible
  const canCalculateDeposit =
    !!factoryAddress &&
    !!tokenAddress &&
    isAddress(tokenAddress) &&
    hardCapParsed > 0n &&
    BigInt(ratePresale || "0") > 0n &&
    BigInt(rateLiquidity || "0") > 0n &&
    BigInt(parseInt(liquidityPercent || "0")) > 0n &&
    !isLoadingTokenDecimals &&
    tokenDecimals !== undefined;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 py-12 px-4 md:px-6 lg:px-8">
        <Card className="max-w-4xl mx-auto border shadow-xl bg-background/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary-900 to-primary-800 text-primary-foreground rounded-t-lg px-6 py-8 relative">
            <div className="absolute inset-0 bg-[url('/api/placeholder/1000/300')] opacity-10 mix-blend-overlay"></div>
            <div className="relative z-10">
              <div className="flex items-center mb-2">
                <span className="bg-white/20 text-xs font-medium text-white px-2.5 py-1 rounded-full mr-2">
                  New
                </span>
                <span className="text-xs text-white/70">
                  Create and configure your token presale in minutes
                </span>
              </div>
              <CardTitle className="text-3xl font-heading text-white flex items-center gap-2">
                <Rocket className="h-6 w-6" />
                Create New Presale
              </CardTitle>
              <CardDescription className="text-primary-100/80 mt-2 max-w-lg">
                Set up your token presale parameters, including rates, caps, and
                vesting schedules to launch your project on Uniswap.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
              onClick={() => navigate("/presales")}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <div className="bg-primary-50/30 border-b border-primary-100/20 px-8 py-4">
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <div className="flex items-center text-primary-900">
                <ClipboardCheck className="h-4 w-4 mr-1" />
                <span className="font-medium">4-Step Process</span>
              </div>
              <span className="text-muted-foreground mx-2">•</span>
              <div className="flex items-center text-primary-900/70">
                <CircleDollarSign className="h-4 w-4 mr-1" />
                <span>Token Configuration</span>
              </div>
              <span className="text-muted-foreground mx-2">•</span>
              <div className="flex items-center text-muted-foreground">
                <CalendarIcon className="h-4 w-4 mr-1" />
                <span>Schedule</span>
              </div>
              <span className="text-muted-foreground mx-2">•</span>
              <div className="flex items-center text-muted-foreground">
                <Lock className="h-4 w-4 mr-1" />
                <span>Security</span>
              </div>
            </div>
          </div>

          <CardContent className="p-8 space-y-8">
            {/* Token Address */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Token Details
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs font-normal bg-primary-50 text-primary-700 border-primary-200"
                >
                  Step 1 of 4
                </Badge>
              </div>

              <div className="space-y-3 animate-slide-up">
                <Label
                  htmlFor="tokenAddress"
                  className="text-base font-medium flex items-center"
                >
                  Token Address <span className="text-destructive ml-1">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-input text-popover-foreground">
                      <p className="max-w-xs">
                        Enter the ERC-20 token contract address that you want to
                        use for this presale.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="relative">
                 <Input
                    id="tokenAddress"
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\s+/g, '');
                      let pfx = '';
                      if (val.toLowerCase().startsWith('0x')) {
                        pfx = val.substring(0, 2);
                        val = val.substring(2);
                      }
                      val = val.replace(/[^0-9a-fA-F]/gi, '').substring(0, 40);
                      setTokenAddress((pfx + val) as Address);
                    }}
                    disabled={isActionLoading}
                    className="text-foreground pr-10 font-mono text-sm"
                  />
                  {tokenAddress && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary-900"
                      onClick={() =>
                        navigator.clipboard.writeText(tokenAddress)
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isLoadingTokenDecimals && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-900" />{" "}
                    Fetching token decimals...
                  </p>
                )}
                {tokenAddress &&
                  isAddress(tokenAddress) &&
                  !isLoadingTokenDecimals &&
                  tokenDecimals === undefined && (
                    <p className="text-sm text-destructive flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4" /> Could not fetch
                      decimals for this token.
                    </p>
                  )}
                {tokenAddress &&
                  isAddress(tokenAddress) &&
                  !isLoadingTokenDecimals &&
                  tokenDecimals !== undefined && (
                    <p className="text-sm text-primary-800 bg-primary-50 py-1.5 px-3 rounded-md inline-flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Token Decimals:{" "}
                      <span className="font-medium ml-1">{tokenDecimals}</span>
                    </p>
                  )}
                {!tokenAddress && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    <Info className="mr-2 h-4 w-4" /> Enter the address of the
                    token you want to sell.
                  </p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-3 animate-slide-up">
                <Label className="text-base font-medium">Currency</Label>
                <div className="flex items-center space-x-2 bg-muted p-3 rounded-md text-muted-foreground border border-input">
                  <div className="bg-primary-100 text-primary-800 p-1.5 rounded-full">
                    <Coins className="h-5 w-5" />
                  </div>
                  <span className="flex-1">ETH (Native Currency)</span>
                  <Badge
                    variant="secondary"
                    className="bg-primary-50 text-primary-700 border-none"
                  >
                    Default
                  </Badge>
                </div>
              </div>
            </section>

            {/* Rates */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Pricing & Rates
                </h3>
                <div className="flex items-center text-sm text-muted-foreground">
                  <ArrowDownUp className="h-4 w-4 mr-1" />
                  <span>Token Economics</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                <div className="space-y-3">
                  <Label
                    htmlFor="ratePresale"
                    className="text-base font-medium flex items-center"
                  >
                    Presale Rate{" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="ratePresale"
                      type="text"
                      inputMode="numeric"
                      placeholder={`e.g., ${DEFAULT_LISTING_RATE}`}
                      value={ratePresale}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setRatePresale,
                          false
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    How many tokens per 1 ETH?
                  </p>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="rateLiquidity"
                    className="text-base font-medium flex items-center"
                  >
                    Listing Rate{" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="rateLiquidity"
                      type="text"
                      inputMode="numeric"
                      placeholder={`e.g., ${DEFAULT_LIQUIDITY_RATE}`}
                      value={rateLiquidity}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setRateLiquidity,
                          false
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Initial Uniswap listing rate (tokens per 1 ETH).
                  </p>
                  <Alert className="mt-2 bg-primary-50 border-primary-100 text-primary-900">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      The listing rate determines the initial price on the DEX
                      after presale completion.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </section>

            {/* Caps */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Funding Caps
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                <div className="space-y-3">
                  <Label
                    htmlFor="hardCap"
                    className="text-base font-medium flex items-center"
                  >
                    Hard Cap (ETH){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="hardCap"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 100"
                      value={hardCap}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setHardCap,
                          true,
                          undefined,
                          currencyDecimals
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <BadgeEuro className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Maximum ETH to raise.
                    </p>
                    {hardCap &&
                      softCap &&
                      parseFloat(hardCap) > 0 &&
                      parseFloat(softCap) > 0 && (
                        <p className="text-xs text-primary-900">
                          {(
                            (parseFloat(softCap) / parseFloat(hardCap)) *
                            100
                          ).toFixed(0)}
                          % ratio
                        </p>
                      )}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="softCap"
                    className="text-base font-medium flex items-center"
                  >
                    Soft Cap (ETH){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="softCap"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 50"
                      value={softCap}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setSoftCap,
                          true,
                          undefined,
                          currencyDecimals
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <BadgeEuro className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Minimum ETH needed for success.
                  </p>
                </div>
              </div>

              {hardCap &&
                softCap &&
                parseFloat(hardCap) > 0 &&
                parseFloat(softCap) > 0 && (
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-primary-700 to-primary-500 h-2.5 rounded-full"
                      style={{
                        width: `${Math.max(
                          10,
                          Math.min(
                            100,
                            (parseFloat(softCap) / parseFloat(hardCap)) * 100
                          )
                        )}%`,
                      }}
                    ></div>
                  </div>
                )}
            </section>

            {/* Contributions */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Participant Limits
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                <div className="space-y-3">
                  <Label
                    htmlFor="minContribution"
                    className="text-base font-medium flex items-center"
                  >
                    Min Contribution (ETH){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="minContribution"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 0.1"
                      value={minContribution}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setMinContribution,
                          true,
                          undefined,
                          currencyDecimals
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <ArrowDown className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Minimum ETH per wallet.
                  </p>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="maxContribution"
                    className="text-base font-medium flex items-center"
                  >
                    Max Contribution (ETH){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="maxContribution"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 5"
                      value={maxContribution}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setMaxContribution,
                          true,
                          undefined,
                          currencyDecimals
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <ArrowUp className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maximum ETH per wallet.
                  </p>
                </div>
              </div>
            </section>

            {/* Liquidity */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Liquidity Settings
                </h3>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Droplets className="h-4 w-4 mr-1" />
                  <span>Uniswap Integration</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                <div className="space-y-3">
                  <Label
                    htmlFor="liquidityPercent"
                    className="text-base font-medium flex items-center"
                  >
                    Liquidity Percent (%){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="liquidityPercent"
                      type="text"
                      inputMode="numeric"
                      placeholder={`e.g., ${DEFAULT_LIQUIDITY_PERCENT}`}
                      value={liquidityPercent}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setLiquidityPercent,
                          false,
                          3,
                          0,
                          100
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Funds allocated for Uniswap liquidity.
                  </p>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="liquidityLockDays"
                    className="text-base font-medium flex items-center"
                  >
                    Liquidity Lockup (Days){" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="liquidityLockDays"
                      type="text"
                      inputMode="numeric"
                      placeholder={`e.g., ${DEFAULT_LIQUIDITY_LOCK_DAYS}`}
                      value={liquidityLockDays}
                      onChange={(e) =>
                        handleNumericInput(
                          e.target.value,
                          setLiquidityLockDays,
                          false
                        )
                      }
                      disabled={isActionLoading}
                      className="text-foreground pl-10"
                    />
                    <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                      <Lock className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Days liquidity is locked after presale.
                  </p>
                </div>
              </div>
            </section>

            {/* Dates & Times */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Schedule
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs font-normal bg-primary-50 text-primary-700 border-primary-200"
                >
                  Step 2 of 4
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                <div className="space-y-3">
                  <Label
                    htmlFor="startTime"
                    className="text-base font-medium flex items-center"
                  >
                    Start Time <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-foreground border-input group",
                          !startTime && "text-muted-foreground"
                        )}
                        disabled={isActionLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary-900 group-hover:text-primary-800" />
                        {startTime ? (
                          format(startTime, "PPP HH:mm")
                        ) : (
                          <span>Pick a date and time</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-input shadow-card">
                      <Calendar
                        mode="single"
                        selected={startTime}
                        onSelect={setStartTime}
                        initialFocus
                        className="rounded-t-md border-b"
                      />
                      <div className="p-3 border-t border-input">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={startTime ? format(startTime, "HH:mm") : ""}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value
                                .split(":")
                                .map(Number);
                              const newDate = startTime
                                ? new Date(startTime)
                                : new Date();
                              newDate.setHours(hours, minutes);
                              setStartTime(newDate);
                            }}
                            className="text-foreground"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-sm text-muted-foreground">
                    Presale start time (UTC).
                  </p>
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="endTime"
                    className="text-base font-medium flex items-center"
                  >
                    End Time <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal text-foreground border-input group",
                          !endTime && "text-muted-foreground"
                        )}
                        disabled={isActionLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary-900 group-hover:text-primary-800" />
                        {endTime ? (
                          format(endTime, "PPP HH:mm")
                        ) : (
                          <span>Pick a date and time</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-input shadow-card">
                      <Calendar
                        mode="single"
                        selected={endTime}
                        onSelect={setEndTime}
                        initialFocus
                        className="rounded-t-md border-b"
                      />
                      <div className="p-3 border-t border-input">
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="time"
                            value={endTime ? format(endTime, "HH:mm") : ""}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value
                                .split(":")
                                .map(Number);
                              const newDate = endTime
                                ? new Date(endTime)
                                : new Date();
                              newDate.setHours(hours, minutes);
                              setEndTime(newDate);
                            }}
                            className="text-foreground"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <p className="text-sm text-muted-foreground">
                    Presale end time (UTC).
                  </p>
                </div>
              </div>

              {startTime && endTime && (
                <div className="px-4 py-3 bg-primary-50 rounded-lg border border-primary-100 text-primary-900 flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Duration: </span>
                    {(() => {
                      const diffMs = endTime.getTime() - startTime.getTime();
                      const diffDays = Math.floor(
                        diffMs / (1000 * 60 * 60 * 24)
                      );
                      const diffHours = Math.floor(
                        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                      );
                      return `${diffDays} days, ${diffHours} hours`;
                    })()}
                  </div>
                </div>
              )}

              {/* Claim Delay */}
              <div className="space-y-3 animate-slide-up mt-4">
                <Label
                  htmlFor="claimDelay"
                  className="text-base font-medium flex items-center"
                >
                  Claim Delay (Minutes){" "}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="claimDelay"
                    type="text"
                    inputMode="numeric"
                    placeholder={`e.g., ${DEFAULT_CLAIM_DELAY_MINUTES}`}
                    value={claimDelay}
                    onChange={(e) =>
                      handleNumericInput(e.target.value, setClaimDelay, false)
                    }
                    disabled={isActionLoading}
                    className="text-foreground pl-10"
                  />
                  <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Delay before token claims are available after presale end.
                </p>
              </div>
            </section>

            {/* Vesting Options */}
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Distribution & Vesting
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs font-normal bg-primary-50 text-primary-700 border-primary-200"
                >
                  Step 3 of 4
                </Badge>
              </div>

              <Card className="bg-muted/50 border shadow-sm animate-slide-up overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary-50/80 to-primary-50/30 border-b border-primary-100/30">
                  <CardTitle className="text-lg font-heading flex items-center">
                    <div className="flex items-center justify-center w-6 h-6 bg-primary-100 rounded-full mr-2">
                      <Checkbox
                        id="useVesting"
                        checked={useVesting}
                        onCheckedChange={(checked) =>
                          setUseVesting(Boolean(checked))
                        }
                        className="border-primary-900 data-[state=checked]:bg-primary-900"
                        disabled={isActionLoading}
                      />
                    </div>
                    <Label htmlFor="useVesting" className="cursor-pointer">
                      Enable Vesting (Optional)
                    </Label>
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Distribute tokens gradually over time instead of all at
                    once.
                  </CardDescription>
                </CardHeader>
                {useVesting && (
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <Label
                          htmlFor="vestingTgePercent"
                          className="text-base font-medium"
                        >
                          TGE Percent (%)
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="vestingTgePercent"
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g., 10"
                            value={vestingTgePercent}
                            onChange={(e) =>
                              handleNumericInput(
                                e.target.value,
                                setVestingTgePercent,
                                false,
                                3,
                                0,
                                100
                              )
                            }
                            disabled={isActionLoading}
                            className="text-foreground pr-8"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                            %
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Percentage released at Token Generation Event.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Label
                          htmlFor="vestingCycleDays"
                          className="text-base font-medium"
                        >
                          Cycle Length (Days)
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="vestingCycleDays"
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g., 30"
                            value={vestingCycleDays}
                            onChange={(e) =>
                              handleNumericInput(
                                e.target.value,
                                setVestingCycleDays,
                                false
                              )
                            }
                            disabled={isActionLoading}
                            className="text-foreground pl-10"
                          />
                          <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Duration of each vesting cycle in days.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <Label
                          htmlFor="vestingCyclePercent"
                          className="text-base font-medium"
                        >
                          Cycle Release (%)
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="vestingCyclePercent"
                            type="text"
                            inputMode="numeric"
                            placeholder="e.g., 10"
                            value={vestingCyclePercent}
                            onChange={(e) =>
                              handleNumericInput(
                                e.target.value,
                                setVestingCyclePercent,
                                false,
                                3,
                                0,
                                100
                              )
                            }
                            disabled={isActionLoading}
                            className="text-foreground pr-8"
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                            %
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Percentage released per cycle.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </section>

            {/* Leftover Tokens */}
            <section className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Unsold Tokens
                </h3>
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="leftoverTokenOption"
                  className="text-base font-medium flex items-center"
                >
                  Unsold Token Handling{" "}
                  <span className="text-destructive ml-1">*</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-input text-popover-foreground">
                      <p className="max-w-xs">
                        Choose what happens to tokens that remain unsold after
                        the presale ends.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  onValueChange={(value) =>
                    setLeftoverTokenOption(Number(value))
                  }
                  defaultValue={leftoverTokenOption.toString()}
                  disabled={isActionLoading}
                >
                  <SelectTrigger
                    id="leftoverTokenOption"
                    className="select-trigger"
                  >
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-input">
                    <SelectItem value="0">Burn</SelectItem>
                    <SelectItem value="1">Refund to Creator</SelectItem>
                    <SelectItem value="2">
                      Send to Treasury (Requires Treasury Address)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Handle tokens not sold during the presale.
                </p>
              </div>
            </section>

            {/* Whitelist Options */}
            <section className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Access Control
                </h3>
                <Badge
                  variant="outline"
                  className="text-xs font-normal bg-primary-50 text-primary-700 border-primary-200"
                >
                  Step 4 of 4
                </Badge>
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="whitelist-type"
                  className="text-base font-medium flex items-center"
                >
                  Whitelist Type
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-input text-popover-foreground">
                      <p className="max-w-xs">
                        Restrict presale participation to specific groups, such
                        as NFT holders.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={whitelistType.toString()}
                  onValueChange={(value) => setWhitelistType(parseInt(value))}
                  disabled={isActionLoading}
                >
                  <SelectTrigger id="whitelist-type" className="select-trigger">
                    <SelectValue placeholder="Select whitelist type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-input">
                    <SelectItem value="0">None (Public)</SelectItem>
                    <SelectItem value="2">NFT Holder</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Control who can participate in the presale.
                </p>
              </div>
              {whitelistType === 2 && (
                <div className="space-y-3 animate-slide-up">
                  <Label
                    htmlFor="nft-address"
                    className="text-base font-medium flex items-center"
                  >
                    NFT Contract Address{" "}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="nft-address"
                      value={nftContractAddress}
                      onChange={(e) =>
                        setNftContractAddress(e.target.value as Address)
                      }
                      placeholder="0x..."
                      className="text-foreground pr-10 font-mono text-sm"
                      disabled={isActionLoading}
                    />
                    {nftContractAddress && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary-900"
                        onClick={() =>
                          navigator.clipboard.writeText(nftContractAddress)
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {whitelistType === 2 &&
                    (!nftContractAddress || !isAddress(nftContractAddress)) && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="mr-2 h-4 w-4" /> Enter a valid
                        NFT contract address.
                      </p>
                    )}
                  <p className="text-sm text-muted-foreground">
                    Enter the NFT contract address for whitelist eligibility.
                  </p>
                </div>
              )}
            </section>

            {/* Calculated Token Deposit Display */}
            <section className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Token Deposit
                </h3>
              </div>
              <div className="space-y-3">
                <Label className="text-base font-medium flex items-center">
                  Required Token Deposit
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-input text-popover-foreground">
                      <p className="max-w-xs">
                        Total tokens required for the presale and liquidity pool
                        based on your settings.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="p-4 border border-input rounded-md bg-muted min-h-[48px] flex items-center">
                  {isLoadingDepositCalc && (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-900" />
                  )}
                  {canCalculateDeposit &&
                  !isLoadingDepositCalc &&
                  typeof calculatedTokenDeposit === "bigint" &&
                  tokenDecimals !== undefined ? (
                    <span className="text-foreground font-medium">
                      {formatUnits(calculatedTokenDeposit, tokenDecimals)}{" "}
                      Tokens
                    </span>
                  ) : canCalculateDeposit && isLoadingDepositCalc ? (
                    <span className="text-muted-foreground">
                      Calculating...
                    </span>
                  ) : depositCalcError ? (
                    <span className="text-destructive text-sm flex items-center">
                      <AlertCircle className="mr-2 h-4 w-4" /> Error calculating
                      deposit.
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Fill required fields to calculate.
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total tokens needed for presale and liquidity.
                </p>
              </div>
            </section>

            {/* Fees & Summary */}
            <section className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <h3 className="text-lg font-medium text-foreground">
                  Summary & Fees
                </h3>
              </div>
              <Card className="bg-muted/50 border shadow-sm">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex justify-between text-base">
                    <span className="flex items-center">
                      Creation Fee
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover border-input text-popover-foreground">
                          <p className="max-w-xs">
                            Fee charged by the presale factory to create the
                            presale.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    <span>
                      {isLoadingFactoryCreationFee ||
                      isLoadingFactoryFeeToken ||
                      isLoadingFactoryFeeTokenDecimals ||
                      isLoadingFactoryFeeTokenSymbol ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-900" />{" "}
                          Loading fee...
                        </span>
                      ) : factoryCreationFee !== undefined &&
                        factoryFeeTokenDecimals !== undefined &&
                        factoryFeeTokenSymbol ? (
                        <span className="font-medium">
                          {formatUnits(
                            factoryCreationFee,
                            factoryFeeTokenDecimals
                          )}{" "}
                          {factoryFeeTokenSymbol}
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center">
                          <AlertCircle className="mr-2 h-4 w-4" /> Error loading
                          fee
                        </span>
                      )}
                    </span>
                  </div>
                  {createFeeCost !== undefined && (
                    <div className="flex justify-between text-base">
                      <span className="flex items-center">
                        Estimated Gas Fee
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-input text-popover-foreground">
                            <p className="max-w-xs">
                              Estimated Ethereum network gas fee for deploying
                              the presale contract.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span className="font-medium">
                        <EstimatedFeeDisplay label="" fee={createFeeCost} />
                      </span>
                    </div>
                  )}
                  {actionError && (
                    <Alert
                      variant="destructive"
                      className="mt-4 bg-destructive/10 border-destructive/20 text-destructive"
                    >
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle className="text-base font-heading">
                        Error
                      </AlertTitle>
                      <AlertDescription className="text-sm">
                        {actionError}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Action Buttons */}
            <section className="space-y-6 animate-slide-up">
              {isConnected &&
              tokenAddress &&
              isAddress(tokenAddress) &&
              factoryAddress &&
              typeof calculatedTokenDeposit === "bigint" &&
              calculatedTokenDeposit > 0n &&
              factoryCreationFee !== undefined &&
              factoryFeeTokenAddress !== undefined &&
              !configError ? (
                !hasSufficientAllowance ? (
                  <Button
                    onClick={handleApprove}
                    disabled={
                      isLoadingDepositCalc ||
                      isApproving ||
                      isConfirmingApproval ||
                      isLoadingFactoryCreationFee ||
                      isLoadingFactoryFeeToken
                    }
                    className="w-full bg-gradient-to-r from-primary-900 to-primary-800 text-white text-lg py-6 hover:from-primary-800 hover:to-primary-700"
                  >
                    {isApproving || isConfirmingApproval ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                        Approving Presale Tokens...
                      </>
                    ) : (
                      "Approve Presale Tokens"
                    )}
                  </Button>
                ) : factoryFeeTokenAddress !== zeroAddress &&
                  factoryCreationFee > 0n &&
                  !hasSufficientFeeTokenAllowance ? (
                  <Button
                    onClick={handleApproveFeeToken}
                    disabled={
                      isLoadingFactoryCreationFee ||
                      isLoadingFactoryFeeToken ||
                      isApprovingFeeToken ||
                      isConfirmingFeeTokenApproval
                    }
                    className="w-full bg-gradient-to-r from-primary-900 to-primary-800 text-white text-lg py-6 hover:from-primary-800 hover:to-primary-700"
                  >
                    {isApprovingFeeToken || isConfirmingFeeTokenApproval ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                        Approving Fee Token ({factoryFeeTokenSymbol})...
                      </>
                    ) : (
                      `Approve ${
                        factoryFeeTokenSymbol || "Fee Token"
                      } for Creation Fee`
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreatePresale}
                    disabled={
                      isLoadingDepositCalc ||
                      isWritePending ||
                      isConfirming ||
                      isLoadingFactoryCreationFee ||
                      isLoadingFactoryFeeToken ||
                      (factoryFeeTokenAddress !== zeroAddress &&
                        factoryCreationFee > 0n &&
                        (isApprovingFeeToken || isConfirmingFeeTokenApproval))
                    }
                    className="w-full bg-gradient-to-r from-primary-900 to-primary-800 text-white text-lg py-6 hover:from-primary-800 hover:to-primary-700"
                  >
                    {isWritePending || isConfirming ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                        Creating Presale...
                      </>
                    ) : (
                      "Create Presale"
                    )}
                  </Button>
                )
              ) : (
                <Button
                  disabled={true}
                  className="w-full text-lg py-6 bg-muted text-muted-foreground cursor-not-allowed"
                  title={
                    configError ||
                    "Connect wallet and fill required fields to enable actions."
                  }
                >
                  {isLoadingFactoryCreationFee ||
                  isLoadingFactoryFeeToken ||
                  isLoadingDepositCalc ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
                      prerequisites...
                    </>
                  ) : (
                    "Create Presale"
                  )}
                </Button>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default CreatePresalePage;
