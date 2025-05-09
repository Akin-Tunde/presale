import { Link } from "react-router-dom";
import PresaleJson from "@/abis/Presale.json";
import { type Abi, erc20Abi } from "viem";
import { formatUnits, zeroAddress } from "viem";
import { useReadContracts, useReadContract } from "wagmi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getPresaleStatus } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { Calendar, Clock, TrendingUp } from "lucide-react"; // Added lucide icons

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

// Format date nicely
const formatDate = (timestamp: bigint | undefined) => {
  if (!timestamp) return "N/A";
  const date = new Date(Number(timestamp) * 1000);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  return date.toLocaleDateString(undefined, options);
};

// Format currency with limited decimals
const formatCurrency = (value: string) => {
  const num = parseFloat(value);
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
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
  const presaleOptions = presaleData?.[0]?.result as
    | PresaleOptionsTuple
    | undefined;
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

  const { data: currencySymbol, isLoading: isLoadingCurrencySymbol } =
    useReadContract({
      abi: erc20Abi,
      address: currencyAddress,
      functionName: "symbol",
      query: { enabled: !!currencyAddress && !currencyIsEth },
    });

  const { data: currencyDecimalsResult, isLoading: isLoadingCurrencyDecimals } =
    useReadContract({
      abi: erc20Abi,
      address: currencyAddress,
      functionName: "decimals",
      query: { enabled: !!currencyAddress && !currencyIsEth },
    });
  const currencyDecimals = (currencyDecimalsResult as number | undefined) ?? 18; // Default to 18 for ETH or if loading

  // --- Derived State & Calculations ---
  const presaleStatus = getPresaleStatus(presaleState, presaleOptions);

  // Access options tuple by index based on ABI
  const hardCap = presaleOptions?.[1] as bigint | undefined;
  const startTime = presaleOptions?.[9] as bigint | undefined;
  const endTime = presaleOptions?.[10] as bigint | undefined;

  const progress =
    hardCap && totalContributed
      ? (Number(totalContributed) / Number(hardCap)) * 100
      : 0;
  const totalContributedFormatted =
    totalContributed !== undefined
      ? formatUnits(totalContributed, currencyDecimals)
      : "0";
  const hardCapFormatted =
    hardCap !== undefined ? formatUnits(hardCap, currencyDecimals) : "N/A";
  const currencyDisplaySymbol = currencyIsEth
    ? "ETH"
    : currencySymbol ?? "Token";

  // Construct potential logo URL (using Trust Wallet asset repo pattern as an example)
  const logoUrl = tokenAddress
    ? `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${tokenAddress}/logo.png`
    : undefined;

  const isLoading =
    isLoadingPresale ||
    isLoadingSymbol ||
    isLoadingCurrencySymbol ||
    isLoadingCurrencyDecimals;

  // Get variant color for progress bar
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getProgressVariant = () => {
    if (progress >= 90) return "success";
    if (progress >= 50) return "default";
    return "secondary";
  };

  // Get badge styles based on status
  const getBadgeStyles = (variant: string) => {
    switch (variant) {
      case "success":
        return "bg-green-100 text-green-800 border-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "secondary":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "default":
      default:
        return "bg-[#13494220] text-[#134942] border-[#13494240]";
    }
  };

  // Skeleton Loader
  if (isLoading) {
    return (
      <Card className="animate-pulse border-2 border-[#13494220] rounded-xl overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 bg-[#13494210] pb-4">
          <div className="h-12 w-12 rounded-full bg-[#13494220]"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-[#13494220] rounded"></div>
            <div className="h-3 w-full bg-[#13494220] rounded"></div>
          </div>
          <div className="h-6 w-20 rounded-full bg-[#13494220]"></div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="h-4 w-full bg-[#13494220] rounded"></div>
          <div className="h-4 w-2/3 bg-[#13494220] rounded"></div>
          <div className="h-8 w-full mt-3 bg-[#13494220] rounded-md"></div>
        </CardContent>
      </Card>
    );
  }

  if (!presaleOptions) {
    // Optionally render an error state or null
    return null;
  }

  return (
    <Link to={`/presale/${presaleAddress}`} className="block group">
      <Card className="border-2 border-[#13494220] rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:border-[#134942] transition-all duration-300 h-full flex flex-col">
        <CardHeader className="flex flex-row items-start gap-3 bg-[#13494208] pb-4 group-hover:bg-[#13494210] transition-colors duration-300">
          <Avatar className="h-12 w-12 border-2 border-[#13494220] shadow-sm">
            {/* Display logo if URL exists and no error occurred, otherwise fallback */}
            <AvatarImage
              src={logoUrl}
              alt={`${tokenSymbol || "Token"} logo`}
              onError={() => setLogoError(true)}
              className={logoError ? "hidden" : "block"}
            />
            <AvatarFallback
              className={`${
                !logoUrl || logoError ? "block" : "hidden"
              } bg-[#13494215] text-[#134942] font-bold text-xl`}
            >
              {getInitials(tokenSymbol)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-lg font-bold text-[#134942] leading-tight group-hover:translate-x-0.5 transition-transform duration-300">
              {tokenSymbol || "Token"} Presale
            </CardTitle>
            <CardDescription className="text-xs font-mono break-all pt-1 text-[#13494299]">
              {`${presaleAddress.slice(0, 6)}...${presaleAddress.slice(-4)}`}
              <span className="hidden group-hover:inline">
                {presaleAddress.slice(6, -4)}
              </span>
            </CardDescription>
          </div>
          <Badge
            className={`border px-2.5 py-0.5 text-xs font-medium rounded-full ${getBadgeStyles(
              presaleStatus.variant || "default"
            )}`}
          >
            {presaleStatus.text}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col justify-end pt-4">
          <div className="space-y-2">
            <Progress
              value={progress}
              className={`w-full h-2.5 bg-[#13494215] [&>div]:bg-[#134942] ${
                progress < 100 ? "rounded-r-none" : ""
              }`}
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#134942] font-medium">
                {progress.toFixed(1)}%
              </span>
              <p className="text-[#13494299] text-right flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 inline text-[#13494290]" />
                <span>
                  {formatCurrency(totalContributedFormatted)} /{" "}
                  {formatCurrency(hardCapFormatted)}{" "}
                  <span className="font-medium">{currencyDisplaySymbol}</span>
                </span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 mt-auto border-t border-[#13494215]">
            <div className="flex items-center gap-1.5 text-xs text-[#13494299]">
              <Calendar className="h-3.5 w-3.5 text-[#134942]" />
              <span>Start: {formatDate(startTime)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#13494299] justify-end">
              <Clock className="h-3.5 w-3.5 text-[#134942]" />
              <span>End: {formatDate(endTime)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default PresaleCard;
