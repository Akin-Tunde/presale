import { useState, useEffect, useMemo, useCallback, useRef } from "react"; // Added useCallback
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
  useFeeData,
  useReadContract,
  usePublicClient,
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
  // Droplets,
  // Percent,
  Clock,
  Coins,
  Copy,
  Rocket,
  // ClipboardCheck,
  // CircleDollarSign,
  Lock,
  Hash,
  ArrowRight,
  ArrowLeft,
   Image,
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
// import { Progress } from "@/components/ui/progress";
import { uploadPresaleImage } from "@/lib/supabase";


const factoryAbi = PresaleFactoryJson.abi as Abi;
const erc20Abi = ERC20Json as Abi;

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
  maxDigits?: number,
  maxDecimalPlaces?: number,
  maxValue?: number
) => {
  let sanitizedValue = value;
  const regex = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
  sanitizedValue = sanitizedValue.replace(regex, "");

  if (allowDecimal) {
    const parts = sanitizedValue.split(".");
    if (parts.length > 2) {
      sanitizedValue = parts[0] + "." + parts.slice(1).join("");
    }
    if (
      maxDecimalPlaces !== undefined &&
      parts[1] &&
      parts[1].length > maxDecimalPlaces
    ) {
      sanitizedValue = parts[0] + "." + parts[1].substring(0, maxDecimalPlaces);
    }
  }

  if (maxDigits !== undefined) {
    const currentDigits = sanitizedValue.replace(".", "").length;
    if (currentDigits > maxDigits) {
      return;
    }
  }

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

  if (maxValue !== undefined) {
    try {
      const numericValue = parseFloat(sanitizedValue);
      if (!isNaN(numericValue) && numericValue > maxValue) {
        sanitizedValue = maxValue.toString();
      }
    } catch {}
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

  // Image State
const [presaleImage, setPresaleImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const [isUploadingImage, setIsUploadingImage] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Stage State ---
  const [currentStage, setCurrentStage] = useState<number>(1);

  // --- Approval State & Hooks ---
  const [approvalHash, setApprovalHash] = useState<Address | undefined>();
  const { writeContractAsync: approveAsync } = useWriteContract();
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
  const [currencyAddress] = useState<Address>(zeroAddress);
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
  const [leftoverTokenOption, setLeftoverTokenOption] = useState(2);

  // Whitelist State
  const [whitelistType, setWhitelistType] = useState<number>(0);
  const [nftContractAddress, setNftContractAddress] = useState<Address | "">(
    ""
  );


  // UI/Error State
  const [actionError, setActionError] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [hasSufficientAllowance, setHasSufficientAllowance] = useState(false);

const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file size
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Image too large', { description: 'Maximum file size is 2MB' });
    return;
  }
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    toast.error('Invalid file type', { description: 'Only JPG, PNG, and WebP are supported' });
    return;
  }
  
  setPresaleImage(file);
  
  // Create preview
  const reader = new FileReader();
  reader.onloadend = () => {
    setImagePreview(reader.result as string);
  };
  reader.readAsDataURL(file);
};

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
        : factoryFeeTokenAddress,
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
    if (factoryFeeTokenAddress === zeroAddress) return 18;
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
        : factoryFeeTokenAddress,
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
    if (factoryFeeTokenAddress === zeroAddress) return "ETH";
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
      setHasSufficientFeeTokenAllowance(true);
    }
  }, [factoryFeeTokenAddress, currentFeeTokenAllowance, factoryCreationFee]);

  useEffect(() => {
    if (isFeeTokenApprovedSuccess) {
      toast.success("Fee Token Approved Successfully!");
      refetchFeeTokenAllowance();
      setIsApprovingFeeToken(false);
    }
  }, [isFeeTokenApprovedSuccess, refetchFeeTokenAllowance]);

  // --- Derived Values ---
  const currencyDecimals = 18;
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

const publicClient = usePublicClient();

  // --- Fetch Token Decimals ---
  const { data: tokenDecimalsData, isLoading: isLoadingTokenDecimals } =
    useReadContract({
      address: tokenAddress && isAddress(tokenAddress) ? tokenAddress : undefined,
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
      tokenDeposit: 0n,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n,
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration:
        BigInt(parseInt(liquidityLockDays || "0") * 24 * 60 * 60),
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
        "0x0000000000000000000000000000000000000000000000000000000000000000",
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
    args: [calculationOptions, tokenAddress && isAddress(tokenAddress) ? tokenAddress : zeroAddress],
    query: {
      enabled:
        !!factoryAddress &&
        !!tokenAddress &&
        isAddress(tokenAddress) &&
        hardCapParsed > 0n &&
        BigInt(ratePresale || "0") > 0n &&
        BigInt(rateLiquidity || "0") > 0n &&
        BigInt(parseInt(liquidityPercent || "0")) > 0n &&
        !isLoadingTokenDecimals &&
        tokenDecimals !== undefined,
      refetchInterval: false,
    },
  });

  // --- Check Allowance ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: tokenAddress && isAddress(tokenAddress) ? tokenAddress : undefined,
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

  useEffect(() => {
    if (isApprovedSuccess) {
      toast.success("Token Approved Successfully!");
      refetchAllowance();
      setIsApproving(false);
    }
  }, [isApprovedSuccess, refetchAllowance]);

  // --- Prepare Contract Arguments ---
  const presaleOptionsArgs = useMemo(
    () => ({
      tokenDeposit:
        typeof calculatedTokenDeposit === "bigint"
          ? calculatedTokenDeposit
          : 0n,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n,
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
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      nftContractAddress:
        whitelistType === 2 && isAddress(nftContractAddress)
          ? nftContractAddress
          : zeroAddress,
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
      nftContractAddress,
    ]
  );

  // --- Gas Estimation ---
  const { data: createGas } = useEstimateGas({
    to: factoryAddress,
    data: (() => {
      try {
        // Validate all addresses before encoding
        if (!tokenAddress || !isAddress(tokenAddress)) {
          console.warn("Invalid token address detected during gas estimation");
          return "0x"; // Return empty hex to prevent encoding error
        }
        
        if (!factoryAddress || !isAddress(factoryAddress)) {
          console.warn("Invalid factory address detected during gas estimation");
          return "0x";
        }
        
        if (!wethAddress || !isAddress(wethAddress)) {
          console.warn("Invalid WETH address detected during gas estimation");
          return "0x";
        }
        
        if (!uniswapRouterAddress || !isAddress(uniswapRouterAddress)) {
          console.warn("Invalid Uniswap Router address detected during gas estimation");
          return "0x";
        }
        
        // Only encode if all addresses are valid
        return encodeFunctionData({
          abi: factoryAbi,
          functionName: "createPresale",
          args: [
            presaleOptionsArgs,
            tokenAddress,
            wethAddress,
            uniswapRouterAddress,
          ],
        });
      } catch (error) {
        console.error("Error encoding function data:", error);
        return "0x"; // Return empty hex to prevent encoding error
      }
    })(),
    value:
      factoryFeeTokenAddress === zeroAddress &&
      typeof factoryCreationFee === "bigint"
        ? factoryCreationFee
        : 0n,
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
        presaleOptionsArgs.tokenDeposit > 0n &&
        !isLoadingDepositCalc,
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


// 4. Add this useEffect to handle the transaction confirmation and image upload:
useEffect(() => {
  const uploadImage = async () => {
    if (isConfirmed && hash && presaleImage) {
      let transactionReceipt = null; // Define outside try block for wider scope
      
      try {
        setIsUploadingImage(true);
        
        // Check if publicClient is available
        if (!publicClient) {
          throw new Error("Public client is not available");
        }
        
        // Get the transaction receipt using wagmi's publicClient
        transactionReceipt = await publicClient.getTransactionReceipt({ hash });
        
        if (!transactionReceipt || !transactionReceipt.logs) {
          throw new Error("Transaction receipt or logs not available");
        }
        
        // Extract the presale address from the logs
        const presaleAddress = extractPresaleAddressFromLogs(transactionReceipt.logs);
        
        if (!presaleAddress) {
          throw new Error("Could not extract presale address from transaction logs");
        }
        
        // Upload the image with the presale address (don't assign to unused variable)
        await uploadPresaleImage(presaleImage, presaleAddress);
        
        toast.success("Image Uploaded", {
          description: "Your presale image has been uploaded successfully.",
        });
        
        // Navigate to the presale detail page
        navigate(`/presale/${presaleAddress}`);
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Image Upload Failed", {
          description: `Error: ${(error as Error).message}`,
        });
        
        // Try to navigate even if image upload fails
        try {
          if (transactionReceipt && transactionReceipt.logs) {
            const presaleAddress = extractPresaleAddressFromLogs(transactionReceipt.logs);
            if (presaleAddress) {
              navigate(`/presale/${presaleAddress}`);
            }
          }
        } catch (navError) {
          console.error("Error navigating after failed upload:", navError);
        }
      } finally {
        setIsUploadingImage(false);
      }
    }
  };
  
  if (isConfirmed && hash) {
    uploadImage();
  }
}, [isConfirmed, hash, presaleImage, navigate, publicClient]);



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
        args: [factoryAddress, factoryCreationFee],
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
        args: [factoryAddress, maxUint256],
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
  
  if (!validateAllStages(true)) {
    console.warn("[handleCreatePresale] validateAllStages failed."); // DEBUG
    // validateAllStages will show toast on error
    return;
  }
  console.log("[handleCreatePresale] Final validation passed."); // DEBUG

  // Additional address validation to prevent runtime errors
  console.log("[handleCreatePresale] Validating token address:", tokenAddress); // DEBUG
  if (!tokenAddress || !isAddress(tokenAddress)) {
    console.error("[handleCreatePresale] Invalid Token Address."); // DEBUG
    toast.error("Invalid Token Address", {
      description: "Please enter a valid token address before creating the presale."
    });
    setCurrentStage(1); // Return to token input stage
    return;
  }

  console.log("[handleCreatePresale] Validating NFT contract address (if applicable):", { whitelistType, nftContractAddress }); // DEBUG
  if (whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress))) {
    console.error("[handleCreatePresale] Invalid NFT Contract Address."); // DEBUG
    toast.error("Invalid NFT Contract Address", {
      description: "Please enter a valid NFT contract address for whitelist."
    });
    setCurrentStage(3); // Return to whitelist stage
    return;
  }
  console.log("[handleCreatePresale] Address validations passed."); // DEBUG

  setActionError("");
  try {
    console.log("[handleCreatePresale] Entering try block."); // DEBUG
    // Check if publicClient is available
    console.log("[handleCreatePresale] Checking publicClient..."); // DEBUG
    if (!publicClient) {
      console.error("[handleCreatePresale] Public client is not available."); // DEBUG
      throw new Error("Public client is not available");
    }
    console.log("[handleCreatePresale] Public client available."); // DEBUG
    
    const ethToSend =
      factoryFeeTokenAddress === zeroAddress &&
      typeof factoryCreationFee === "bigint"
        ? factoryCreationFee
        : 0n;
    console.log("[handleCreatePresale] Calculated ethToSend:", ethToSend.toString()); // DEBUG

    // Ensure all addresses are valid before proceeding
    console.log("[handleCreatePresale] Validating configuration addresses:", { factoryAddress, wethAddress, uniswapRouterAddress }); // DEBUG
    if (!factoryAddress || !isAddress(factoryAddress)) {
      console.error("[handleCreatePresale] Invalid factory address configuration."); // DEBUG
      throw new Error("Invalid factory address configuration");
    }
    
    if (!wethAddress || !isAddress(wethAddress)) {
      console.error("[handleCreatePresale] Invalid WETH address configuration."); // DEBUG
      throw new Error("Invalid WETH address configuration");
    }
    
    if (!uniswapRouterAddress || !isAddress(uniswapRouterAddress)) {
      console.error("[handleCreatePresale] Invalid Uniswap Router address configuration."); // DEBUG
      throw new Error("Invalid Uniswap Router address configuration");
    }
    console.log("[handleCreatePresale] Configuration addresses validated."); // DEBUG

    // Prepare the presale options
    const presaleOptionsArgs = {
      tokenDeposit: calculatedTokenDeposit,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale),
      listingRate: BigInt(rateLiquidity),
      liquidityBps: BigInt(parseInt(liquidityPercent) * 100),
      slippageBps: 500n, // 5% slippage
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration: BigInt(parseInt(liquidityLockDays) * 86400), // days to seconds
      vestingPercentage: useVesting ? BigInt(parseInt(vestingTgePercent) * 100) : 10000n, // 100% if not using vesting
      vestingDuration: useVesting ? BigInt(parseInt(vestingCycleDays) * 86400) : 0n, // days to seconds
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      whitelistType: BigInt(whitelistType), // Ensure this is converted to BigInt
      merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000", // Placeholder
      nftContractAddress: whitelistType === 2 && nftContractAddress ? nftContractAddress : zeroAddress,
    };
    // Use JSON.stringify with BigInt replacer for better logging of args
    console.log("[handleCreatePresale] Prepared presaleOptionsArgs:", JSON.stringify(presaleOptionsArgs, (key, value) => typeof value === 'bigint' ? value.toString() : value)); // DEBUG

    // Send the transaction
    console.log("[handleCreatePresale] Sending createPresale transaction..."); // DEBUG
    const txHash = await writeContractAsync({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "createPresale",
      args: [
        presaleOptionsArgs,
        tokenAddress,
        wethAddress,
        uniswapRouterAddress,
      ],
      value: ethToSend,
    });
    console.log("[handleCreatePresale] Transaction sent. Hash:", txHash); // DEBUG
    
    toast.info("Create Presale Transaction Sent", {
      description: "Waiting for confirmation...",
    });
    
    // Wait for transaction confirmation using publicClient
    // Note: The useEffect hook also waits for confirmation. Consider consolidating this logic.
    console.log("[handleCreatePresale] Waiting for transaction receipt for hash:", txHash); // DEBUG
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("[handleCreatePresale] Transaction receipt received:", receipt); // DEBUG
    
    // Extract presale address from logs
    let presaleAddress = null;
    console.log("[handleCreatePresale] Attempting to extract presale address from logs..."); // DEBUG
    // Extract from logs using the correct function
    if (receipt && receipt.logs) {
      // Assuming extractPresaleAddressFromLogs exists and works correctly
      // Need to ensure this helper function is robust
      try { // Add try/catch around extraction
         presaleAddress = extractPresaleAddressFromLogs(receipt.logs);
         console.log("[handleCreatePresale] Extracted presale address:", presaleAddress); // DEBUG
      } catch (logError) {
         console.error("[handleCreatePresale] Error extracting presale address from logs:", logError); // DEBUG
         presaleAddress = null; // Ensure it's null if extraction fails
      }
    } else {
       console.warn("[handleCreatePresale] Receipt or logs missing, cannot extract address."); // DEBUG
    }

    if (presaleAddress) {
      console.log("[handleCreatePresale] Presale created successfully. Address:", presaleAddress); // DEBUG
      toast.success("Presale Created Successfully!", {
        description: `Presale Address: ${presaleAddress}`,
      });
      // Navigation is handled in the useEffect hook based on isConfirmed and hash
      // Consider if explicit navigation is needed here as a fallback
    } else {
      console.error("[handleCreatePresale] Failed to extract presale address from logs."); // DEBUG
      throw new Error("Could not extract presale address from transaction logs.");
    }

  } catch (error: any) {
    console.error("[handleCreatePresale] Error caught in main try block:", error); // DEBUG
    const displayError =
      error?.shortMessage ||
      error?.message ||
      "An unknown error occurred during presale creation.";
    setActionError(`Presale creation failed: ${displayError}`);
    toast.error("Presale Creation Failed", { description: displayError });
  } finally { // Add finally block for exit log
     console.log("[handleCreatePresale] Function finished."); // DEBUG
  }
}

// Make sure to also include the extractPresaleAddressFromLogs function:
const extractPresaleAddressFromLogs = (logs: any[]): string | null => {
  for (const log of logs) {
    try {
      // Check if this log is from the factory contract
      if (log.address.toLowerCase() === factoryAddress?.toLowerCase()) {
        // Check if we have enough topics and extract the presale address
        if (log.topics.length >= 3) {
          // The presale address is the second indexed parameter (topics[2])
          const presaleAddressHex = `0x${log.topics[2].slice(-40)}`;
          if (isAddress(presaleAddressHex)) {
            return presaleAddressHex;
          }
        }
      }
    } catch (error) {
      console.error("Error parsing log for presale address:", error);
    }
  }
  return null;
};


  // --- Stage Validation Logic ---
  const validateStage1 = useCallback(() => {
    if (!tokenAddress || !isAddress(tokenAddress)) {
      toast.error("Validation Error", { description: "Please enter a valid Token Address." });
      return false;
    }
    if (tokenDecimals === undefined) {
      toast.error("Validation Error", { description: "Token decimals could not be loaded." });
      return false;
    }
    if (!ratePresale || parseFloat(ratePresale) <= 0) {
      toast.error("Validation Error", { description: "Presale Rate must be a positive number." });
      return false;
    }
    if (!rateLiquidity || parseFloat(rateLiquidity) <= 0) {
      toast.error("Validation Error", { description: "Listing Rate must be a positive number." });
      return false;
    }
    if (!hardCap || parseFloat(hardCap) <= 0) {
      toast.error("Validation Error", { description: "Hard Cap must be a positive number." });
      return false;
    }
    if (!softCap || parseFloat(softCap) <= 0) {
      toast.error("Validation Error", { description: "Soft Cap must be a positive number." });
      return false;
    }
    if (softCapParsed > hardCapParsed) {
      toast.error("Validation Error", { description: "Soft Cap cannot be greater than Hard Cap." });
      return false;
    }
    if (!minContribution || parseFloat(minContribution) <= 0) {
      toast.error("Validation Error", { description: "Min Contribution must be a positive number." });
      return false;
    }
    if (!maxContribution || parseFloat(maxContribution) <= 0) {
      toast.error("Validation Error", { description: "Max Contribution must be a positive number." });
      return false;
    }
    if (maxContributionParsed < minContributionParsed) {
      toast.error("Validation Error", { description: "Max Contribution must be greater than or equal to Min Contribution." });
      return false;
    }
    return true;
  }, [
    tokenAddress,
    tokenDecimals,
    ratePresale,
    rateLiquidity,
    hardCap,
    softCap,
    minContribution,
    maxContribution,
    softCapParsed,
    hardCapParsed,
    minContributionParsed,
    maxContributionParsed,
  ]);

  const validateStage2 = useCallback(() => {
    const liqPercentNum = parseInt(liquidityPercent || "0");
    if (liqPercentNum <= 0 || liqPercentNum > 100) {
      toast.error("Validation Error", { description: "Liquidity Percent must be between 1 and 100." });
      return false;
    }
    if (!liquidityLockDays || parseInt(liquidityLockDays) < 0) {
      toast.error("Validation Error", { description: "Liquidity Lock Days cannot be negative." });
      return false;
    }
    if (!startTime) {
      toast.error("Validation Error", { description: "Please select a Start Time." });
      return false;
    }
    if (!endTime) {
      toast.error("Validation Error", { description: "Please select an End Time." });
      return false;
    }
    if (endTime <= startTime) {
      toast.error("Validation Error", { description: "End Time must be after Start Time." });
      return false;
    }
    if (startTime <= new Date()) {
      toast.error("Validation Error", { description: "Start Time must be in the future." });
      return false;
    }
    if (!claimDelay || parseInt(claimDelay) < 0) {
      toast.error("Validation Error", { description: "Claim Delay cannot be negative." });
      return false;
    }
    if (useVesting) {
      const tgePercentNum = parseInt(vestingTgePercent || "0");
      if (tgePercentNum < 0 || tgePercentNum > 100) {
        toast.error("Validation Error", { description: "TGE Percent must be between 0 and 100." });
        return false;
      }
      if (!vestingCycleDays || parseInt(vestingCycleDays) <= 0) {
        toast.error("Validation Error", { description: "Vesting Cycle Length must be positive." });
        return false;
      }
      const cyclePercentNum = parseInt(vestingCyclePercent || "0");
      if (cyclePercentNum <= 0 || cyclePercentNum > 100) {
        toast.error("Validation Error", { description: "Vesting Cycle Release must be between 1 and 100." });
        return false;
      }
    }
    return true;
  }, [
    liquidityPercent,
    liquidityLockDays,
    startTime,
    endTime,
    claimDelay,
    useVesting,
    vestingTgePercent,
    vestingCycleDays,
    vestingCyclePercent,
  ]);

  const validateStage3 = useCallback(() => {
    if (whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress))) {
      toast.error("Validation Error", { description: "Please enter a valid NFT Contract Address for NFT whitelist." });
      return false;
    }
    if (isLoadingDepositCalc) {
      toast.warning("Calculation Pending", { description: "Waiting for token deposit calculation to complete." });
      return false;
    }
    if (depositCalcError || typeof calculatedTokenDeposit !== "bigint" || calculatedTokenDeposit <= 0n) {
      toast.error("Calculation Error", { description: `Could not calculate required token deposit. Error: ${depositCalcError?.message || "Unknown error"}` });
      return false;
    }
    if (!hasSufficientAllowance) {
      toast.error("Approval Error", { description: "Presale tokens not sufficiently approved. Please approve." });
      return false;
    }
    if (factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && !hasSufficientFeeTokenAllowance) {
      toast.error("Approval Error", { description: "Fee tokens not sufficiently approved. Please approve." });
      return false;
    }
    if (factoryCreationFee === undefined) {
      toast.error("Fee Error", { description: "Creation fee not loaded or invalid." });
      return false;
    }
    return true;
  }, [
    whitelistType,
    nftContractAddress,
    isLoadingDepositCalc,
    depositCalcError,
    calculatedTokenDeposit,
    hasSufficientAllowance,
    factoryFeeTokenAddress,
    hasSufficientFeeTokenAllowance,
    factoryCreationFee,
  ]);

  // Combined validation for final submission
  const validateAllStages = useCallback((showToast = false) => {
    if (!validateStage1()) {
      if (showToast) toast.error("Error in Stage 1", { description: "Please review Token & Basic Configuration." });
      setCurrentStage(1);
      return false;
    }
    if (!validateStage2()) {
      if (showToast) toast.error("Error in Stage 2", { description: "Please review Schedule & Distribution." });
      setCurrentStage(2);
      return false;
    }
    if (!validateStage3()) {
      if (showToast) toast.error("Error in Stage 3", { description: "Please review Security & Review." });
      setCurrentStage(3);
      return false;
    }
    return true;
  }, [validateStage1, validateStage2, validateStage3]);

  // --- Navigation Handlers ---
  const handleNextStage = () => {
    setActionError(""); // Clear previous errors
    if (currentStage === 1) {
      if (validateStage1()) {
        setCurrentStage(2);
      }
    } else if (currentStage === 2) {
      if (validateStage2()) {
        setCurrentStage(3);
      }
    }
  };

  const handlePreviousStage = () => {
    setActionError(""); // Clear previous errors
    setCurrentStage((prev) => Math.max(1, prev - 1));
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

  const isActionLoading = isWritePending || isConfirming || isApproving || isConfirmingApproval || isApprovingFeeToken || isConfirmingFeeTokenApproval;

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

  const stageTitles = [
    "Token & Basic Configuration",
    "Schedule & Distribution",
    "Security & Review",
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 py-12 px-4 md:px-6 lg:px-8">
        <Card className="max-w-4xl mx-auto border shadow-xl bg-background/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary-900 to-primary-800 text-primary-foreground rounded-t-lg px-6 py-8 relative">
            <div 
              className="absolute inset-0 opacity-10 mix-blend-overlay"
              style={{ backgroundImage: "url('/api/placeholder/1000/300')" }}
            ></div>
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
                <Rocket className="h-8 w-8" />
                Create New Presale
              </CardTitle>
              <CardDescription className="text-white/80 mt-2">
                Follow the steps below to launch your token presale.
              </CardDescription>
            </div>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 px-6">
              <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white" 
                  style={{ width: `${(currentStage / 3) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-white/80 mt-1.5">
                <span>Stage {currentStage} of 3</span>
                <span>{stageTitles[currentStage - 1]}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* Stage 1: Token & Basic Configuration */}
            {currentStage === 1 && (
              <div className="space-y-8 animate-fade-in">
                {/* Token Address */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Token Details
                    </h3>
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
                          let val = e.target.value.replace(/\s+/g, "");
                          let pfx = "";
                          if (val.toLowerCase().startsWith("0x")) {
                            pfx = val.substring(0, 2);
                            val = val.substring(2);
                          }
                          val = val.replace(/[^0-9a-fA-F]/gi, "").substring(0, 40);
                          setTokenAddress((pfx + val) as Address);
                        }}
                        disabled={isActionLoading}
                        className={`text-foreground pr-10 font-mono text-sm ${
                          tokenAddress && !isAddress(tokenAddress) ? "border-destructive focus-visible:ring-destructive" : ""
                        }`}
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
                    {tokenAddress && !isAddress(tokenAddress) && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="mr-2 h-4 w-4" /> 
                        {(tokenAddress as string).startsWith("0x") ? (
                          (tokenAddress as string).length < 42 ? 
                            `Address is ${42 - (tokenAddress as string).length} character${42 - (tokenAddress as string).length === 1 ? '' : 's'} short` : 
                            (tokenAddress as string).length > 42 ? 
                              `Address is ${(tokenAddress as string).length - 42} character${(tokenAddress as string).length - 42 === 1 ? '' : 's'} too long` : 
                              "Invalid address format"
                        ) : "Address must start with 0x"}
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

{/* Image Upload Section */}
<div className="space-y-4 mt-6">
  <Label htmlFor="presaleImage">Presale Image (Optional)</Label>
  <div className="flex flex-col space-y-2">
    {imagePreview && (
      <div className="relative w-full h-48 bg-muted rounded-md overflow-hidden">
        <img 
          src={imagePreview} 
          alt="Presale preview" 
          className="w-full h-full object-cover"
        />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2"
          onClick={() => {
            setPresaleImage(null);
            setImagePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )}
    
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          ref={fileInputRef}
          id="presaleImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="flex-1"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Image className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
    
    <p className="text-xs text-muted-foreground">
      Recommended: Square image (800x800px). Max size: 2MB. Formats: JPG, PNG, WebP.
    </p>
  </div>
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
                        Minimum amount each participant can contribute.
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
                        Maximum amount each participant can contribute.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Stage 2: Schedule & Distribution */}
            {currentStage === 2 && (
              <div className="space-y-8 animate-fade-in">
                {/* Dates & Times */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Schedule
                    </h3>
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

                {/* Liquidity Settings */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Liquidity Settings
                    </h3>
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
                          className="text-foreground pr-8"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                          %
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Percentage of raised ETH used for Uniswap liquidity.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="liquidityLockDays"
                        className="text-base font-medium flex items-center"
                      >
                        Liquidity Lock (Days){" "}
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

                {/* Vesting Options */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Distribution & Vesting
                    </h3>
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

                {/* Leftover Token Handling */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Unsold Tokens
                    </h3>
                  </div>
                  <div className="space-y-3 animate-slide-up">
                    <Label
                      htmlFor="leftoverTokenOption"
                      className="text-base font-medium flex items-center"
                    >
                      Handling Unsold Tokens{" "}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    <Select
                      value={leftoverTokenOption.toString()}
                      onValueChange={(value) =>
                        setLeftoverTokenOption(parseInt(value))
                      }
                      disabled={isActionLoading}
                    >
                      <SelectTrigger
                        id="leftoverTokenOption"
                        className="text-foreground border-input"
                      >
                        <SelectValue placeholder="Select option..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input text-popover-foreground">
                        <SelectItem value="0">Burn Unsold Tokens</SelectItem>
                        <SelectItem value="1">Refund to Creator</SelectItem>
                        <SelectItem value="2">Add to Liquidity</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose what happens to tokens not sold during the presale.
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* Stage 3: Security & Review */}
            {currentStage === 3 && (
              <div className="space-y-8 animate-fade-in">
                {/* Whitelist Configuration */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Whitelist Configuration
                    </h3>
                  </div>
                  <div className="space-y-3 animate-slide-up">
                    <Label
                      htmlFor="whitelistType"
                      className="text-base font-medium flex items-center"
                    >
                      Whitelist Type
                    </Label>
                    <Select
                      value={whitelistType.toString()}
                      onValueChange={(value) =>
                        setWhitelistType(parseInt(value))
                      }
                      disabled={isActionLoading}
                    >
                      <SelectTrigger
                        id="whitelistType"
                        className="text-foreground border-input"
                      >
                        <SelectValue placeholder="Select whitelist type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input text-popover-foreground">
                        <SelectItem value="0">None (Public)</SelectItem>
                        <SelectItem value="1" disabled>
                          Merkle Proof (Coming Soon)
                        </SelectItem>
                        <SelectItem value="2">NFT Holder</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Restrict participation based on criteria.
                    </p>
                  </div>

                  {whitelistType === 2 && (
                    <div className="space-y-3 animate-slide-up">
                      <Label
                        htmlFor="nftContractAddress"
                        className="text-base font-medium flex items-center"
                      >
                        NFT Contract Address{" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="nftContractAddress"
                          placeholder="0x..."
                          value={nftContractAddress}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\s+/g, "");
                            let pfx = "";
                            if (val.toLowerCase().startsWith("0x")) {
                              pfx = val.substring(0, 2);
                              val = val.substring(2);
                            }
                            val = val.replace(/[^0-9a-fA-F]/gi, "").substring(0, 40);
                            setNftContractAddress((pfx + val) as Address);
                          }}
                          disabled={isActionLoading}
                          className="text-foreground pr-10 font-mono text-sm"
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
                      <p className="text-sm text-muted-foreground">
                        Enter the contract address of the required NFT collection.
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
                          isLoadingFactoryFeeToken ||
                          isActionLoading
                        }
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg py-6 hover:from-yellow-600 hover:to-orange-600"
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
                          isConfirmingFeeTokenApproval ||
                          isActionLoading
                        }
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg py-6 hover:from-yellow-600 hover:to-orange-600"
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
    isUploadingImage || // Add this condition
    isLoadingFactoryCreationFee ||
    isLoadingFactoryFeeToken ||
    isActionLoading
  }
  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg py-6 hover:from-green-600 hover:to-emerald-700"
>
  {isWritePending || isConfirming || isUploadingImage ? ( // Add isUploadingImage
    <>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
      {isUploadingImage 
        ? "Uploading Image..." 
        : "Creating Presale..."}
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
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-12 border-t pt-6">
              <Button
                variant="outline"
                onClick={handlePreviousStage}
                disabled={currentStage === 1 || isActionLoading}
                className="text-lg py-6 px-8"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
              </Button>
              {currentStage < 3 ? (
                <Button
                  onClick={handleNextStage}
                  disabled={isActionLoading}
                  className="text-lg py-6 px-8 bg-gradient-to-r from-primary-900 to-primary-800 text-white hover:from-primary-800 hover:to-primary-700"
                >
                  Next
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                // Render the final action buttons directly here or keep them in Stage 3 section
                // For clarity, keeping the final action buttons within Stage 3 section above
                // This button is effectively replaced by the Approve/Create buttons in Stage 3
                <div className="w-[136px]"></div> // Placeholder to maintain layout
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default CreatePresalePage;
