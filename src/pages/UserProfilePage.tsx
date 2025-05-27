import { useAccount, useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useFeeData } from "wagmi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertCircle, Info, RefreshCw, ArrowLeft, Fuel } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { type Abi, encodeFunctionData, type Address, formatUnits, isHex, zeroAddress, formatEther, erc20Abi } from "viem"; 
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import PresaleJson from "@/abis/Presale.json";
import { getPresaleStatus, cn, type PresaleStatusReturn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

import { FarcasterProfileSDKDisplay } from "@/components/FarcasterProfileSDKDisplay";


const factoryAbi = PresaleFactoryJson.abi as Abi;
const presaleAbi = PresaleJson.abi as Abi;
const factoryAddress = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS as Address;

const ensureString = (value: any, fallback: string = "N/A"): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (value && typeof value.message === "string") return value.message; 
    if (value && typeof value.toString === "function" && value.toString() !== "[object Object]") return value.toString();
    return fallback;
};

const shortenAddress = (address: string | undefined | null): string => {
    if (!address) return "N/A";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};



const EstimatedFeeDisplay = ({
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
      <Fuel className="h-3 w-3 mr-1" />~{formatEther(fee)} ETH
    </span>
  );
};

let currentPresaleOptionsForTimestampContext: any;

const formatTimestamp = (timestamp: bigint | number | undefined, fieldName?: string): string => {
    if (timestamp === undefined || timestamp === null) return "N/A";
    try {
        const numTimestamp = BigInt(timestamp);
        if (numTimestamp === 0n) {
            if (fieldName === "startTime" && (currentPresaleOptionsForTimestampContext?.state === 0 || currentPresaleOptionsForTimestampContext?.state === undefined)) return "Not Started Yet";
            return "Not Set"; 
        }
        const date = new Date(Number(numTimestamp) * 1000);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleString(); 
    } catch (e) {
        return "Invalid Timestamp";
    }
};

interface CreatorPresaleCardProps {
    presaleAddress: Address;
    refetchCreatedPresalesList: () => void; 
}

const CreatorPresaleCard: React.FC<CreatorPresaleCardProps> = ({ presaleAddress, refetchCreatedPresalesList }) => {
    const { address: userAddress } = useAccount();
    const { writeContractAsync, data: hash, isPending: isWritePending, reset: resetWriteContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash });
    const { data: feeData } = useFeeData();

    const [actionError, setActionError] = useState<string>("");
    const [dialogOpen, setDialogOpen] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState<string>("");

    const presaleContract = { address: presaleAddress, abi: presaleAbi } as const;

    const { data: presaleDetailsResults, isLoading: isLoadingDetails, refetch: refetchDetails, isError: isDetailsError, error: detailsErrorHook } = useReadContracts({
        allowFailure: true, 
        contracts: [
            { ...presaleContract, functionName: "options" },          
            { ...presaleContract, functionName: "state" },            
            { ...presaleContract, functionName: "paused" },           
            { ...presaleContract, functionName: "whitelistEnabled" }, 
            { ...presaleContract, functionName: "getTotalContributed" },
            { ...presaleContract, functionName: "owner" },
            { ...presaleContract, functionName: "token" }, // Added to fetch the presale token address
            { ...presaleContract, functionName: "ownerBalance" }, // Fetch ownerBalance
        ],
    });

    const ownerCallResult = presaleDetailsResults?.[5];
    const fetchedOwner = ownerCallResult?.status === "success" ? ownerCallResult.result as Address : undefined;
    const isOwner = !!userAddress && !!fetchedOwner && fetchedOwner.toLowerCase() === userAddress.toLowerCase();

    const optionsResult = presaleDetailsResults?.[0];
    const stateCallResult = presaleDetailsResults?.[1];
    const pausedCallResult = presaleDetailsResults?.[2];
    const whitelistEnabledCallResult = presaleDetailsResults?.[3];
    const totalContributedCallResult = presaleDetailsResults?.[4];
    const tokenAddressCallResult = presaleDetailsResults?.[6]; // Index for token() call
    const ownerBalanceCallResult = presaleDetailsResults?.[7]; // Index for ownerBalance() call

    const options = optionsResult?.status === "success" ? optionsResult.result as any[] : undefined;
    currentPresaleOptionsForTimestampContext = { state: stateCallResult?.status === "success" ? stateCallResult.result : undefined };

    const state = stateCallResult?.status === "success" ? stateCallResult.result as number : undefined;
    const paused = pausedCallResult?.status === "success" ? pausedCallResult.result as boolean : undefined;
    const whitelistEnabled = whitelistEnabledCallResult?.status === "success" ? whitelistEnabledCallResult.result as boolean : undefined;
    const ownerBalance = ownerBalanceCallResult?.status === "success" ? ownerBalanceCallResult.result as bigint : undefined;
   
    const presaleTokenAddress = tokenAddressCallResult?.status === "success" ? tokenAddressCallResult.result as Address : undefined;

    const { data: fetchedPresaleTokenSymbol, isLoading: isLoadingPresaleTokenSymbol } = useReadContract({
        address: presaleTokenAddress, // Use the address from token() call
        abi: erc20Abi,
        functionName: "symbol",
        query: { enabled: !!presaleTokenAddress },
    });
    const presaleTokenSymbol = fetchedPresaleTokenSymbol as string | undefined;

    const currencyAddressFromOptions = options?.[15] as Address | undefined;
    const currencyIsEth = currencyAddressFromOptions === zeroAddress;

    const { data: fetchedCurrencySymbol, isLoading: isLoadingCurrencySymbolCreator } = useReadContract({
        address: currencyAddressFromOptions,
        abi: erc20Abi,
        functionName: "symbol",
        query: { enabled: !!currencyAddressFromOptions && !currencyIsEth },
    });

    const { data: fetchedCurrencyDecimals, isLoading: isLoadingCurrencyDecimalsCreator } = useReadContract({
        address: currencyAddressFromOptions,
        abi: erc20Abi,
        functionName: "decimals",
        query: { enabled: !!currencyAddressFromOptions && !currencyIsEth },
    });

    const paymentDecimalsToUse = currencyIsEth ? 18 : (fetchedCurrencyDecimals as number | undefined);
    const paymentSymbolToUse = currencyIsEth ? "ETH" : (fetchedCurrencySymbol as string | undefined) ?? (paymentDecimalsToUse !== undefined ? "Tokens" : "raw units");

    useEffect(() => {
        if (isConfirmed && receipt) {
            toast.success("Action Confirmed!", { description: `Tx: ${ensureString(receipt.transactionHash)}` });
            setActionError("");
            setDialogOpen(null);
            setInputValue("");
            refetchCreatedPresalesList(); 
            refetchDetails();
            resetWriteContract();
        }
    }, [isConfirmed, receipt, refetchCreatedPresalesList, refetchDetails, resetWriteContract]);

    let totalContributed: bigint | undefined = undefined;
    if (totalContributedCallResult?.status === "success") {
        if (totalContributedCallResult.result === null || (isHex(totalContributedCallResult.result) && totalContributedCallResult.result === "0x")) {
            totalContributed = 0n; 
        } else {
            totalContributed = totalContributedCallResult.result as bigint;
        }
    }

    const presaleDataAvailable = options !== undefined && state !== undefined && paused !== undefined && whitelistEnabled !== undefined && totalContributed !== undefined && fetchedOwner !== undefined;
    const presaleStatus: PresaleStatusReturn = (presaleDataAvailable && state !== undefined && options !== undefined) ? getPresaleStatus(state, options) : { text: "Loading...", variant: "default" };
    
    const softCap = options?.[2] as bigint | undefined;
    const startTime = options?.[9] as bigint | undefined;
    const endTime = options?.[10] as bigint | undefined;

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

    const canFinalize = isOwner && presaleDataAvailable && state === 1 && endTime !== undefined && nowSeconds > endTime && totalContributed !== undefined && softCap !== undefined && totalContributed >= softCap;



    const canCancel = isOwner && presaleDataAvailable && (state === 0 || (state === 1 && totalContributed !== undefined && softCap !== undefined && totalContributed < softCap));

    const canWithdraw = isOwner && presaleDataAvailable && (state === 2 || state === 3) && ownerBalance !== undefined && ownerBalance > 0n; // Updated: Withdraw only possible in State 2 or 3 AND if ownerBalance > 0
    const canPauseUnpause = isOwner && presaleDataAvailable && state === 1;
    const canToggleWhitelist = isOwner && presaleDataAvailable && state === 0;
    const canExtendClaim = isOwner && presaleDataAvailable && state === 3; // Updated: Extend Claim only possible in State 3 (Finalized/Success)

    const { data: finalizeGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "finalize", args: [] }), account: userAddress, query: { enabled: !!userAddress && canFinalize } });
    
    const { data: cancelGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "cancel", args: [] }), account: userAddress, query: { enabled: !!userAddress && canCancel }});

    const { data: withdrawGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "withdraw", args: [] }), account: userAddress, query: { enabled: !!userAddress && canWithdraw }});

    const { data: pauseGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "pause", args: [] }), account: userAddress, query: { enabled: !!userAddress && canPauseUnpause && paused === false } });

    const { data: unpauseGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "unpause", args: [] }), account: userAddress, query: { enabled: !!userAddress && canPauseUnpause && paused === true } });

    const { data: toggleWhitelistGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "toggleWhitelist", args: [!(whitelistEnabled ?? false)] }), account: userAddress, query: { enabled: !!userAddress && canToggleWhitelist }});

    const { data: extendClaimGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "extendClaimDeadline", args: [BigInt(inputValue || "0")] }), account: userAddress, query: { enabled: !!userAddress && canExtendClaim && dialogOpen === "extendClaim" && !!inputValue && BigInt(inputValue) > 0 } });

    const isLoadingAdditionalData = (!currencyIsEth && (isLoadingCurrencySymbolCreator || isLoadingCurrencyDecimalsCreator)) || isLoadingPresaleTokenSymbol;

    if (isLoadingDetails || isLoadingAdditionalData) {
        return <Card className="animate-pulse"><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full mt-1" /></CardHeader><CardContent><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-8 w-full" /></CardContent></Card>;
    }

    let errorMessagesToDisplay: string[] = [];
    if (detailsErrorHook) errorMessagesToDisplay.push(ensureString(detailsErrorHook, "Presale details hook error."));
    presaleDetailsResults?.forEach(result => {
        if (result?.status === "failure" && result.error) {
            if (!(result === totalContributedCallResult && (result.error as any)?.message?.includes("returned no data"))) {
                 errorMessagesToDisplay.push(ensureString(result.error, "A contract call failed."));
            }
        }
    });
    if (totalContributedCallResult?.status === "failure" && (totalContributedCallResult.error as any)?.message?.includes("returned no data") && totalContributed === undefined) {
        errorMessagesToDisplay.push(ensureString(totalContributedCallResult.error, "Failed to get total contributed."));
    }

    const combinedDisplayError = errorMessagesToDisplay.length > 0 ? errorMessagesToDisplay.join("; ") : "Unknown error loading presale data.";

    if (isDetailsError || presaleDetailsResults?.some(r => r.status === "failure" && !(r === totalContributedCallResult && (r.error as any)?.message?.includes("returned no data") && totalContributed !== undefined ))) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium text-destructive">Error Loading Presale Data</CardTitle>
                    <CardDescription className="text-xs font-mono break-all pt-1">{ensureString(presaleAddress)}</CardDescription>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{combinedDisplayError}</p></CardContent>
            </Card>
        );
    }
    
    if (!isOwner) {
        return (
             <Card>
                 <CardHeader>
                     <CardTitle className="text-xs text-orange-500">Access Denied (Not Owner)</CardTitle>
                     <CardDescription className="text-xs font-mono break-all pt-1">{ensureString(presaleAddress)}</CardDescription>
                 </CardHeader>
                 <CardContent>
                    <p className="text-xs">You are not the owner of this presale.</p>
                 </CardContent>
             </Card>
        );
    }
    
    const calculateFee = (gas: bigint | undefined) => gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;

    const handleCreatorAction = async (functionName: string, args: any[] = [], actionName: string) => {
        if (!isOwner) {
            toast.error("Unauthorized", { description: "You are not the owner of this presale." });
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
            const detailedErrorText = ensureString(originalErrorMessage, `An unknown error occurred during ${actionName}.`);

            if (functionName === "finalize" &&
                (
                    (typeof originalErrorMessage === 'string' && (
                        originalErrorMessage.includes("User denied transaction signature") ||
                        originalErrorMessage.includes("User rejected the request")
                    )) ||
                    err.code === 4001 || // Standard EIP-1193 User Rejected Request
                    (err.cause && typeof err.cause === 'object' && (err.cause as any).code === 4001) // Wrapped EIP-1193
                )
            ) {
                toast.error("User cancel the finalize");
                setActionError("User cancel the finalize");
            } else if (functionName === "refund" &&
                (
                    (typeof originalErrorMessage === 'string' && (
                        originalErrorMessage.includes("User denied transaction signature") ||
                        originalErrorMessage.includes("User rejected the request")
                    )) ||
                    err.code === 4001 || // Standard EIP-1193 User Rejected Request
                    (err.cause && typeof err.cause === 'object' && (err.cause as any).code === 4001) // Wrapped EIP-1193
                )
            ) {
                toast.error("user reject refund");
                setActionError("user reject refund");
            } else {
                toast.error(`${actionName} Failed`, { description: detailedErrorText });
                setActionError(detailedErrorText);
            }
            console.error(`${actionName} error details:`, err); // Log the full error for debugging
        }
    };

    const formatCurrencyDisplay = (value: bigint | undefined, decimals: number | undefined, symbol: string): string => {
        if (value === undefined) return "N/A";
        if (decimals !== undefined) {
            return `${formatUnits(value, decimals)} ${symbol}`;
        }
        if (symbol !== "ETH" && value === 0n) return `0 ${symbol}`;
        if (symbol !== "ETH") return `${ensureString(value)} raw units (${symbol} details pending)`;
        return `${ensureString(value)} raw units`;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardTitle className="text-base font-medium">
                        <Badge variant={presaleStatus.variant} className="mr-2">{ensureString(presaleStatus.text, "Status N/A")}</Badge> 
                        {presaleTokenSymbol ? `${presaleTokenSymbol} Presale` : "Presale"}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => refetchDetails()} disabled={isWritePending || isConfirming || isLoadingDetails || isLoadingAdditionalData} className="h-6 w-6 self-end sm:self-center"><RefreshCw className={`h-3 w-3 ${isWritePending || isConfirming || isLoadingDetails || isLoadingAdditionalData ? "animate-spin" : ""}`} /></Button>
                </div>
                <CardDescription className="text-xs font-mono break-all pt-1">{ensureString(presaleAddress)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border">
                    <div>
                        <p className="font-medium text-foreground">Soft Cap:</p>
                        <p>{formatCurrencyDisplay(softCap, paymentDecimalsToUse, paymentSymbolToUse)}</p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground">Total Raised:</p>
                        <p>{formatCurrencyDisplay(totalContributed, paymentDecimalsToUse, paymentSymbolToUse)}</p>
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
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("finalize", [], "Finalize")} disabled={!canFinalize || isWritePending || isConfirming}>Finalize <EstimatedFeeDisplay fee={calculateFee(finalizeGas)} /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("cancel", [], "Cancel")} disabled={!canCancel || isWritePending || isConfirming}>Cancel <EstimatedFeeDisplay fee={calculateFee(cancelGas)} /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("withdraw", [], "Withdraw")} disabled={!canWithdraw || isWritePending || isConfirming}>Withdraw <EstimatedFeeDisplay fee={calculateFee(withdrawGas)} /></Button>
                    {canWithdraw && ownerBalance !== undefined && ownerBalance > 0n && (
                        <p className="text-xs text-muted-foreground self-center ml-2">
                            Withdrawable: {formatCurrencyDisplay(ownerBalance, paymentDecimalsToUse, paymentSymbolToUse)}
                        </p>
                    )}
                    {paused ? (
                        <Button size="sm" variant="outline" onClick={() => handleCreatorAction("unpause", [], "Unpause")} disabled={!canPauseUnpause || isWritePending || isConfirming}>Unpause <EstimatedFeeDisplay fee={calculateFee(unpauseGas)} /></Button>
                    ) : (
                        <Button size="sm" variant="outline" onClick={() => handleCreatorAction("pause", [], "Pause")} disabled={!canPauseUnpause || isWritePending || isConfirming}>Pause <EstimatedFeeDisplay fee={calculateFee(pauseGas)} /></Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("toggleWhitelist", [!(whitelistEnabled ?? false)], whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist")} disabled={!canToggleWhitelist || isWritePending || isConfirming}>
                        {whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist"} <EstimatedFeeDisplay fee={calculateFee(toggleWhitelistGas)} />
                    </Button>

                    <Dialog open={dialogOpen === "extendClaim"} onOpenChange={(isOpen) => !isOpen && setDialogOpen(null)}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setDialogOpen("extendClaim")} disabled={!canExtendClaim || isWritePending || isConfirming}>Extend Claim</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Extend Claim Deadline</DialogTitle></DialogHeader>
                            <Label htmlFor="extendTime">New Claim End Time (Unix Timestamp)</Label>
                            <Input id="extendTime" type="number" placeholder="e.g., 1735689600" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                            <EstimatedFeeDisplay fee={calculateFee(extendClaimGas)} />
                            <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                <Button onClick={() => handleCreatorAction("extendClaimDeadline", [BigInt(inputValue || "0")], "Extend Claim")} disabled={isWritePending || isConfirming || !inputValue || BigInt(inputValue || "0") <= (options?.[11] || 0n) || BigInt(inputValue || "0") <= nowSeconds }>
                                    Confirm <EstimatedFeeDisplay 
  fee={calculateFee(extendClaimGas)} 
 
/>

                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                {actionError && <Alert variant="destructive" className="mt-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{ensureString(actionError)}</AlertDescription></Alert>}
                {(isWritePending || isConfirming) && 
                    <Alert variant="default" className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription>{isConfirming ? "Confirming transaction..." : "Processing action..."} Tx: {shortenAddress(hash || undefined)}</AlertDescription>
                    </Alert>
                }
            </CardContent>
        </Card>
    );
};

interface ContributedPresaleCardProps {
    presaleAddress: Address;
    userAddress: Address;
    refetchContributedPresalesList: () => void;
}

const ContributedPresaleCard: React.FC<ContributedPresaleCardProps> = ({ presaleAddress, userAddress, refetchContributedPresalesList }) => {
    const { writeContractAsync, data: hash, isPending: isWritePending, reset: resetWriteContract } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash });
    const [actionError, setActionError] = useState<string>("");

    const presaleContract = { address: presaleAddress, abi: presaleAbi } as const;

    const { data: presaleInfo, isLoading: isLoadingPresaleInfo, refetch: refetchPresaleInfo, isError: isErrorInfoGeneralHook, error: errorInfoGeneralHook } = useReadContracts({
        allowFailure: true,
        contracts: [
            { ...presaleContract, functionName: "options" },
            { ...presaleContract, functionName: "state" },
            { ...presaleContract, functionName: "contributions", args: [userAddress as Address] },
            { ...presaleContract, functionName: "userClaimedAmount", args: [userAddress as Address] },
            { ...presaleContract, functionName: "getTotalContributed" },
            { ...presaleContract, functionName: "token" }, // Added to fetch the presale token address
        ],
        query: { enabled: !!userAddress && !!presaleAddress }
    });

    const optionsResult = presaleInfo?.[0];
    const stateResult = presaleInfo?.[1];
    const userContributionResult = presaleInfo?.[2];
    const userClaimedAmountResult = presaleInfo?.[3];
    const totalContributedResult = presaleInfo?.[4]; 
    const tokenAddressCallResultContributed = presaleInfo?.[5]; // Index for token() call

    const options = optionsResult?.status === "success" ? optionsResult.result as any[] : undefined;
    currentPresaleOptionsForTimestampContext = { state: stateResult?.status === "success" ? stateResult.result : undefined };
    const state = stateResult?.status === "success" ? stateResult.result as number : undefined;
    
    let userContributionRaw: bigint | undefined = undefined;
    if (userContributionResult?.status === "success") {
        if (userContributionResult.result === null || (isHex(userContributionResult.result) && userContributionResult.result === "0x")) {
            userContributionRaw = 0n;
        } else {
            userContributionRaw = userContributionResult.result as bigint;
        }
    }

    let userClaimedAmountRaw: bigint | undefined = undefined;
    if (userClaimedAmountResult?.status === "success") {
        if (userClaimedAmountResult.result === null || (isHex(userClaimedAmountResult.result) && userClaimedAmountResult.result === "0x")) {
            userClaimedAmountRaw = 0n;
        } else {
            userClaimedAmountRaw = userClaimedAmountResult.result as bigint;
        }
    }

    let totalPresaleContributed: bigint | undefined = undefined;
    if (totalContributedResult?.status === "success") {
        if (totalContributedResult.result === null || (isHex(totalContributedResult.result) && totalContributedResult.result === "0x")) {
            totalPresaleContributed = 0n;
        } else {
            totalPresaleContributed = totalContributedResult.result as bigint;
        }
    }

    const presaleTokenAddressContributed = tokenAddressCallResultContributed?.status === "success" ? tokenAddressCallResultContributed.result as Address : undefined;
    const paymentCurrencyAddress = options?.[15] as Address | undefined;
    const isNativePaymentContribution = paymentCurrencyAddress === zeroAddress;

    const softCap = options?.[2] as bigint | undefined;
    const startTime = options?.[9] as bigint | undefined;
    const endTime = options?.[10] as bigint | undefined;

    const { data: presaleTokenDetails, isLoading: isLoadingPresaleTokenDetails } = useReadContracts({
        allowFailure: true,
        contracts: [
            { address: presaleTokenAddressContributed, abi: erc20Abi, functionName: "decimals" },
            { address: presaleTokenAddressContributed, abi: erc20Abi, functionName: "symbol" },
        ]
    });
    const presaleTokenDecimals = presaleTokenDetails?.[0]?.status === "success" ? presaleTokenDetails[0].result as number : undefined;
    const presaleTokenSymbol = presaleTokenDetails?.[1]?.status === "success" ? presaleTokenDetails[1].result as string : undefined;

    const { data: paymentCurrencyDetails, isLoading: isLoadingPaymentCurrencyDetails } = useReadContracts({
        allowFailure: true,
        contracts: [
            { address: paymentCurrencyAddress, abi: erc20Abi, functionName: "decimals" },
            { address: paymentCurrencyAddress, abi: erc20Abi, functionName: "symbol" }
        ]
    });

    const paymentDecimalsForDisplay = isNativePaymentContribution ? 18 : (paymentCurrencyDetails?.[0]?.status === "success" ? paymentCurrencyDetails[0].result as number : undefined);
    const paymentSymbolForDisplay = isNativePaymentContribution ? "ETH" : (paymentCurrencyDetails?.[1]?.status === "success" ? paymentCurrencyDetails[1].result as string : undefined) ?? (paymentDecimalsForDisplay !== undefined ? "Tokens" : "raw units");

    const presaleStatus: PresaleStatusReturn = (options !== undefined && state !== undefined) ? getPresaleStatus(state, options) : { text: "Loading...", variant: "default" };

    const canClaim = state === 3 && userContributionRaw !== undefined && userContributionRaw > 0n && 
                     (userClaimedAmountRaw !== undefined ? userClaimedAmountRaw < userContributionRaw : true); // Updated: Claim only possible in State 3 (Finalized/Success)

    const canRefund = state === 2 && userContributionRaw !== undefined && userContributionRaw > 0n && 
                      (userClaimedAmountRaw !== undefined ? userClaimedAmountRaw === 0n : true); // Updated: Refund only possible in State 2 (Canceled/Failed)

    useEffect(() => {
        if (isConfirmed && receipt) {
            toast.success("Action Confirmed!", { description: `Tx: ${ensureString(receipt.transactionHash)}` });
            setActionError("");
            refetchPresaleInfo();
            refetchContributedPresalesList(); 
            resetWriteContract();
        }
    }, [isConfirmed, receipt, refetchPresaleInfo, refetchContributedPresalesList, resetWriteContract]);

    const handleUserAction = async (functionName: "claim" | "refund", actionName: string) => {
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

    const isLoadingAdditionalData = isLoadingPresaleTokenDetails || isLoadingPaymentCurrencyDetails;

    const formatCurrencyDisplay = (value: bigint | undefined, decimals: number | undefined, symbol: string): string => {
        if (value === undefined) return "N/A";
        if (decimals !== undefined) {
            return `${formatUnits(value, decimals)} ${symbol}`;
        }
        if (symbol !== "ETH" && value === 0n) return `0 ${symbol}`;
        if (symbol !== "ETH") return `${ensureString(value)} raw units (${symbol} details pending)`;
        return `${ensureString(value)} raw units`;
    };

    if (isLoadingPresaleInfo || isLoadingAdditionalData) {
        return <Card className="animate-pulse"><CardHeader><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2 mt-1" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /></div><div className="flex gap-2 mt-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-16" /></div></CardContent></Card>;
    }

    let errorMessages: string[] = [];
    if (errorInfoGeneralHook) errorMessages.push(ensureString(errorInfoGeneralHook, "General presale info hook error."));
    presaleInfo?.forEach(result => {
        if (result?.status === "failure" && result.error) {
            if (!(result === userClaimedAmountResult && (result.error as any)?.message?.includes("returned no data")) && 
                !(result === totalContributedResult && (result.error as any)?.message?.includes("returned no data"))) {
                 errorMessages.push(ensureString(result.error, "A contract call in presaleInfo failed."));
            }
        }
    });
    const combinedErrorMessage = errorMessages.length > 0 ? errorMessages.join("; ") : "Could not load necessary information.";
    const hasReadError = isErrorInfoGeneralHook || presaleInfo?.some(r => r.status === "failure" && 
        !(r === userClaimedAmountResult && (r.error as any)?.message?.includes("returned no data")) && 
        !(r === totalContributedResult && (r.error as any)?.message?.includes("returned no data")));

    if (hasReadError) {
        return (
            <Card>
                <CardHeader><CardTitle className="text-sm text-destructive">Error loading details for {shortenAddress(presaleAddress)}</CardTitle></CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{combinedErrorMessage}</p></CardContent>
            </Card>
        );
    }
    
    let contributionDisplay = "N/A";
    if (userContributionRaw !== undefined) {
        if (isNativePaymentContribution) {
            contributionDisplay = `${formatUnits(userContributionRaw, 18)} ETH`;
        } else if (paymentDecimalsForDisplay !== undefined) {
            contributionDisplay = `${formatUnits(userContributionRaw, paymentDecimalsForDisplay)} ${paymentSymbolForDisplay}`;
        } else {
            contributionDisplay = `${ensureString(userContributionRaw)} raw units (payment token details pending)`;
        }
    }

    let claimedDisplay = "N/A";
    if (userClaimedAmountRaw !== undefined) {
        if (presaleTokenDecimals !== undefined) {
            claimedDisplay = `${formatUnits(userClaimedAmountRaw, presaleTokenDecimals)} ${presaleTokenSymbol || "Tokens"}`;
        } else if (userClaimedAmountRaw === 0n) {
            claimedDisplay = `0 ${presaleTokenSymbol || "Tokens"} (details pending)`;
        } else {
            claimedDisplay = `${ensureString(userClaimedAmountRaw)} raw units (${presaleTokenSymbol || "Token"} details pending)`;
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                    <CardTitle className="text-sm font-medium">{presaleTokenSymbol ? `${presaleTokenSymbol} Presale` : "Presale"}: {shortenAddress(presaleAddress)}</CardTitle>
                    <Badge variant={presaleStatus.variant} className="text-xs self-start sm:self-center">{ensureString(presaleStatus.text, "Status N/A")}</Badge>
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
                        <p>{formatCurrencyDisplay(softCap, paymentDecimalsForDisplay, paymentSymbolForDisplay)}</p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground">Total Raised:</p>
                        <p>{formatCurrencyDisplay(totalPresaleContributed, paymentDecimalsForDisplay, paymentSymbolForDisplay)}</p>
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
                    <Button size="sm" onClick={() => handleUserAction("claim", "Claim")} disabled={!canClaim || isWritePending || isConfirming}>Claim</Button>
                    <Button size="sm" variant="outline" onClick={() => handleUserAction("refund", "Refund")} disabled={!canRefund || isWritePending || isConfirming}>Refund</Button>
                </div>
                {actionError && <Alert variant="destructive" className="mt-2"><AlertCircle className="h-4 w-4" /><AlertDescription>{ensureString(actionError)}</AlertDescription></Alert>}
                {(isWritePending || isConfirming) && 
                    <Alert variant="default" className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription>{isConfirming ? "Confirming transaction..." : "Processing action..."} Tx: {shortenAddress(hash || undefined)}</AlertDescription>
                    </Alert>
                }
            </CardContent>
        </Card>
    );
};

const UserProfilePage = () => {
    const { address, isConnected } = useAccount();
  
    const { data: allPresalesFromFactory, isLoading: isLoadingAllPresales, refetch: refetchAllPresalesFromFactory, error: errorAllPresales } = useReadContract({
        abi: factoryAbi,
        address: factoryAddress,
        functionName: "getAllPresales",
        query: {
            enabled: isConnected && !!address,
            select: (data) => data as Address[] | undefined,
        }
    });

    const { data: createdPresalesData, isLoading: isLoadingCreated, refetch: refetchCreatedPresales, isError: isErrorCreatedHook, error: errorCreatedHook } = useReadContracts({
        contracts: allPresalesFromFactory?.map(presaleAddress => ({
            abi: presaleAbi,
            address: presaleAddress,
            functionName: "owner",
        })) ?? [], 
        query: {
            enabled: !!allPresalesFromFactory && allPresalesFromFactory.length > 0 && isConnected && !!address,
            select: (results) => {
                return allPresalesFromFactory?.filter((_, index) => 
                    results[index]?.status === "success" && 
                    (results[index]?.result as Address | undefined)?.toLowerCase() === address?.toLowerCase()
                );
            }
        }
    });

    const { data: contributedPresalesAddresses, isLoading: isLoadingContributedAddresses, refetch: refetchContributedPresalesAddresses, isError: isErrorContributedAddressesHook, error: errorContributedAddressesHook } = useReadContracts({
        contracts: allPresalesFromFactory?.map(presaleAddress => ({
            abi: presaleAbi,
            address: presaleAddress,
            functionName: "contributions",
            args: [address as Address] 
        })) ?? [],
        query: {
            enabled: isConnected && !!address && !!allPresalesFromFactory && allPresalesFromFactory.length > 0,
            select: (results) => {
                return allPresalesFromFactory?.filter((_, index) => 
                    results[index]?.status === "success" && 
                    (results[index]?.result as bigint | undefined || BigInt(0)) > BigInt(0)
                );
            }
        }
    });

    const refetchAllData = () => {
        refetchAllPresalesFromFactory(); 
        refetchCreatedPresales();
        refetchContributedPresalesAddresses();
    }

    if (!isConnected || !address) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <Alert variant="default" className="max-w-md">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        Please connect your wallet to view your profile.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const isLoading = isLoadingAllPresales || isLoadingCreated || isLoadingContributedAddresses;

    const mainAddress = address || undefined;

    return (
        <div className="container mx-auto p-4 max-w-5xl">
            <div className="flex justify-end mb-4">
                <Link to="/presales">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Presales
                    </Button>
                </Link>
            </div>

            {/* Add the Farcaster Profile Section right here */}
<div className="mb-6">
   <FarcasterProfileSDKDisplay address={mainAddress} size="lg" showBadge={true} />

</div>

            <Tabs defaultValue="created">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
                    <TabsList className="grid w-full grid-cols-1 gap-1 sm:flex sm:w-auto sm:flex-wrap sm:gap-0">
                        <TabsTrigger value="created" className="w-full sm:w-auto">My Created ({createdPresalesData?.length || 0})</TabsTrigger>
                        <TabsTrigger value="contributed" className="w-full sm:w-auto">Contributed To ({contributedPresalesAddresses?.length || 0})</TabsTrigger>
                        <TabsTrigger value="vesting" disabled className="w-full sm:w-auto">My Vesting (0)</TabsTrigger>
                    </TabsList>
                    <Button variant="outline" size="sm" onClick={refetchAllData} disabled={isLoading} className="w-full mt-2 sm:mt-0 sm:w-auto flex-shrink-0">
                        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                        Refresh Data
                    </Button>
                </div>
                <TabsContent value="created">
                    {isLoadingCreated && <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">{[...Array(2)].map((_,i) => <Card key={i} className="animate-pulse"><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full mt-1" /></CardHeader><CardContent><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div>}
                    {errorAllPresales && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading all presales list: {ensureString(errorAllPresales.message)}</AlertDescription></Alert>}
                    {isErrorCreatedHook && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading created presales: {ensureString(errorCreatedHook?.message)}</AlertDescription></Alert>}
                    {!isLoadingCreated && !isErrorCreatedHook && !errorAllPresales && (
                        createdPresalesData && createdPresalesData.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                                {createdPresalesData.map((presaleAddr) => (
                                    <CreatorPresaleCard key={presaleAddr} presaleAddress={presaleAddr} refetchCreatedPresalesList={refetchCreatedPresales} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">You have not created any presales yet.</p>
                        )
                    )}
                </TabsContent>
                <TabsContent value="contributed">
                    {isLoadingContributedAddresses && <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">{[...Array(2)].map((_,i) => <Card key={i} className="animate-pulse"><CardHeader><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2 mt-1" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-4 w-1/2" /></div><div className="flex gap-2 mt-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-16" /></div></CardContent></Card>)}</div>}
                    {errorAllPresales && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading all presales list: {ensureString(errorAllPresales.message)}</AlertDescription></Alert>}
                    {isErrorContributedAddressesHook && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading list of contributed presales: {ensureString(errorContributedAddressesHook?.message)}</AlertDescription></Alert>}
                    {!isLoadingContributedAddresses && !isErrorContributedAddressesHook && !errorAllPresales && (
                        contributedPresalesAddresses && contributedPresalesAddresses.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                                {contributedPresalesAddresses.map((presaleAddr) => (
                                    <ContributedPresaleCard key={presaleAddr} presaleAddress={presaleAddr} userAddress={address} refetchContributedPresalesList={refetchContributedPresalesAddresses} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">You have not contributed to any presales yet.</p>
                        )
                    )}
                </TabsContent>
                <TabsContent value="vesting">
                    <p className="text-muted-foreground text-center py-4">Vesting details are not yet implemented.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default UserProfilePage;