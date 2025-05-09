import { Link } from "react-router-dom";
import PresaleJson from "@/abis/Presale.json";
import { type Abi, erc20Abi } from "viem";
import { formatUnits, zeroAddress } from "viem";
import { useReadContracts, useReadContract } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge"; // Removed type BadgeProps 
import { getPresaleStatus } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Import Avatar components
import { useState } from "react";

const presaleAbi = PresaleJson.abi as Abi;

// Define the structure for the options tuple based on the ABI
type PresaleOptionsTuple = readonly [
    bigint, // tokenDeposit 0
    bigint, // hardCap 1
    bigint, // softCap 2
    bigint, // min 3
    bigint, // max 4
    bigint, // presaleRate 5
    bigint, // listingRate 6
    bigint, // liquidityBps 7
    bigint, // slippageBps 8
    bigint, // start 9
    bigint, // end 10
    bigint, // lockupDuration 11
    bigint, // vestingPercentage 12
    bigint, // vestingDuration 13
    bigint, // leftoverTokenOption 14
    `0x${string}`, // currency 15
    number, // whitelistType (uint8) 16
    `0x${string}`, // merkleRoot (bytes32) 17
    `0x${string}` // nftContractAddress 18
];

interface PresaleCardProps {
    presaleAddress: `0x${string}`;
}

// Function to generate fallback initials
const getInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name.substring(0, 2).toUpperCase();
};

const PresaleCard: React.FC<PresaleCardProps> = ({ presaleAddress }) => {
    const [logoError, setLogoError] = useState(false);

    const presaleContract = {
        address: presaleAddress,
        abi: presaleAbi,
    } as const;

    // Fetch core presale data
    const { data: presaleData, isLoading: isLoadingPresale } = useReadContracts({
        allowFailure: true,
        contracts: [
            { ...presaleContract, functionName: "options" }, // 0: PresaleOptions
            { ...presaleContract, functionName: "state" }, // 1: PresaleState
            { ...presaleContract, functionName: "token" }, // 2: Token Address
            { ...presaleContract, functionName: "totalContributed" }, // 3: Total Contributed
        ],
    });

    // Destructure results safely
    const presaleOptions = presaleData?.[0]?.result as PresaleOptionsTuple | undefined;
    const presaleState = presaleData?.[1]?.result as number | undefined;
    const tokenAddress = presaleData?.[2]?.result as `0x${string}` | undefined;
    const totalContributed = presaleData?.[3]?.result as bigint | undefined;

    // Fetch token symbol using the fetched tokenAddress
    const { data: tokenSymbol, isLoading: isLoadingSymbol } = useReadContract({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: "symbol",
        query: { enabled: !!tokenAddress }, // Only run query if tokenAddress is available
    });

    const currencyAddress = presaleOptions?.[15] as `0x${string}` | undefined;
    const currencyIsEth = currencyAddress === zeroAddress;

    const { data: currencySymbol, isLoading: isLoadingCurrencySymbol } = useReadContract({
        abi: erc20Abi,
        address: currencyAddress,
        functionName: "symbol",
        query: { enabled: !!currencyAddress && !currencyIsEth },
    });

    const { data: currencyDecimalsResult, isLoading: isLoadingCurrencyDecimals } = useReadContract({
        abi: erc20Abi,
        address: currencyAddress,
        functionName: "decimals",
        query: { enabled: !!currencyAddress && !currencyIsEth },
    });
    const currencyDecimals = currencyDecimalsResult as number | undefined ?? 18; // Default to 18 for ETH or if loading

    // --- Derived State & Calculations ---
    const presaleStatus = getPresaleStatus(presaleState, presaleOptions);

    // Access options tuple by index based on ABI
    const hardCap = presaleOptions?.[1] as bigint | undefined;
    const startTime = presaleOptions?.[9] as bigint | undefined;
    const endTime = presaleOptions?.[10] as bigint | undefined;

    const progress = hardCap && totalContributed ? (Number(totalContributed) / Number(hardCap)) * 100 : 0;
    const totalContributedFormatted = totalContributed !== undefined ? formatUnits(totalContributed, currencyDecimals) : "0";
    const hardCapFormatted = hardCap !== undefined ? formatUnits(hardCap, currencyDecimals) : "N/A";
    const currencyDisplaySymbol = currencyIsEth ? "ETH" : currencySymbol ?? "Token";

    // Construct potential logo URL (using Trust Wallet asset repo pattern as an example)
    const logoUrl = tokenAddress ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png` : undefined;

    const isLoading = isLoadingPresale || isLoadingSymbol || isLoadingCurrencySymbol || isLoadingCurrencyDecimals;

    // Skeleton Loader
    if (isLoading) {
        return (
            <Card className="animate-pulse">
                <CardHeader className="flex flex-row items-center gap-3">
                     <Avatar className="h-10 w-10 bg-muted rounded-full"></Avatar>
                    <div className="flex-1 space-y-1">
                        <div className="h-5 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-full"></div>
                    </div>
                     <div className="h-5 bg-muted rounded w-16"></div>
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                    <div className="h-3 bg-muted rounded w-full mt-2"></div>
                </CardContent>
            </Card>
        );
    }

    if (!presaleOptions) {
        // Optionally render an error state or null
        return null; 
    }

    return (
        <Link to={`/presale/${presaleAddress}`}>
            <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
                <CardHeader className="flex flex-row items-start gap-3">
                    <Avatar className="h-10 w-10">
                        {/* Display logo if URL exists and no error occurred, otherwise fallback */}
                        <AvatarImage 
                            src={logoUrl}
                            alt={`${tokenSymbol || "Token"} logo`} 
                            onError={() => setLogoError(true)} 
                            className={logoError ? "hidden" : "block"} 
                        />
                        <AvatarFallback className={!logoUrl || logoError ? "block" : "hidden"}>
                            {getInitials(tokenSymbol)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                        <CardTitle className="text-lg leading-tight">{tokenSymbol || "Token"} Presale</CardTitle>
                        <CardDescription className="text-xs font-mono break-all pt-1">{presaleAddress}</CardDescription>
                    </div>
                    <Badge variant={presaleStatus.variant}>
                        {presaleStatus.text}
                    </Badge>
                </CardHeader>
                <CardContent className="space-y-2 flex-1 flex flex-col justify-end">
                    <div>
                        <Progress value={progress} className="w-full" />
                        <p className="text-sm text-muted-foreground mt-1 text-center">
                            {totalContributedFormatted} / {hardCapFormatted} {currencyDisplaySymbol} Raised
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground flex justify-between pt-2">
                        <span>Start: {startTime ? new Date(Number(startTime) * 1000).toLocaleDateString() : "N/A"}</span>
                        <span>End: {endTime ? new Date(Number(endTime) * 1000).toLocaleDateString() : "N/A"}</span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
};

export default PresaleCard;

