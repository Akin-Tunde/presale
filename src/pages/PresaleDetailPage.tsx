import { useParams, Link } from "react-router-dom"; // Added Link
import { useAccount, useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useFeeData } from "wagmi";
import PresaleJson from "@/abis/Presale.json";
import { type Abi, erc20Abi } from "viem";
import { formatUnits, parseUnits, zeroAddress, bytesToHex, isBytes, formatEther, type Address, encodeFunctionData } from "viem";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge, type BadgeProps } from "@/components/ui/badge"; // Import BadgeProps
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import { getPresaleStatus, getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { AlertCircle, Info, RefreshCw, Fuel, Lock, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react"; // Removed Clock, X, Added ArrowLeft
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const presaleAbi = PresaleJson.abi as Abi;

// Helper to parse Merkle proof input
const parseMerkleProof = (input: string): `0x${string}`[] => {
    try {
        const proofArray = JSON.parse(input);
        if (Array.isArray(proofArray) && proofArray.every(item => typeof item === "string" && item.startsWith("0x"))) {
            return proofArray as `0x${string}`[];
        }
    } catch (e) {}
    return input
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => s.startsWith("0x") ? s as `0x${string}` : `0x${s}` as `0x${string}`)
        .filter(s => isBytes(s));
};

// Skeleton Component for Detail Page
const PresaleDetailSkeleton = () => (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-full mt-1" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-20" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/2 mx-auto mt-1" />
                    <Skeleton className="h-3 w-1/3 mx-auto mt-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm pt-4 border-t">
                    {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
                {/* Skeleton for Vesting/Lock panels */}
                <div className="pt-4 border-t"><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3 mt-1" /></div>
                <div className="pt-4 border-t"><Skeleton className="h-6 w-1/3 mb-4" /><Skeleton className="h-10 w-full" /></div>
            </CardContent>
        </Card>
    </div>
);

// Helper to display estimated fee
export const EstimatedFeeDisplay = ({ fee, label }: { fee: bigint | undefined, label?: string }) => {
    if (fee === undefined || fee === 0n) return null;
    return (
        <span className="text-xs text-muted-foreground ml-2 flex items-center">
            {label && <span className="mr-1">{label}:</span>}
            <Fuel className="h-3 w-3 mr-1"/> ~{formatEther(fee)} ETH
        </span>
    );
};

interface PresaleStatus {
    text: string;
    variant: BadgeProps["variant"]; // Use BadgeProps for variant type
}

const PresaleDetailPage = () => {
    const { address: presaleAddressParam } = useParams<{ address: string }>();
    const presaleAddress = presaleAddressParam as Address | undefined;
    const { address: userAddress, isConnected } = useAccount();
    const { writeContractAsync, data: hash, isPending: isWritePending, reset: resetWriteContract } = useWriteContract(); // Added reset
    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash }); // Added receipt
    const { data: feeData } = useFeeData();

    const [contributionAmount, setContributionAmount] = useState("");
    const [merkleProofInput, setMerkleProofInput] = useState("");
    const [needsApproval, setNeedsApproval] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [actionError, setActionError] = useState("");
    const [logoError, setLogoError] = useState(false);
    const [currentAction, setCurrentAction] = useState<string | null>(null); // To track current action: approve, contribute, claim, refund

    const presaleContractConfig = {
        address: presaleAddress,
        abi: presaleAbi,
    } as const;

    // --- Data Fetching ---
    const contractsToRead = useMemo(() => {
        if (!presaleAddress) return [];
        const baseContracts: any[] = [
            { ...presaleContractConfig, functionName: "options" }, // 0
            { ...presaleContractConfig, functionName: "state" }, // 1
            { ...presaleContractConfig, functionName: "token" }, // 2
            { ...presaleContractConfig, functionName: "totalRaised" }, // 3
            { ...presaleContractConfig, functionName: "paused" }, // 4
            { ...presaleContractConfig, functionName: "getContributorCount" }, // 5
            { ...presaleContractConfig, functionName: "claimDeadline" }, // 6
            { ...presaleContractConfig, functionName: "whitelistEnabled" }, // 7
            { ...presaleContractConfig, functionName: "merkleRoot" }, // 8
            { ...presaleContractConfig, functionName: "vestingOptions" }, // 9: Added vestingOptions
        ];
        if (userAddress) {
            baseContracts.push({ ...presaleContractConfig, functionName: "contributions", args: [userAddress] }); // 10
            baseContracts.push({ ...presaleContractConfig, functionName: "claimableTokens", args: [userAddress] }); // 11
        }
        return baseContracts;
    }, [presaleAddress, userAddress]);

    const { data: presaleData, isLoading: isLoadingPresale, refetch: refetchPresaleData, isRefetching } = useReadContracts({
        allowFailure: true,
        contracts: contractsToRead,
        query: { enabled: !!presaleAddress, refetchInterval: 30000 } // Refetch data periodically
    });

    const [ options, stateResult, tokenAddressResult, totalContributed, paused, contributorCount, claimDeadline, whitelistEnabled, merkleRoot, vestingOptions, userContribution, userClaimableTokens ] = useMemo(() => {
        return presaleData?.map(d => d.result) ?? Array(contractsToRead.length).fill(undefined);
    }, [presaleData, contractsToRead.length]);

    const tokenAddress = tokenAddressResult as Address | undefined;
    const state = stateResult as number | undefined;
    const isVestingEnabled = (vestingOptions as any)?.enabled;

    const { data: tokenSymbol, isLoading: isLoadingTokenSymbol } = useReadContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol",
        query: { enabled: !!tokenAddress }
    });

    const currencyAddress = options?.[15] as Address | undefined;
    const currencyIsEth = currencyAddress === zeroAddress;

    const { data: currencySymbol, isLoading: isLoadingCurrencySymbol } = useReadContract({
        address: currencyAddress,
        abi: erc20Abi,
        functionName: "symbol",
        query: { enabled: !!currencyAddress && !currencyIsEth }
    });

    const { data: currencyDecimalsResult, isLoading: isLoadingCurrencyDecimals } = useReadContract({
        address: currencyAddress,
        abi: erc20Abi,
        functionName: "decimals",
        query: { enabled: !!currencyAddress && !currencyIsEth }
    });
    const currencyDecimals = currencyDecimalsResult as number | undefined ?? 18;

    const { data: allowanceResult, isLoading: isLoadingAllowance, refetch: refetchAllowance } = useReadContract({
        address: currencyAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress!, presaleAddress!],
        query: { enabled: !!userAddress && !!presaleAddress && !currencyIsEth }
    });
    const allowance = allowanceResult as bigint | undefined;

    // --- Derived State & Calculations ---
    const presaleStatus: PresaleStatus = getPresaleStatus(state, options); // Explicitly type presaleStatus
    const hardCap = options?.[1] as bigint | undefined;
    const softCap = options?.[2] as bigint | undefined;
    const minContrib = options?.[3] as bigint | undefined;
    const maxContrib = options?.[4] as bigint | undefined;
    const presaleRate = options?.[5] as bigint | undefined;
    const startTime = options?.[9] as bigint | undefined;
    const endTime = options?.[10] as bigint | undefined;
    const progress = hardCap && totalContributed && hardCap > 0n ? Number(((totalContributed as bigint) * 10000n) / (hardCap as bigint)) / 100 : 0;
    const totalContributedFormatted = totalContributed !== undefined ? formatUnits(totalContributed as bigint, currencyDecimals) : "0";
    const hardCapFormatted = hardCap !== undefined ? formatUnits(hardCap, currencyDecimals) : "N/A";
    const softCapFormatted = softCap !== undefined ? formatUnits(softCap, currencyDecimals) : "N/A";
    const minContribFormatted = minContrib !== undefined ? formatUnits(minContrib, currencyDecimals) : "N/A";
    const maxContribFormatted = maxContrib !== undefined ? formatUnits(maxContrib, currencyDecimals) : "N/A";
    const userContributionFormatted = userContribution !== undefined ? formatUnits(userContribution as bigint, currencyDecimals) : "0";
    const userClaimableTokensFormatted = userClaimableTokens !== undefined ? formatUnits(userClaimableTokens as bigint, 18) : "0"; // Assuming token is 18 decimals
    const currencyDisplaySymbol = currencyIsEth ? "ETH" : currencySymbol ?? "Tokens";
    const merkleProof = useMemo(() => parseMerkleProof(merkleProofInput), [merkleProofInput]);
    const contributionAmountParsed = useMemo(() => {
        try { return parseUnits(contributionAmount || "0", currencyDecimals); } catch { return 0n; }
    }, [contributionAmount, currencyDecimals]);

    const logoUrl = tokenAddress ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png` : undefined;

    // --- Action Eligibility ---
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const canContribute = state === 1 && !paused && startTime !== undefined && endTime !== undefined && nowSeconds >= startTime && nowSeconds <= endTime;
    // const isEnded = state === 2 || state === 3 || state === 4; // Removed as unused
    const softCapMet = totalContributed !== undefined && softCap !== undefined && (totalContributed as bigint) >= softCap;
    
    const canClaim = isConnected && state === 2 && softCapMet && claimDeadline !== undefined && nowSeconds < (claimDeadline as bigint) && userClaimableTokens !== undefined && (userClaimableTokens as bigint) > 0n && !paused;
    const canRefund = isConnected && (state === 3 || (state === 2 && !softCapMet)) && userContribution !== undefined && (userContribution as bigint) > 0n && !paused;

    // --- Gas Estimation ---
    const { data: approveGas } = useEstimateGas({
        to: currencyAddress,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [presaleAddress!, contributionAmountParsed] }),
        account: userAddress,
        query: { enabled: !currencyIsEth && needsApproval && !!userAddress && !!presaleAddress && contributionAmountParsed > 0n }
    });
    const { data: contributeGas } = useEstimateGas({
        to: presaleContractConfig.address,
        data: encodeFunctionData({ abi: presaleContractConfig.abi, functionName: currencyIsEth ? "contribute" : "contributeStablecoin", args: currencyIsEth ? [merkleProof] : [contributionAmountParsed, merkleProof] }),
        value: currencyIsEth ? contributionAmountParsed : 0n,
        account: userAddress,
        query: { enabled: canContribute && !!userAddress && contributionAmountParsed > 0n && (!whitelistEnabled || merkleProof.length > 0) }
    });
    const { data: claimGas } = useEstimateGas({
        to: presaleContractConfig.address,
        data: encodeFunctionData({ abi: presaleContractConfig.abi, functionName: "claim" }),
        account: userAddress,
        query: { enabled: canClaim && !!userAddress }
    });
    const { data: refundGas } = useEstimateGas({
        to: presaleContractConfig.address,
        data: encodeFunctionData({ abi: presaleContractConfig.abi, functionName: "refund" }),
        account: userAddress,
        query: { enabled: canRefund && !!userAddress }
    });
    const calculateFee = (gas: bigint | undefined) => gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;
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
        } catch { setNeedsApproval(true); }
    }, [currencyIsEth, contributionAmount, allowance, currencyDecimals]);

    useEffect(() => {
        if (isConfirmed && receipt) {
            toast.success(`${currentAction?.charAt(0).toUpperCase() + currentAction!.slice(1)} Successful!`, {
                 description: `Tx: ${receipt.transactionHash}`,
                 icon: <CheckCircle className="h-5 w-5 text-green-500" />
            });
            setActionError("");
            refetchPresaleData();
            if (currentAction === "approve" && !currencyIsEth) refetchAllowance();
            if (currentAction === "contribute") setContributionAmount("");
            setCurrentAction(null); // Reset current action
            resetWriteContract(); // Reset wagmi write state
        }
    }, [isConfirmed, receipt, refetchPresaleData, refetchAllowance, currencyIsEth, currentAction, resetWriteContract]);

    // --- Action Handlers ---
    const handleApprove = async () => {
        if (!presaleAddress || !contributionAmountParsed || contributionAmountParsed <= 0n || !currencyAddress) return;
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
            toast.error("Approval Failed", { description: errorMsg, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> }); 
            setCurrentAction(null);
        }
        finally { setIsApproving(false); }
    };

    const handleContribute = async () => {
        if (!contributionAmountParsed || contributionAmountParsed <= 0n || !presaleContractConfig.address) return;
        if (whitelistEnabled && merkleProof.length === 0 && (merkleRoot && merkleRoot !== bytesToHex(new Uint8Array(32).fill(0)))) { // Check if merkleRoot is set
            const errorMsg = "Merkle proof is required for this whitelisted presale.";
            setActionError(errorMsg);
            toast.error("Merkle Proof Required", { description: errorMsg, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> });
            return;
        }
        setActionError("");
        setCurrentAction("contribute");
        try {
            await writeContractAsync({
                address: presaleContractConfig.address,
                abi: presaleContractConfig.abi,
                functionName: currencyIsEth ? "contribute" : "contributeStablecoin",
                args: currencyIsEth ? [merkleProof] : [contributionAmountParsed, merkleProof],
                value: currencyIsEth ? contributionAmountParsed : 0n,
            });
        } catch (err: any) { 
            const errorMsg = err.shortMessage || err.message || "Contribution failed.";
            setActionError(errorMsg); 
            toast.error("Contribution Failed", { description: errorMsg, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> }); 
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
            const errorMsg = err.shortMessage || err.message || `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} failed.`;
            setActionError(errorMsg); 
            toast.error(`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Failed`, { description: errorMsg, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> }); 
            setCurrentAction(null);
        }
    };

    if (isLoadingPresale && !presaleData) return <PresaleDetailSkeleton />;
    if (!presaleAddress || !options) return (
        <div className="text-center py-10">
            <p>Presale not found or invalid address.</p>
            <Link to="/presales" className="text-blue-500 hover:underline">
                <Button variant="link" className="mt-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go back to Presales
                </Button>
            </Link>
        </div>
    );

    const isPageLoading = isLoadingPresale || isLoadingTokenSymbol || isLoadingCurrencySymbol || isLoadingCurrencyDecimals || isLoadingAllowance || isRefetching;
    const isActionInProgress = isWritePending || isConfirming || isApproving;

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-3xl">
            <div className="mb-4">
                <Link to="/presales">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Presales
                    </Button>
                </Link>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            {logoUrl && !logoError ? (
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={logoUrl} alt={tokenSymbol || "Token Logo"} onError={() => setLogoError(true)} />
                                    <AvatarFallback>{getInitials(tokenSymbol || "T")}</AvatarFallback>
                                </Avatar>
                            ) : (
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback>{getInitials(tokenSymbol || "T")}</AvatarFallback>
                                </Avatar>
                            )}
                            <div>
                                <CardTitle className="text-2xl flex items-center">{tokenSymbol || "Presale Token"} Presale
                                    <Button variant="ghost" size="icon" onClick={() => refetchPresaleData()} disabled={isPageLoading || isActionInProgress} className="ml-2">
                                        <RefreshCw className={`h-4 w-4 ${isPageLoading ? "animate-spin" : ""}`} />
                                    </Button>
                                </CardTitle>
                                <CardDescription>Status: <Badge variant={presaleStatus.variant}>{presaleStatus.text}</Badge></CardDescription>
                            </div>
                        </div>
                        {paused && <Badge variant="destructive" className="text-sm"><AlertTriangle className="h-4 w-4 mr-1 inline" />PAUSED</Badge>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Progress ({totalContributedFormatted} {currencyDisplaySymbol})</span>
                            <span>{progress.toFixed(2)}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>Soft Cap: {softCapFormatted} {currencyDisplaySymbol}</span>
                            <span>Hard Cap: {hardCapFormatted} {currencyDisplaySymbol}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-4 border-t">
                        <div><strong>Presale Rate:</strong> 1 {currencyDisplaySymbol} = {presaleRate ? formatUnits(presaleRate, 0) : "N/A"} {tokenSymbol || "Tokens"}</div>
                        <div><strong>Min Contribution:</strong> {minContribFormatted} {currencyDisplaySymbol}</div>
                        <div><strong>Max Contribution:</strong> {maxContribFormatted} {currencyDisplaySymbol}</div>
                        <div><strong>Start Time:</strong> {startTime ? new Date(Number(startTime) * 1000).toLocaleString() : "N/A"}</div>
                        <div><strong>End Time:</strong> {endTime ? new Date(Number(endTime) * 1000).toLocaleString() : "N/A"}</div>
                        <div><strong>Contributors:</strong> {contributorCount?.toString() ?? "N/A"}</div>
                        {claimDeadline !== undefined && <div><strong>Claim Deadline:</strong> {new Date(Number(claimDeadline as bigint) * 1000).toLocaleString()}</div>}
                        <div><strong>Whitelist:</strong> {whitelistEnabled ? "Enabled" : "Disabled"}</div>
                        {whitelistEnabled && merkleRoot && merkleRoot !== bytesToHex(new Uint8Array(32).fill(0)) && <div className="col-span-full"><strong>Merkle Root:</strong> <span className="truncate text-xs">{merkleRoot.toString()}</span></div>}
                    </div>

                    {isVestingEnabled && (
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold flex items-center"><Lock className="h-5 w-5 mr-2" />Vesting Details</h3>
                            <p className="text-sm text-muted-foreground">Initial Release: {(vestingOptions as any)?.initialReleasePercentage / 100}%</p>
                            <p className="text-sm text-muted-foreground">Vesting Period: {(vestingOptions as any)?.vestingPeriodSeconds / 86400} days</p>
                            <p className="text-sm text-muted-foreground">Cycle Release: {(vestingOptions as any)?.cycleReleasePercentage / 100}% per cycle</p>
                        </div>
                    )}

                    {actionError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionError}</AlertDescription>
                        </Alert>
                    )}

                    {/* Contribution Section */}
                    {canContribute && (
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold mb-2">Contribute</h3>
                            <div className="space-y-2">
                                <Input 
                                    type="text" 
                                    placeholder={`Amount in ${currencyDisplaySymbol}`}
                                    value={contributionAmount}
                                    onChange={(e) => setContributionAmount(e.target.value)}
                                    disabled={isActionInProgress}
                                />
                                {whitelistEnabled && merkleRoot && merkleRoot !== bytesToHex(new Uint8Array(32).fill(0)) && (
                                    <Textarea 
                                        placeholder="Enter Merkle Proof (comma or newline separated)"
                                        value={merkleProofInput}
                                        onChange={(e) => setMerkleProofInput(e.target.value)}
                                        disabled={isActionInProgress}
                                        rows={3}
                                    />
                                )}
                                {needsApproval && !currencyIsEth ? (
                                    <Button onClick={handleApprove} disabled={isActionInProgress || !contributionAmount} className="w-full">
                                        {isApproving ? "Approving..." : "Approve"}
                                        {approveFee !== undefined && approveFee !== 0n && <EstimatedFeeDisplay fee={approveFee} />}
                                    </Button>
                                ) : (
                                    <Button onClick={handleContribute} disabled={isActionInProgress || !contributionAmount} className="w-full">
                                        {isWritePending && currentAction === "contribute" ? "Contributing..." : "Contribute"}
                                        {contributeFee !== undefined && contributeFee !== 0n && <EstimatedFeeDisplay fee={contributeFee} />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Claim Section */}
                    {canClaim && (
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold mb-2">Claim Tokens</h3>
                            <p className="text-sm text-muted-foreground mb-2">You can claim {userClaimableTokensFormatted} {tokenSymbol || "Tokens"}.</p>
                            <Button onClick={() => handleClaimOrRefund("claim")} disabled={isActionInProgress} className="w-full">
                                {isWritePending && currentAction === "claim" ? "Claiming..." : "Claim"}
                                {claimFee !== undefined && claimFee !== 0n && <EstimatedFeeDisplay fee={claimFee} />}
                            </Button>
                        </div>
                    )}

                    {/* Refund Section */}
                    {canRefund && (
                        <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold mb-2">Refund Contribution</h3>
                            <p className="text-sm text-muted-foreground mb-2">You can refund your contribution of {userContributionFormatted} {currencyDisplaySymbol}.</p>
                            <Button onClick={() => handleClaimOrRefund("refund")} disabled={isActionInProgress} className="w-full">
                                {isWritePending && currentAction === "refund" ? "Refunding..." : "Refund"}
                                {refundFee !== undefined && refundFee !== 0n && <EstimatedFeeDisplay fee={refundFee} />}
                            </Button>
                        </div>
                    )}

                    {/* Presale Has Not Started */}
                    {state === 0 && (
                        <Alert variant="default">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Presale Has Not Started</AlertTitle>
                            <AlertDescription>
                                This presale is scheduled to start on {startTime ? new Date(Number(startTime) * 1000).toLocaleString() : "N/A"}.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Ended and Failed to Meet Softcap */}
                    {state === 3 && !softCapMet && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Presale Ended - Softcap Not Met</AlertTitle>
                            <AlertDescription>
                                The presale has ended and the softcap was not met. You can claim a refund for your contribution.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Ended and Succeeded */}
                    {state === 2 && softCapMet && (
                        <Alert variant="default">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Presale Ended - Successful!</AlertTitle>
                            <AlertDescription>
                                The presale has ended successfully. You can now claim your tokens.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Ended and Finalized (Tokens Burnt or Withdrawn) */}
                    {state === 4 && (
                        <Alert variant="default">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Presale Finalized</AlertTitle>
                            <AlertDescription>
                                This presale has been finalized. Unclaimed tokens may have been burnt or withdrawn by the owner.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PresaleDetailPage;
