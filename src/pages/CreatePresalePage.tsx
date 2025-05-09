import { useState, useEffect, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useFeeData, useReadContract } from "wagmi";
import { parseUnits, zeroAddress, type Abi, formatUnits, encodeFunctionData, type Address, isAddress, maxUint256 } from "viem"; // Added maxUint256
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import ERC20Json from "@/abis/ERC20.json"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, CalendarIcon, Info, Loader2, ServerCrash, X } from "lucide-react"; // Added Loader2
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EstimatedFeeDisplay } from "@/pages/PresaleDetailPage";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMinutes, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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
        console.error("VITE_PRESALE_FACTORY_ADDRESS is missing or invalid in environment variables.");
    }

    const envWeth = import.meta.env.VITE_WETH_ADDRESS;
    if (envWeth && typeof envWeth === "string" && isAddress(envWeth)) {
        wethAddress = envWeth;
    } else {
        console.error("VITE_WETH_ADDRESS is missing or invalid in environment variables.");
    }

    const envRouter = import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS;
    if (envRouter && typeof envRouter === "string" && isAddress(envRouter)) {
        uniswapRouterAddress = envRouter;
    } else {
        console.error("VITE_UNISWAP_ROUTER_ADDRESS is missing or invalid in environment variables.");
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
        if (maxDecimalPlaces !== undefined && parts[1] && parts[1].length > maxDecimalPlaces) {
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
    if (sanitizedValue.length > 1 && sanitizedValue.startsWith("0") && !sanitizedValue.startsWith("0.")) {
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
        } catch { /* Ignore parsing errors */ }
    }

    setter(sanitizedValue);
};

const CreatePresalePage = () => {
    const navigate = useNavigate();
    const { address: userAddress, isConnected } = useAccount();
    const { writeContractAsync, data: hash, isPending: isWritePending } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
    const { data: feeData } = useFeeData();

    // --- Approval State & Hooks ---
    const [approvalHash, setApprovalHash] = useState<Address | undefined>();
    const { writeContractAsync: approveAsync } = useWriteContract(); // Removed isPending: isApprovingWrite
    const { isLoading: isConfirmingApproval, isSuccess: isApprovedSuccess } = useWaitForTransactionReceipt({ hash: approvalHash });

    // --- Fee Token Approval State & Hooks ---
    const [feeTokenApprovalHash, setFeeTokenApprovalHash] = useState<Address | undefined>();
    const { writeContractAsync: approveFeeTokenAsync } = useWriteContract();
    const { isLoading: isConfirmingFeeTokenApproval, isSuccess: isFeeTokenApprovedSuccess } = useWaitForTransactionReceipt({ hash: feeTokenApprovalHash });
    const [isApprovingFeeToken, setIsApprovingFeeToken] = useState(false);
    const [hasSufficientFeeTokenAllowance, setHasSufficientFeeTokenAllowance] = useState(false);

    // Form State
    const [tokenAddress, setTokenAddress] = useState<Address | "">("");
    const [currencyAddress] = useState<Address>(zeroAddress); // Assuming ETH presales only for now
    const [ratePresale, setRatePresale] = useState(DEFAULT_LISTING_RATE.toString());
    const [rateLiquidity, setRateLiquidity] = useState(DEFAULT_LIQUIDITY_RATE.toString());
    const [hardCap, setHardCap] = useState("");
    const [softCap, setSoftCap] = useState("");
    const [minContribution, setMinContribution] = useState("");
    const [maxContribution, setMaxContribution] = useState("");
    const [liquidityPercent, setLiquidityPercent] = useState(DEFAULT_LIQUIDITY_PERCENT.toString());
    const [liquidityLockDays, setLiquidityLockDays] = useState(DEFAULT_LIQUIDITY_LOCK_DAYS.toString());
    const [startTime, setStartTime] = useState<Date | undefined>(addMinutes(new Date(), DEFAULT_START_DELAY_MINUTES));
    const [endTime, setEndTime] = useState<Date | undefined>(addDays(new Date(), DEFAULT_END_DURATION_DAYS));
    const [claimDelay, setClaimDelay] = useState(DEFAULT_CLAIM_DELAY_MINUTES.toString());
    const [useVesting, setUseVesting] = useState(false);
    const [vestingTgePercent, setVestingTgePercent] = useState("10");
    const [vestingCycleDays, setVestingCycleDays] = useState("30");
    const [vestingCyclePercent, setVestingCyclePercent] = useState("10");    const [leftoverTokenOption, setLeftoverTokenOption] = useState(2); // Default to third option (index 2)

    // Whitelist State
    const [whitelistType, setWhitelistType] = useState<number>(0); // 0: None, 1: Merkle (Not Implemented), 2: NFT
    const [nftContractAddress, setNftContractAddress] = useState<Address | "">("");

    // UI/Error State
    const [actionError, setActionError] = useState("");
    const [configError, setConfigError] = useState<string | null>(null);
    const [isApproving, setIsApproving] = useState(false);
    const [hasSufficientAllowance, setHasSufficientAllowance] = useState(false);

    // --- Check Config Addresses --- 
    useEffect(() => {
        if (!factoryAddress) {
            setConfigError("Configuration Error: Presale Factory address is not set.");
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

    const { data: factoryCreationFeeData, isLoading: isLoadingFactoryCreationFee } = useReadContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "creationFee",
        query: { enabled: !!factoryAddress && isConnected },
    });
    const factoryCreationFee = useMemo(() => typeof factoryCreationFeeData === "bigint" ? factoryCreationFeeData : undefined, [factoryCreationFeeData]);

    const { data: factoryFeeTokenAddressData, isLoading: isLoadingFactoryFeeToken } = useReadContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "feeToken",
        query: { enabled: !!factoryAddress && isConnected },
    });
    const factoryFeeTokenAddress = useMemo(() => typeof factoryFeeTokenAddressData === "string" && isAddress(factoryFeeTokenAddressData) ? factoryFeeTokenAddressData : undefined, [factoryFeeTokenAddressData]);

    const { data: factoryFeeTokenDecimalsData, isLoading: isLoadingFactoryFeeTokenDecimals } = useReadContract({
        address: factoryFeeTokenAddress === zeroAddress ? undefined : factoryFeeTokenAddress, // Only fetch if it's an ERC20 token
        abi: erc20Abi,
        functionName: "decimals",
        query: { enabled: !!factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && isConnected },
    });
    const factoryFeeTokenDecimals = useMemo(() => {
        if (factoryFeeTokenAddress === zeroAddress) return 18; // ETH default
        return typeof factoryFeeTokenDecimalsData === "number" || typeof factoryFeeTokenDecimalsData === "bigint" ? Number(factoryFeeTokenDecimalsData) : undefined;
    }, [factoryFeeTokenAddress, factoryFeeTokenDecimalsData]);

    const { data: factoryFeeTokenSymbolData, isLoading: isLoadingFactoryFeeTokenSymbol } = useReadContract({
        address: factoryFeeTokenAddress === zeroAddress ? undefined : factoryFeeTokenAddress, // Only fetch if it's an ERC20 token
        abi: erc20Abi,
        functionName: "symbol",
        query: { enabled: !!factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && isConnected },
    });
    const factoryFeeTokenSymbol = useMemo(() => {
        if (factoryFeeTokenAddress === zeroAddress) return "ETH"; // ETH default
        return typeof factoryFeeTokenSymbolData === "string" ? factoryFeeTokenSymbolData : undefined;
    }, [factoryFeeTokenAddress, factoryFeeTokenSymbolData]);

    // --- Check Fee Token Allowance --- 
    const { data: currentFeeTokenAllowance, refetch: refetchFeeTokenAllowance } = useReadContract({
        address: factoryFeeTokenAddress === zeroAddress ? undefined : factoryFeeTokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress!, factoryAddress!],
        query: {
            enabled: !!factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && !!userAddress && !!factoryAddress && isConnected && factoryCreationFee !== undefined && factoryCreationFee > 0n,
        }
    });

    useEffect(() => {
        if (factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && typeof factoryCreationFee === "bigint" && typeof currentFeeTokenAllowance === "bigint") {
            setHasSufficientFeeTokenAllowance(currentFeeTokenAllowance >= factoryCreationFee);
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
        try { return parseUnits(hardCap || "0", currencyDecimals); } catch { return 0n; }
    }, [hardCap, currencyDecimals]);
    const softCapParsed = useMemo(() => {
        try { return parseUnits(softCap || "0", currencyDecimals); } catch { return 0n; }
    }, [softCap, currencyDecimals]);
    const minContributionParsed = useMemo(() => {
        try { return parseUnits(minContribution || "0", currencyDecimals); } catch { return 0n; }
    }, [minContribution, currencyDecimals]);
    const maxContributionParsed = useMemo(() => {
        try { return parseUnits(maxContribution || "0", currencyDecimals); } catch { return 0n; }
    }, [maxContribution, currencyDecimals]);

    // --- Fetch Token Decimals --- 
    const { data: tokenDecimalsData, isLoading: isLoadingTokenDecimals } = useReadContract({
        address: tokenAddress || undefined,
        abi: erc20Abi,
        functionName: "decimals",
        query: {
            enabled: !!tokenAddress && isAddress(tokenAddress),
        },
    });
    const tokenDecimals = useMemo(() => {
        return typeof tokenDecimalsData === "number" || typeof tokenDecimalsData === "bigint"
            ? Number(tokenDecimalsData)
            : undefined;
    }, [tokenDecimalsData]);

    // --- Calculate Required Token Deposit --- 
    const calculationOptions = useMemo(() => ({
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
        vestingPercentage: useVesting ? BigInt(parseInt(vestingTgePercent || "0") * 100) : 0n,
        vestingDuration: useVesting ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60) : 0n,
        leftoverTokenOption: BigInt(leftoverTokenOption),
        currency: currencyAddress,
        whitelistType: BigInt(whitelistType),
        merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000", // Default
        nftContractAddress: whitelistType === 2 && isAddress(nftContractAddress) ? nftContractAddress : zeroAddress,
    }), [
        hardCapParsed, softCapParsed, minContributionParsed, maxContributionParsed,
        ratePresale, rateLiquidity, liquidityPercent,
        calculatedStartTime, calculatedEndTime, liquidityLockDays,
        useVesting, vestingTgePercent, vestingCycleDays, leftoverTokenOption,
        currencyAddress, whitelistType, nftContractAddress
    ]);

    const { data: calculatedTokenDeposit, isLoading: isLoadingDepositCalc, error: depositCalcError } = useReadContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "calculateTotalTokensNeededForPresale",
        args: [calculationOptions, tokenAddress || zeroAddress],
        query: {
            enabled: !!factoryAddress &&
                !!tokenAddress && isAddress(tokenAddress) &&
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
    const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
        address: tokenAddress || undefined,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress!, factoryAddress!],
        query: {
            enabled: !!tokenAddress && isAddress(tokenAddress) && !!userAddress && !!factoryAddress && isConnected,
        }
    });

    useEffect(() => {
        if (typeof calculatedTokenDeposit === "bigint" && typeof currentAllowance === "bigint") {
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
    const presaleOptionsArgs = useMemo(() => ({
        tokenDeposit: typeof calculatedTokenDeposit === "bigint" ? calculatedTokenDeposit : 0n, // Use calculated value
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
        vestingPercentage: useVesting ? BigInt(parseInt(vestingTgePercent || "0") * 100) : 0n,
        vestingDuration: useVesting ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60) : 0n,
        leftoverTokenOption: BigInt(leftoverTokenOption),
        currency: currencyAddress,
        // --- Whitelist Params ---
        whitelistType: BigInt(whitelistType), // Use state variable
        merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000", // Default for now
        nftContractAddress: whitelistType === 2 && isAddress(nftContractAddress) ? nftContractAddress : zeroAddress, // Use state or zero address
    }), [
        calculatedTokenDeposit, hardCapParsed, softCapParsed, minContributionParsed, maxContributionParsed,
        ratePresale, rateLiquidity, liquidityPercent, calculatedStartTime, calculatedEndTime, liquidityLockDays,
        useVesting, vestingTgePercent, vestingCycleDays, leftoverTokenOption, currencyAddress, vestingCyclePercent,
        whitelistType, nftContractAddress // Added whitelist dependencies
    ]);

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
                uniswapRouterAddress ?? zeroAddress
            ]
        }),
        value: (factoryFeeTokenAddress === zeroAddress && typeof factoryCreationFee === 'bigint') ? factoryCreationFee : 0n, // Dynamic fee for gas estimation
        account: userAddress,
        query: {
            enabled: !!factoryAddress && !!wethAddress && !!uniswapRouterAddress && isConnected && !!tokenAddress &&
                hardCapParsed > 0n && softCapParsed > 0n &&
                presaleOptionsArgs.tokenDeposit > 0n && // Ensure deposit is calculated before estimating gas
                !isLoadingDepositCalc // Don't estimate if calculation is loading
        }
    });
    const calculateFee = (gas: bigint | undefined) => gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;
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
        if (!factoryFeeTokenAddress || factoryFeeTokenAddress === zeroAddress || !factoryAddress || typeof factoryCreationFee !== "bigint" || factoryCreationFee <= 0n) {
            toast.error("Fee Approval Error", { description: "Missing fee token address, factory address, or fee amount for approval." });
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
            toast.info("Fee Token Approval Sent", { description: "Waiting for confirmation..." });
        } catch (error: any) {
            console.error("Fee token approval error:", error);
            const displayError = error?.shortMessage || error?.message || "An unknown error occurred during fee token approval.";
            setActionError(`Fee token approval failed: ${displayError}`);
            toast.error("Fee Token Approval Failed", { description: displayError });
            setIsApprovingFeeToken(false);
        }
    };

    const handleApprove = async () => {
        if (!tokenAddress || !isAddress(tokenAddress) || !factoryAddress || typeof calculatedTokenDeposit !== 'bigint' || calculatedTokenDeposit <= 0n) {
            toast.error("Approval Error", { description: "Missing token address, factory address, or deposit amount for approval." });
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
            toast.info("Approval Transaction Sent", { description: "Waiting for confirmation..." });
        } catch (error: any) {
            console.error("Approval error:", error);
            const displayError = error?.shortMessage || error?.message || "An unknown error occurred during approval.";
            setActionError(`Approval failed: ${displayError}`);
            toast.error("Approval Failed", { description: displayError });
            setIsApproving(false);
        }
    };

    const handleCreatePresale = async () => {
        if (!factoryAddress || !wethAddress || !uniswapRouterAddress) {
            const missing = !factoryAddress ? "Factory" : !wethAddress ? "WETH" : "Router";
            setActionError(`Configuration Error: ${missing} address not available.`);
            toast.error("Config Error", { description: `${missing} address missing.` });
            return;
        }
        // Basic form validations (already present, ensure they are comprehensive)
        if (!isConnected || !tokenAddress || !isAddress(tokenAddress) || hardCapParsed <= 0n || softCapParsed <= 0n || minContributionParsed <= 0n || maxContributionParsed < minContributionParsed || !ratePresale || !rateLiquidity || !liquidityPercent || !liquidityLockDays || !startTime || !endTime || !claimDelay || (whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress)))) {
            setActionError("Please fill in all required fields correctly.");
            toast.error("Validation Error", { description: "Check all fields before creating." });
            return;
        }
        if (softCapParsed > hardCapParsed) {
            setActionError("Soft Cap cannot be greater than Hard Cap.");
            toast.error("Validation Error", { description: "Soft Cap cannot exceed Hard Cap." });
            return;
        }
        if (endTime <= startTime) {
            setActionError("End time must be after start time.");
            toast.error("Validation Error", { description: "End time must be after start time." });
            return;
        }
        if (startTime <= new Date()) {
            setActionError("Start time must be in the future.");
            toast.error("Validation Error", { description: "Start time must be in the future." });
            return;
        }
        if (isLoadingDepositCalc) {
            setActionError("Calculating required token deposit, please wait...");
            toast.warning("Calculation Pending", { description: "Waiting for token deposit calculation." });
            return;
        }
        if (depositCalcError || typeof calculatedTokenDeposit !== "bigint" || calculatedTokenDeposit <= 0n) {
            setActionError(`Failed to calculate required token deposit. Error: ${depositCalcError?.message || 'Unknown error'}`);
            toast.error("Calculation Error", { description: "Could not calculate token deposit." });
            return;
        }
        if (!hasSufficientAllowance) {
            setActionError("Approval Error: Presale tokens not sufficiently approved.");
            toast.error("Approval Error", { description: "Presale tokens not sufficiently approved." });
            return;
        }
        if (factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && !hasSufficientFeeTokenAllowance) {
            setActionError("Approval Error: Fee tokens not sufficiently approved.");
            toast.error("Approval Error", { description: "Fee tokens not sufficiently approved." });
            return;
        }
        if (factoryCreationFee === undefined) {
            setActionError("Fee Error: Creation fee not loaded or invalid.");
            toast.error("Fee Error", { description: "Creation fee not loaded or invalid." });
            return;
        }

        setActionError("");
        try {
            const ethToSend = (factoryFeeTokenAddress === zeroAddress && typeof factoryCreationFee === 'bigint') ? factoryCreationFee : 0n;

            await writeContractAsync({ // Removed const presaleTxHash assignment
                address: factoryAddress,
                abi: factoryAbi,
                functionName: "createPresale",
                args: [
                    presaleOptionsArgs, 
                    tokenAddress || zeroAddress,
                    wethAddress,
                    uniswapRouterAddress
                ],
                value: ethToSend, 
            });
            // Removed setHash(presaleTxHash); as 'hash' from useWriteContract hook is used by useWaitForTransactionReceipt
            toast.info("Create Presale Transaction Sent", { description: "Waiting for confirmation..." });
        } catch (error: any) {
            console.error("Create presale error:", error);
            const displayError = error?.shortMessage || error?.message || "An unknown error occurred during presale creation.";
            setActionError(`Presale creation failed: ${displayError}`);
            toast.error("Presale Creation Failed", { description: displayError });
        }
    };

    // --- Render Logic --- 
    if (configError) {
        return (
            <Alert variant="destructive">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>{configError}</AlertDescription>
            </Alert>
        );
    }

    if (!isConnected) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Wallet Not Connected</AlertTitle>
                <AlertDescription>Please connect your wallet to create a presale.</AlertDescription>
            </Alert>
        );
    }

    const isActionLoading = isWritePending || isConfirming;

    // Determine if calculation is possible
    const canCalculateDeposit = !!factoryAddress &&
        !!tokenAddress && isAddress(tokenAddress) &&
        hardCapParsed > 0n &&
        BigInt(ratePresale || "0") > 0n &&
        BigInt(rateLiquidity || "0") > 0n &&
        BigInt(parseInt(liquidityPercent || "0")) > 0n &&
        !isLoadingTokenDecimals &&
        tokenDecimals !== undefined;

    return (
        <Card className="max-w-3xl mx-auto">
            <CardHeader className="relative">
                <CardTitle>Create New Presale</CardTitle>
                <CardDescription>Configure and launch your token presale.</CardDescription>
                <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => navigate("/presales")} aria-label="Close">
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Token Address */}
                <div className="space-y-2">
                    <Label htmlFor="tokenAddress">Token Address *</Label>
                    <Input
                        id="tokenAddress"
                        placeholder="0x..."
                        value={tokenAddress}
                        onChange={(e) => setTokenAddress(e.target.value as Address)}
                        disabled={isActionLoading}
                    />
                    {isLoadingTokenDecimals && <p className="text-xs text-muted-foreground flex items-center"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Fetching token decimals...</p>}
                    {tokenAddress && isAddress(tokenAddress) && !isLoadingTokenDecimals && tokenDecimals === undefined && <p className="text-xs text-destructive">Could not fetch decimals for this token.</p>}
                    {tokenAddress && isAddress(tokenAddress) && !isLoadingTokenDecimals && tokenDecimals !== undefined && <p className="text-xs text-muted-foreground">Token Decimals: {tokenDecimals}</p>}
                    {!tokenAddress && <p className="text-xs text-muted-foreground">Enter the address of the token you want to sell.</p>}
                </div>

                {/* Currency (Hardcoded to ETH for now) */}
                <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value="ETH (Native Currency)" disabled />
                </div>

                {/* Rates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ratePresale">Presale Rate *</Label>
                        <Input
                            id="ratePresale"
                            type="text" // Change type to text to allow custom handling
                            inputMode="numeric" // Hint for mobile keyboards
                            placeholder={`e.g., ${DEFAULT_LISTING_RATE}`}
                            value={ratePresale}
                            onChange={(e) => handleNumericInput(e.target.value, setRatePresale, false)} // Use helper, no decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">How many tokens per 1 ETH?</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rateLiquidity">Listing Rate *</Label>
                        <Input
                            id="rateLiquidity"
                            type="text" // Change type to text
                            inputMode="numeric"
                            placeholder={`e.g., ${DEFAULT_LIQUIDITY_RATE}`}
                            value={rateLiquidity}
                            onChange={(e) => handleNumericInput(e.target.value, setRateLiquidity, false)} // Use helper, no decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Initial Uniswap listing rate (tokens per 1 ETH).</p>
                        <Alert variant="default" className="mt-2 border-blue-500/50 text-blue-700 dark:border-blue-500/30 dark:text-blue-300 [&>svg]:text-blue-500"> {/* Changed variant to default and added custom styling for info appearance */}
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                Note: The listing rate determines the initial price on the DEX. A lower rate compared to the presale rate can incentivize early buyers.
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>

                {/* Caps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="hardCap">Hard Cap (ETH) *</Label>
                        <Input
                            id="hardCap"
                            type="text" // Change type to text
                            inputMode="decimal" // Hint for mobile keyboards
                            placeholder="e.g., 100"
                            value={hardCap}
                            onChange={(e) => handleNumericInput(e.target.value, setHardCap, true, undefined, currencyDecimals)} // Use helper, allow decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Maximum ETH to raise. Presale ends if reached.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="softCap">Soft Cap (ETH) *</Label>
                        <Input
                            id="softCap"
                            type="text" // Change type to text
                            inputMode="decimal"
                            placeholder="e.g., 50"
                            value={softCap}
                            onChange={(e) => handleNumericInput(e.target.value, setSoftCap, true, undefined, currencyDecimals)} // Use helper, allow decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Minimum ETH needed for presale success. Must be less than or equal to Hard Cap.</p>
                    </div>
                </div>

                {/* Contributions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="minContribution">Min Contribution (ETH) *</Label>
                        <Input
                            id="minContribution"
                            type="text" // Change type to text
                            inputMode="decimal"
                            placeholder="e.g., 0.1"
                            value={minContribution}
                            onChange={(e) => handleNumericInput(e.target.value, setMinContribution, true, undefined, currencyDecimals)} // Use helper, allow decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Minimum ETH contribution allowed per wallet. Must be less than or equal to Soft Cap.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxContribution">Max Contribution (ETH) *</Label>
                        <Input
                            id="maxContribution"
                            type="text" // Change type to text
                            inputMode="decimal"
                            placeholder="e.g., 5"
                            value={maxContribution}
                            onChange={(e) => handleNumericInput(e.target.value, setMaxContribution, true, undefined, currencyDecimals)} // Use helper, allow decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Maximum ETH contribution allowed per wallet. Must be greater than or equal to Min Contribution.</p>
                    </div>
                </div>

                {/* Liquidity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="liquidityPercent">Liquidity Percent (%) *</Label>
                        <Input
                            id="liquidityPercent"
                            type="text" // Change type to text
                            inputMode="numeric"
                            placeholder={`e.g., ${DEFAULT_LIQUIDITY_PERCENT}`}
                            value={liquidityPercent}
                            onChange={(e) => handleNumericInput(e.target.value, setLiquidityPercent, false, 3, 0, 100)} // Use helper, no decimals, max 100
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">Percentage of raised funds to add to Uniswap liquidity (Min 51%).</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="liquidityLockDays">Liquidity Lockup (Days) *</Label>
                        <Input
                            id="liquidityLockDays"
                            type="text" // Change type to text
                            inputMode="numeric"
                            placeholder={`e.g., ${DEFAULT_LIQUIDITY_LOCK_DAYS}`}
                            value={liquidityLockDays}
                            onChange={(e) => handleNumericInput(e.target.value, setLiquidityLockDays, false)} // Use helper, no decimals
                            disabled={isActionLoading}
                        />
                        <p className="text-xs text-muted-foreground">How many days the Uniswap liquidity will be locked.</p>
                    </div>
                </div>

                {/* Dates & Times */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="startTime">Start Time *</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !startTime && "text-muted-foreground"
                                    )}
                                    disabled={isActionLoading}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {startTime ? format(startTime, "PPP HH:mm") : <span>Pick a date and time</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={startTime}
                                    onSelect={setStartTime}
                                    initialFocus
                                />
                                <div className="p-3 border-t border-border">
                                    <Input
                                        type="time"
                                        value={startTime ? format(startTime, "HH:mm") : ""}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(":").map(Number);
                                            const newDate = startTime ? new Date(startTime) : new Date();
                                            newDate.setHours(hours, minutes);
                                            setStartTime(newDate);
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">When the presale starts (UTC).</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="endTime">End Time *</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !endTime && "text-muted-foreground"
                                    )}
                                    disabled={isActionLoading}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {endTime ? format(endTime, "PPP HH:mm") : <span>Pick a date and time</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={endTime}
                                    onSelect={setEndTime}
                                    initialFocus
                                />
                                <div className="p-3 border-t border-border">
                                    <Input
                                        type="time"
                                        value={endTime ? format(endTime, "HH:mm") : ""}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(":").map(Number);
                                            const newDate = endTime ? new Date(endTime) : new Date();
                                            newDate.setHours(hours, minutes);
                                            setEndTime(newDate);
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">When the presale ends (UTC).</p>
                    </div>
                </div>

                {/* Claim Delay */}
                <div className="space-y-2">
                    <Label htmlFor="claimDelay">Claim Delay (Minutes) *</Label>
                    <Input
                        id="claimDelay"
                        type="text" // Change type to text
                        inputMode="numeric"
                        placeholder={`e.g., ${DEFAULT_CLAIM_DELAY_MINUTES}`}
                        value={claimDelay}
                        onChange={(e) => handleNumericInput(e.target.value, setClaimDelay, false)} // Use helper, no decimals
                        disabled={isActionLoading}
                    />
                    <p className="text-xs text-muted-foreground">Delay in minutes after presale end before users can claim tokens.</p>
                </div>

                {/* Vesting Options */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                            <Checkbox id="useVesting" checked={useVesting} onCheckedChange={(checked) => setUseVesting(Boolean(checked))} className="mr-2" disabled={isActionLoading} />
                            <Label htmlFor="useVesting" className="cursor-pointer">Enable Vesting (Optional)</Label>
                        </CardTitle>
                        <CardDescription>Distribute tokens over time after the initial claim.</CardDescription>
                    </CardHeader>
                    {useVesting && (
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vestingTgePercent">TGE Percent (%) *</Label>
                                    <Input
                                        id="vestingTgePercent"
                                        type="text" // Change type to text
                                        inputMode="numeric"
                                        placeholder="e.g., 10"
                                        value={vestingTgePercent}
                                        onChange={(e) => handleNumericInput(e.target.value, setVestingTgePercent, false, 3, 0, 100)} // Use helper, no decimals, max 100
                                        disabled={isActionLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">Percentage released at Token Generation Event (claim time).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vestingCycleDays">Cycle Length (Days) *</Label>
                                    <Input
                                        id="vestingCycleDays"
                                        type="text" // Change type to text
                                        inputMode="numeric"
                                        placeholder="e.g., 30"
                                        value={vestingCycleDays}
                                        onChange={(e) => handleNumericInput(e.target.value, setVestingCycleDays, false)} // Use helper, no decimals
                                        disabled={isActionLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">Duration of each vesting cycle in days.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vestingCyclePercent">Cycle Release (%) *</Label>
                                    <Input
                                        id="vestingCyclePercent"
                                        type="text" // Change type to text
                                        inputMode="numeric"
                                        placeholder="e.g., 10"
                                        value={vestingCyclePercent}
                                        onChange={(e) => handleNumericInput(e.target.value, setVestingCyclePercent, false, 3, 0, 100)} // Use helper, no decimals, max 100
                                        disabled={isActionLoading}
                                    />
                                    <p className="text-xs text-muted-foreground">Percentage released each cycle.</p>
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Leftover Tokens */}
                <div className="space-y-2">
                    <Label htmlFor="leftoverTokenOption">Unsold Token Handling *</Label>
                    <Select onValueChange={(value) => setLeftoverTokenOption(Number(value))} defaultValue={leftoverTokenOption.toString()} disabled={isActionLoading}>
                        <SelectTrigger id="leftoverTokenOption">
                            <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Burn</SelectItem>
                            <SelectItem value="1">Refund to Creator</SelectItem>
                            <SelectItem value="2">Send to Treasury (Requires Treasury Address)</SelectItem> {/* Assuming index 2 */}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Choose what happens to tokens not sold during the presale.</p>
                        </div>

                        {/* Whitelist Options */}
                        <div className="space-y-2">
                            <Label htmlFor="whitelist-type">Whitelist Type</Label>
                            <Select value={whitelistType.toString()} onValueChange={(value) => setWhitelistType(parseInt(value))}>
                                <SelectTrigger id="whitelist-type">
                                    <SelectValue placeholder="Select whitelist type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">None (Public)</SelectItem>
                                    <SelectItem value="2">NFT Holder</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {whitelistType === 2 && (
                            <div className="space-y-2">
                                <Label htmlFor="nft-address">NFT Contract Address</Label>
                                <Input
                                    id="nft-address"
                                    value={nftContractAddress}
                                    onChange={(e) => setNftContractAddress(e.target.value as Address)}
                                    placeholder="0x..."
                                />
                                {whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress)) ? (
                                    <p className="text-xs text-destructive">Please enter a valid NFT contract address.</p>
                                ) : null}
                            </div>
                        )}{/* TODO: Add Treasury Address input if option 2 is selected */}

                {/* Calculated Token Deposit Display */}
                <div className="space-y-2">
                    <Label>Required Token Deposit</Label>
                    <div className="p-3 border rounded-md bg-muted text-muted-foreground min-h-[40px] flex items-center">
                        {isLoadingDepositCalc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                        {canCalculateDeposit && !isLoadingDepositCalc && typeof calculatedTokenDeposit === "bigint" && tokenDecimals !== undefined ? (
                            <span>{formatUnits(calculatedTokenDeposit, tokenDecimals)} Tokens</span>
                        ) : canCalculateDeposit && isLoadingDepositCalc ? (
                            <span>Calculating...</span>
                        ) : depositCalcError ? (
                            <span className="text-destructive text-xs">Error calculating deposit.</span>
                        ) : (
                            <span className="text-xs">Fill required fields (Token, Caps, Rates, Liquidity %) to calculate.</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">Total tokens needed for presale + liquidity. This amount will be transferred from your wallet upon creation.</p>
                </div>

                {/* Fees & Summary */}
                <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Summary & Fees</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span>Creation Fee:</span>
                                <span>
                                    {isLoadingFactoryCreationFee || isLoadingFactoryFeeToken || isLoadingFactoryFeeTokenDecimals || isLoadingFactoryFeeTokenSymbol ? (
                                        <span className="flex items-center"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Loading fee...</span>
                                    ) : factoryCreationFee !== undefined && factoryFeeTokenDecimals !== undefined && factoryFeeTokenSymbol ? (
                                        `${formatUnits(factoryCreationFee, factoryFeeTokenDecimals)} ${factoryFeeTokenSymbol}`
                                    ) : (
                                        <span className="text-destructive">Error loading fee</span>
                                    )}
                                </span>
                        </div>
                        {createFeeCost !== undefined && (
                            <EstimatedFeeDisplay label="Estimated Gas Fee:" fee={createFeeCost} />
                        )}
                        {actionError && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{actionError}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Action Buttons */}
                {isConnected && tokenAddress && isAddress(tokenAddress) && factoryAddress && typeof calculatedTokenDeposit === "bigint" && calculatedTokenDeposit > 0n && factoryCreationFee !== undefined && factoryFeeTokenAddress !== undefined && !configError ? (
                    !hasSufficientAllowance ? (
                        <Button
                            onClick={handleApprove} // Approve Presale Token
                            disabled={isLoadingDepositCalc || isApproving || isConfirmingApproval || isLoadingFactoryCreationFee || isLoadingFactoryFeeToken}
                            className="w-full"
                            size="lg"
                        >
                            {isApproving || isConfirmingApproval ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving Presale Tokens...</>
                            ) : (
                                "Approve Presale Tokens"
                            )}
                        </Button>
                    ) : factoryFeeTokenAddress !== zeroAddress && factoryCreationFee > 0n && !hasSufficientFeeTokenAllowance ? (
                        <Button
                            onClick={handleApproveFeeToken} // Approve Fee Token
                            disabled={isLoadingFactoryCreationFee || isLoadingFactoryFeeToken || isApprovingFeeToken || isConfirmingFeeTokenApproval}
                            className="w-full"
                            size="lg"
                        >
                            {isApprovingFeeToken || isConfirmingFeeTokenApproval ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving Fee Token ({factoryFeeTokenSymbol})...</>
                            ) : (
                                `Approve ${factoryFeeTokenSymbol || "Fee Token"} for Creation Fee`
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCreatePresale}
                            disabled={isLoadingDepositCalc || isWritePending || isConfirming || isLoadingFactoryCreationFee || isLoadingFactoryFeeToken || (factoryFeeTokenAddress !== zeroAddress && factoryCreationFee > 0n && (isApprovingFeeToken || isConfirmingFeeTokenApproval))}
                            className="w-full"
                            size="lg"
                        >
                            {isWritePending || isConfirming ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Presale...</>
                            ) : (
                                "Create Presale"
                            )}
                        </Button>
                    )
                ) : (
                    <Button
                        disabled={true} // Disabled if prerequisites are not met
                        className="w-full"
                        size="lg"
                        title={configError || "Connect wallet and fill required fields to enable actions."}
                    >
                        {isLoadingFactoryCreationFee || isLoadingFactoryFeeToken || isLoadingDepositCalc ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading prerequisites...</> : "Create Presale"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};

export default CreatePresalePage;

