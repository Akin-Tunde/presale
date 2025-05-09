import { useAccount, useEnsName, useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useFeeData } from "wagmi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertCircle, Info, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { type Abi, encodeFunctionData, type Address, formatUnits, isHex } from "viem"; 
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import PresaleJson from "@/abis/Presale.json";
import ERC20Json from "@/abis/ERC20.json"; 
import { getPresaleStatus, cn, type PresaleStatusReturn } from "@/lib/utils";
import { toast } from "sonner";
import { EstimatedFeeDisplay } from "@/pages/PresaleDetailPage";
import { Badge } from "@/components/ui/badge";

const factoryAbi = PresaleFactoryJson.abi as Abi;
const presaleAbi = PresaleJson.abi as Abi;
const erc20Abi = ERC20Json as Abi;
const factoryAddress = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS as Address;

// Helper to ensure a value is a string or a fallback for rendering
const ensureString = (value: any, fallback: string = "N/A"): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (value && typeof value.message === "string") return value.message; // Handle error objects
    if (value && typeof value.toString === "function" && value.toString() !== "[object Object]") return value.toString();
    return fallback;
};

const shortenAddress = (address: string | undefined | null): string => {
    if (!address) return "N/A";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const getEnsAvatar = (ensName: string | null | undefined): string | undefined => {
    if (!ensName) return undefined;
    return `https://metadata.ens.domains/mainnet/avatar/${ensName}`;
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
            { ...presaleContract, functionName: "getTotalContributed" }, // Corrected function name
            { ...presaleContract, functionName: "owner" },            
        ],
    });

    const ownerCallResult = presaleDetailsResults?.[5];
    const fetchedOwner = ownerCallResult?.status === "success" ? ownerCallResult.result as Address : undefined;
    const isOwner = !!userAddress && !!fetchedOwner && fetchedOwner.toLowerCase() === userAddress.toLowerCase();

    const optionsResult = presaleDetailsResults?.[0];
    const stateCallResult = presaleDetailsResults?.[1];
    const pausedCallResult = presaleDetailsResults?.[2];
    const whitelistEnabledCallResult = presaleDetailsResults?.[3];
    const totalContributedCallResult = presaleDetailsResults?.[4]; // Index remains 4

    const options = optionsResult?.status === "success" ? optionsResult.result : undefined;
    const state = stateCallResult?.status === "success" ? stateCallResult.result as number : undefined;
    const paused = pausedCallResult?.status === "success" ? pausedCallResult.result as boolean : undefined;
    const whitelistEnabled = whitelistEnabledCallResult?.status === "success" ? whitelistEnabledCallResult.result as boolean : undefined;
   
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
            totalContributed = 0n; // Interpret 0x as 0 for totalContributed
        } else {
            totalContributed = totalContributedCallResult.result as bigint;
        }
    }

    const presaleDataAvailable = options !== undefined && state !== undefined && paused !== undefined && whitelistEnabled !== undefined && totalContributed !== undefined && fetchedOwner !== undefined;

    const presaleStatus: PresaleStatusReturn = (presaleDataAvailable && state !== undefined && options !== undefined) ? getPresaleStatus(state, options) : { text: "Loading...", variant: "default" };
    const softCap = (options as any)?.softCap as bigint | undefined;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const endTime = (options as any)?.endTime as bigint | undefined;

    const canFinalize = isOwner && presaleDataAvailable && state === 1 && endTime !== undefined && nowSeconds > endTime && totalContributed !== undefined && softCap !== undefined && totalContributed >= softCap;
    const canCancel = isOwner && presaleDataAvailable && (state === 0 || (state === 1 && totalContributed !== undefined && softCap !== undefined && totalContributed < softCap));
    const canWithdraw = isOwner && presaleDataAvailable && (state === 2 || state === 3 || state === 4);
    const canPauseUnpause = isOwner && presaleDataAvailable && state === 1;
    const canToggleWhitelist = isOwner && presaleDataAvailable && state === 0;
    const canExtendClaim = isOwner && presaleDataAvailable && state === 2;

    const { data: finalizeGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "finalize", args: [] }), account: userAddress, query: { enabled: !!userAddress && canFinalize } });
    const { data: cancelGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "cancel", args: [] }), account: userAddress, query: { enabled: !!userAddress && canCancel }});
    const { data: withdrawGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "withdraw", args: [] }), account: userAddress, query: { enabled: !!userAddress && canWithdraw }});
    const { data: pauseGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "pause", args: [] }), account: userAddress, query: { enabled: !!userAddress && canPauseUnpause && paused === false } });
    const { data: unpauseGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "unpause", args: [] }), account: userAddress, query: { enabled: !!userAddress && canPauseUnpause && paused === true } });
    const { data: toggleWhitelistGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "toggleWhitelist", args: [!(whitelistEnabled ?? false)] }), account: userAddress, query: { enabled: !!userAddress && canToggleWhitelist }});
    const { data: extendClaimGas } = useEstimateGas({ to: presaleAddress, data: encodeFunctionData({ abi: presaleAbi, functionName: "extendClaimDeadline", args: [BigInt(inputValue || "0")] }), account: userAddress, query: { enabled: !!userAddress && canExtendClaim && dialogOpen === "extendClaim" && !!inputValue && BigInt(inputValue) > 0 } });



    if (isLoadingDetails) {
        return <Card className="animate-pulse"><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full mt-1" /></CardHeader><CardContent><Skeleton className="h-8 w-full" /></CardContent></Card>;
    }

    let errorMessagesToDisplay: string[] = [];
    if (detailsErrorHook) errorMessagesToDisplay.push(ensureString(detailsErrorHook, "Presale details hook error."));
    presaleDetailsResults?.forEach(result => {
        if (result?.status === "failure" && result.error) {
            // Avoid double-counting the "returned no data" for totalContributed if already handled by its specific logic
            if (!(result === totalContributedCallResult && (result.error as any)?.message?.includes("returned no data"))) {
                 errorMessagesToDisplay.push(ensureString(result.error, "A contract call failed."));
            }
        }
    });
    // If totalContributed specifically failed with "returned no data", but we interpreted it as 0n, don't add it to general errors unless it's the *only* issue.
    if (totalContributedCallResult?.status === "failure" && (totalContributedCallResult.error as any)?.message?.includes("returned no data") && totalContributed === undefined) {
        // Only add if totalContributed is still undefined (meaning our 0n fallback didn't apply or wasn't enough)
        errorMessagesToDisplay.push(ensureString(totalContributedCallResult.error, "Failed to get total contributed."));
    }

    const combinedDisplayError = errorMessagesToDisplay.length > 0 ? errorMessagesToDisplay.join("; ") : "Unknown error loading presale data.";

    if (isDetailsError || presaleDetailsResults?.some(r => r.status === "failure" && !(r === totalContributedCallResult && (r.error as any)?.message?.includes("returned no data") && totalContributed !== undefined ))) {
        // The condition now checks if totalContributed is NOT undefined when the specific error occurs, meaning we handled it as 0n.
        // If totalContributed IS undefined despite the specific error, then it's a true error display case.
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
            const msg = ensureString(err, `${actionName} failed.`);
            setActionError(msg);
            toast.error(`${actionName} Failed`, { description: msg });
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardTitle className="text-base font-medium">
                        <Badge variant={presaleStatus.variant} className="mr-2">{ensureString(presaleStatus.text, "Status N/A")}</Badge> Presale
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => refetchDetails()} disabled={isWritePending || isConfirming || isLoadingDetails} className="h-6 w-6 self-end sm:self-center"><RefreshCw className={`h-3 w-3 ${isWritePending || isConfirming || isLoadingDetails ? "animate-spin" : ""}`} /></Button>
                </div>
                <CardDescription className="text-xs font-mono break-all pt-1">{ensureString(presaleAddress)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("finalize", [], "Finalize")} disabled={!canFinalize || isWritePending || isConfirming}>Finalize <EstimatedFeeDisplay fee={calculateFee(finalizeGas)} /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("cancel", [], "Cancel")} disabled={!canCancel || isWritePending || isConfirming}>Cancel <EstimatedFeeDisplay fee={calculateFee(cancelGas)} /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("withdraw", [], "Withdraw")} disabled={!canWithdraw || isWritePending || isConfirming}>Withdraw <EstimatedFeeDisplay fee={calculateFee(withdrawGas)} /></Button>
                    {paused ? (
                        <Button size="sm" variant="outline" onClick={() => handleCreatorAction("unpause", [], "Unpause")} disabled={!canPauseUnpause || isWritePending || isConfirming}>Unpause <EstimatedFeeDisplay fee={calculateFee(unpauseGas)} /></Button>
                    ) : (
                        <Button size="sm" variant="outline" onClick={() => handleCreatorAction("pause", [], "Pause")} disabled={!canPauseUnpause || isWritePending || isConfirming}>Pause <EstimatedFeeDisplay fee={calculateFee(pauseGas)} /></Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleCreatorAction("toggleWhitelist", [!(whitelistEnabled ?? false)], whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist")} disabled={!canToggleWhitelist || isWritePending || isConfirming}>
                        {whitelistEnabled ? "Disable Whitelist" : "Enable Whitelist"} <EstimatedFeeDisplay fee={calculateFee(toggleWhitelistGas)} />
                    </Button>

                    <Dialog open={dialogOpen === "extendClaim"} onOpenChange={(open) => !open && setDialogOpen(null)}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setDialogOpen("extendClaim")} disabled={!canExtendClaim || isWritePending || isConfirming}>Extend Claim</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Extend Claim Deadline</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Label htmlFor="deadline">New Deadline (Unix Timestamp)</Label>
                                <Input id="deadline" type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                <Button onClick={() => handleCreatorAction("extendClaimDeadline", [BigInt(inputValue || "0")], "Extend Claim")} disabled={!inputValue || BigInt(inputValue || "0") <=0 || isWritePending || isConfirming}>Set Deadline <EstimatedFeeDisplay fee={calculateFee(extendClaimGas)} /></Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                     <Button size="sm" variant="outline" disabled title="Update Whitelist - Not Implemented">Update Whitelist</Button>
                     <Button size="sm" variant="outline" disabled title="Rescue Tokens - Not Implemented">Rescue Tokens</Button>
                </div>
                {actionError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{ensureString(actionError)}</AlertDescription></Alert>}
                {(isWritePending || isConfirming) && 
                    <Alert variant="default">
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
            { ...presaleContract, functionName: "contributions", args: [userAddress] }, 
            { ...presaleContract, functionName: "claimed", args: [userAddress] },       
        ]
    });

    const optionsResult = presaleInfo?.[0];
    const stateResult = presaleInfo?.[1];
    const userContributionResult = presaleInfo?.[2];
    const userClaimedAmountResult = presaleInfo?.[3];

    const options = optionsResult?.status === "success" ? optionsResult.result : undefined;
    const state = stateResult?.status === "success" ? stateResult.result as number : undefined;
    const userContributionRaw = userContributionResult?.status === "success" ? userContributionResult.result as bigint : undefined;
    
    let userClaimedAmountRaw: bigint | undefined = undefined;
    if (userClaimedAmountResult?.status === "success") {
        if (userClaimedAmountResult.result === null || (isHex(userClaimedAmountResult.result) && userClaimedAmountResult.result === "0x")) {
            userClaimedAmountRaw = 0n;
        } else {
            userClaimedAmountRaw = userClaimedAmountResult.result as bigint;
        }
    }

    const tokenAddress = (options as any)?.[0] as Address | undefined;
    const paymentTokenAddress = (options as any)?.[1] as Address | undefined;
    const isNativeContribution = (options as any)?.[10] as boolean | undefined;

    const { data: presaleTokenDecimalsData, isLoading: isLoadingPresaleTokenDecimals } = useReadContract({ address: tokenAddress, abi: erc20Abi, functionName: "decimals", query: { enabled: !!tokenAddress }});
    const presaleTokenDecimals = presaleTokenDecimalsData as number | undefined;

    const { data: paymentTokenDecimalsData, isLoading: isLoadingPaymentTokenDecimals } = useReadContract({ address: paymentTokenAddress, abi: erc20Abi, functionName: "decimals", query: { enabled: !!paymentTokenAddress && paymentTokenAddress !== "0x0000000000000000000000000000000000000000" && !isNativeContribution }});
    const paymentTokenDecimals = paymentTokenDecimalsData as number | undefined;

    const presaleStatus: PresaleStatusReturn = (options !== undefined && state !== undefined) ? getPresaleStatus(state, options) : { text: "Loading...", variant: "default" };

    const canClaim = (state === 2 || state === 4) && userContributionRaw !== undefined && userContributionRaw > 0n && 
                     (userClaimedAmountRaw !== undefined ? userClaimedAmountRaw < userContributionRaw : true);

    const canRefund = state === 3 && userContributionRaw !== undefined && userContributionRaw > 0n && 
                      (userClaimedAmountRaw !== undefined ? userClaimedAmountRaw === 0n : true);

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

    const isLoadingAnyDecimals = isLoadingPresaleTokenDecimals || (!!paymentTokenAddress && paymentTokenAddress !== "0x0000000000000000000000000000000000000000" && !isNativeContribution && isLoadingPaymentTokenDecimals);

    if (isLoadingPresaleInfo || isLoadingAnyDecimals) {
        return <Card className="animate-pulse"><CardHeader><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2 mt-1" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><div className="flex gap-2 mt-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-16" /></div></CardContent></Card>;
    }

    let errorMessages: string[] = [];
    if (errorInfoGeneralHook) errorMessages.push(ensureString(errorInfoGeneralHook, "General presale info hook error."));
    presaleInfo?.forEach(result => {
        if (result?.status === "failure" && result.error) {
            if (!(result === userClaimedAmountResult && (result.error as any)?.message?.includes("returned no data"))) {
                 errorMessages.push(ensureString(result.error, "A contract call in presaleInfo failed."));
            }
        }
    });
    const combinedErrorMessage = errorMessages.length > 0 ? errorMessages.join("; ") : "Could not load necessary information.";
    const hasReadError = isErrorInfoGeneralHook || presaleInfo?.some(r => r.status === "failure" && !(r === userClaimedAmountResult && (r.error as any)?.message?.includes("returned no data")));


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
        if (isNativeContribution) {
            contributionDisplay = `${formatUnits(userContributionRaw, 18)} ETH`;
        } else if (paymentTokenDecimals !== undefined) {
            contributionDisplay = `${formatUnits(userContributionRaw, paymentTokenDecimals)} Tokens`;
        } else {
            contributionDisplay = `${userContributionRaw.toString()} (raw units - payment token details unavailable)`;
        }
    }

    let claimedDisplay = "N/A";
    if (userClaimedAmountRaw !== undefined) {
        if (presaleTokenDecimals !== undefined) {
            claimedDisplay = `${formatUnits(userClaimedAmountRaw, presaleTokenDecimals)} Tokens`;
        } else if (userClaimedAmountRaw === 0n) {
            claimedDisplay = "0 Tokens (presale token details unavailable)";
        } else {
            claimedDisplay = `${userClaimedAmountRaw.toString()} (raw units - presale token details unavailable)`;
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                    <CardTitle className="text-sm font-medium">Presale: {shortenAddress(presaleAddress)}</CardTitle>
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
    const { data: ensName } = useEnsName({ address });
    const avatarUrl = getEnsAvatar(ensName || undefined);

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
    const mainEnsName = ensName || undefined;
    const mainAddress = address || undefined;

    return (
        <div className="container mx-auto p-4 max-w-5xl">
            {/* Back to Presale Button - Top Right of Content Area */}
            <div className="flex justify-end mb-4">
                <Link to="/presales">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Presales
                    </Button>
                </Link>
            </div>

            <Card className="mb-6">
                <CardHeader className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 sm:p-6">
                    <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                        <AvatarImage src={avatarUrl} alt={ensureString(mainEnsName || mainAddress, "User")} />
                        <AvatarFallback className="text-2xl sm:text-3xl">{ensureString(mainEnsName ? mainEnsName.substring(0, 2) : mainAddress ? mainAddress.substring(2, 4) : "U")}</AvatarFallback>
                    </Avatar>
                    <div className="text-center sm:text-left">
                        <CardTitle className="text-lg sm:text-xl break-all">{ensureString(mainEnsName || shortenAddress(mainAddress))}</CardTitle>
                        <CardDescription className="text-xs font-mono break-all mt-1">{ensureString(mainAddress)}</CardDescription>
                    </div>
                </CardHeader>
            </Card>

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
                    {isLoadingCreated && <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">{[...Array(2)].map((_,i) => <Card key={i} className="animate-pulse"><CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full mt-1" /></CardHeader><CardContent><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div>}
                    {errorAllPresales && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading all presales list: {ensureString(errorAllPresales)}</AlertDescription></Alert>}
                    {isErrorCreatedHook && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading created presales: {ensureString(errorCreatedHook)}</AlertDescription></Alert>}
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
                    {isLoadingContributedAddresses && <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">{[...Array(2)].map((_,i) => <Card key={i} className="animate-pulse"><CardHeader><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2 mt-1" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><div className="flex gap-2 mt-2"><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-16" /></div></CardContent></Card>)}</div>}
                    {errorAllPresales && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading all presales list: {ensureString(errorAllPresales)}</AlertDescription></Alert>}
                    {isErrorContributedAddressesHook && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Error loading list of contributed presales: {ensureString(errorContributedAddressesHook)}</AlertDescription></Alert>}
                    {!isLoadingContributedAddresses && !isErrorContributedAddressesHook && !errorAllPresales && (
                        contributedPresalesAddresses && contributedPresalesAddresses.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                                {contributedPresalesAddresses.map((presaleAddr) => (
                                    <ContributedPresaleCard 
                                        key={presaleAddr} 
                                        presaleAddress={presaleAddr} 
                                        userAddress={address as Address} 
                                        refetchContributedPresalesList={refetchContributedPresalesAddresses} 
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">You have not contributed to any presales yet.</p>
                        )
                    )}
                </TabsContent>
                <TabsContent value="vesting">
                    <p className="text-muted-foreground text-center py-4">Vesting functionality is not yet implemented.</p>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default UserProfilePage;

