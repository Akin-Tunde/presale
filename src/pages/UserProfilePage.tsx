import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useSwitchChain,
} from "wagmi";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RefreshCw, AlertCircle, Info, Network } from "lucide-react";
import { Link } from "react-router-dom";
import { type Abi, type Address } from "viem";
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import { cn, ensureString } from "@/lib/utils";
import { FarcasterProfileSDKDisplay } from "@/components/FarcasterProfileSDKDisplay";
import CreatorPresaleCard from "@/pages/userComponent/CreatorPresaleCard";
import ContributedPresaleCard from "@/pages/userComponent/ContributedPresaleCard";
import VestingSchedules from "@/pages/userComponent/VestingSchedules";
import LiquidityLocker from "@/pages/userComponent/LiquidityLocker";
import { toast } from "sonner";

const factoryAbi = PresaleFactoryJson.abi as Abi;
const factoryAddress = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS as Address;
const BASE_MAINNET_CHAIN_ID = 8453;

const UserProfilePage = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [activeTab, setActiveTab] = useState("created");
  const [retryCount, setRetryCount] = useState(0);

  const isWrongNetwork = chainId !== BASE_MAINNET_CHAIN_ID;

  const {
    data: allPresalesFromFactory,
    isLoading: isLoadingAllPresales,
    refetch: refetchAllPresalesFromFactory,
    error: errorAllPresales,
  } = useReadContract({
    abi: factoryAbi,
    address: factoryAddress,
    functionName: "getAllPresales",
    query: {
      enabled: isConnected && !!address && !isWrongNetwork,
      select: (data) => data as Address[] | undefined,
    },
  });

  const {
    data: createdPresalesData,
    isLoading: isLoadingCreated,
    refetch: refetchCreatedPresales,
    isError: isErrorCreatedHook,
    error: errorCreatedHook,
  } = useReadContracts({
    contracts:
      allPresalesFromFactory?.map((presaleAddress) => ({
        abi: factoryAbi,
        address: presaleAddress,
        functionName: "owner",
      })) ?? [],
    query: {
      enabled:
        !!allPresalesFromFactory &&
        allPresalesFromFactory.length > 0 &&
        isConnected &&
        !!address &&
        !isWrongNetwork,
      select: (results) => {
        return allPresalesFromFactory?.filter(
          (_, index) =>
            results[index]?.status === "success" &&
            (results[index]?.result as Address | undefined)?.toLowerCase() ===
              address?.toLowerCase()
        );
      },
    },
  });

  const {
    data: contributedPresalesAddresses,
    isLoading: isLoadingContributedAddresses,
    refetch: refetchContributedPresalesAddresses,
    isError: isErrorContributedAddressesHook,
    error: errorContributedAddressesHook,
  } = useReadContracts({
    contracts:
      allPresalesFromFactory?.map((presaleAddress) => ({
        abi: factoryAbi,
        address: presaleAddress,
        functionName: "contributions",
        args: [address as Address],
      })) ?? [],
    query: {
      enabled:
        isConnected &&
        !!address &&
        !!allPresalesFromFactory &&
        allPresalesFromFactory.length > 0 &&
        !isWrongNetwork,
      select: (results) => {
        return allPresalesFromFactory?.filter(
          (_, index) =>
            results[index]?.status === "success" &&
            ((results[index]?.result as bigint | undefined) || BigInt(0)) >
              BigInt(0)
        );
      },
    },
  });

  const refetchAllData = () => {
    setRetryCount(retryCount + 1);
    refetchAllPresalesFromFactory();
    refetchCreatedPresales();
    refetchContributedPresalesAddresses();
  };

  const handleSwitchNetwork = () => {
    try {
      switchChain({ chainId: BASE_MAINNET_CHAIN_ID });
      toast.success("Switching to Base Mainnet...");
    } catch (error) {
      toast.error("Failed to switch network", {
        description: ensureString(error),
      });
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Alert variant="default" className="max-w-md">
          <Info className="h-4 w-4" />
          <AlertTitle>Wallet Not Connected</AlertTitle>
          <AlertDescription>
            Please connect your wallet to view your profile.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <Alert variant="destructive" className="max-w-md">
          <Network className="h-4 w-4" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            You are not connected to Base Mainnet. Please switch your network to
            continue.
            <Button
              variant="outline"
              size="sm"
              onClick={handleSwitchNetwork}
              className="mt-2 w-full"
            >
              Switch to Base Mainnet
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading =
    isLoadingAllPresales || isLoadingCreated || isLoadingContributedAddresses;
  const hasNoPresales =
    !isLoading &&
    !errorAllPresales &&
    (!allPresalesFromFactory || allPresalesFromFactory.length === 0);

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

      <div className="mb-6">
        <FarcasterProfileSDKDisplay
          address={address}
          size="lg"
          showBadge={true}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mb-4">
          <div className="w-full sm:hidden">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">
                  My Created ({createdPresalesData?.length || 0})
                </SelectItem>
                <SelectItem value="contributed">
                  Contributed To ({contributedPresalesAddresses?.length || 0})
                </SelectItem>
                <SelectItem value="vesting">My Vesting</SelectItem>
                <SelectItem value="liquidity">My Liquidity Locks</SelectItem>
                <SelectItem value="history">History</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TabsList className="hidden sm:flex sm:w-auto sm:flex-wrap sm:gap-0">
            <TabsTrigger value="created">
              My Created ({createdPresalesData?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="contributed">
              Contributed To ({contributedPresalesAddresses?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="vesting">My Vesting</TabsTrigger>
            <TabsTrigger value="liquidity">My Liquidity Locks</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAllData}
            disabled={isLoading}
            className="w-full mt-2 sm:mt-0 sm:w-auto flex-shrink-0"
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")}
            />
            Refresh Data
          </Button>
        </div>
        {hasNoPresales && (
          <Alert variant="default" className="mb-4">
            <Info className="h-4 w-4" />
            <AlertTitle>No Presales Available</AlertTitle>
            <AlertDescription>
              You're yet to create presale.
              <Link to="/create-presale">
                <Button variant="link" size="sm" className="mt-2">
                  Create a Presale
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}
        {(errorAllPresales ||
          isErrorCreatedHook ||
          isErrorContributedAddressesHook) && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Data Fetching Error</AlertTitle>
            <AlertDescription>
              {errorAllPresales &&
                `Error loading presales: ${ensureString(
                  errorAllPresales.message
                )}`}
              {isErrorCreatedHook &&
                `Error loading created presales: ${ensureString(
                  errorCreatedHook?.message
                )}`}
              {isErrorContributedAddressesHook &&
                `Error loading contributed presales: ${ensureString(
                  errorContributedAddressesHook?.message
                )}`}
              <Button
                variant="outline"
                size="sm"
                onClick={refetchAllData}
                className="mt-2 w-full"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <TabsContent value="created">
          {isLoadingCreated && !hasNoPresales && (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-full mt-1" />
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground mb-3 pt-2 border-t border-border">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!isLoadingCreated &&
            !isErrorCreatedHook &&
            !errorAllPresales &&
            !hasNoPresales &&
            (createdPresalesData && createdPresalesData.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {createdPresalesData.map((presaleAddr) => (
                  <CreatorPresaleCard
                    key={presaleAddr}
                    presaleAddress={presaleAddr}
                    refetchCreatedPresalesList={refetchCreatedPresales}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                You have not created any presales yet.
              </p>
            ))}
        </TabsContent>
        <TabsContent value="contributed">
          {isLoadingContributedAddresses && !hasNoPresales && (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="animate-pulse">
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
              ))}
            </div>
          )}
          {!isLoadingContributedAddresses &&
            !isErrorContributedAddressesHook &&
            !errorAllPresales &&
            !hasNoPresales &&
            (contributedPresalesAddresses &&
            contributedPresalesAddresses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {contributedPresalesAddresses.map((presaleAddr) => (
                  <ContributedPresaleCard
                    key={presaleAddr}
                    presaleAddress={presaleAddr}
                    userAddress={address}
                    refetchContributedPresalesList={
                      refetchContributedPresalesAddresses
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                You have not contributed to any presales yet.
              </p>
            ))}
        </TabsContent>
        <TabsContent value="vesting">
          <VestingSchedules
            address={address}
            contributedPresalesAddresses={contributedPresalesAddresses}
            refetch={refetchContributedPresalesAddresses}
          />
        </TabsContent>
        <TabsContent value="liquidity">
          <LiquidityLocker address={address} refetch={refetchAllData} />
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Transaction History
              </CardTitle>
              <CardDescription className="text-xs">
                Claims and refunds from past presales.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Claims History</h3>
                  <div className="text-xs text-muted-foreground border rounded-md p-3">
                    <p>Claim history data fetching not implemented.</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Refunds History</h3>
                  <div className="text-xs text-muted-foreground border rounded-md p-3">
                    <p>Refund history data fetching not implemented.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserProfilePage;
