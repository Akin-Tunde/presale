import { useState, useEffect } from "react";
import {
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Info } from "lucide-react";
import { Abi, type Address, erc20Abi } from "viem";
import VestingJson from "@/abis/Vesting.json";
import { ensureString, formatTokenAmount } from "@/lib/utils";
import { shortenAddress } from "./utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const vestingAbi = VestingJson.abi as Abi;
const vestingAddress = import.meta.env.VITE_VESTING_CONTRACT_ADDRESS as Address;

interface VestingSchedulesProps {
  address: Address | undefined;
  contributedPresalesAddresses: Address[] | undefined;
  refetch: () => void;
}

interface VestingSchedule {
  presaleAddress: Address;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: bigint;
  released: bigint;
  claimableAmount: bigint;
  start: bigint;
  duration: bigint;
  endTime: bigint;
  progressPercentage: string;
  exists: true;
}

interface ScheduleData {
  tokenAddress: Address;
  totalAmount: bigint;
  released: bigint;
  start: bigint;
  duration: bigint;
  exists: boolean;
}

const VestingSchedules: React.FC<VestingSchedulesProps> = ({
  address,
  refetch,
}) => {
  const {
    writeContractAsync,
    data: claimHash,
    isPending: isClaimPending,
    reset: resetWriteContract,
  } = useWriteContract();
  const {
    isLoading: isClaimConfirming,
    isSuccess: isClaimConfirmed,
    data: claimReceipt,
  } = useWaitForTransactionReceipt({ hash: claimHash });
  const [claimingError, setClaimingError] = useState<string | null>(null);
  const [claimingPresaleAddress, setClaimingPresaleAddress] =
    useState<Address | null>(null);
  const [vestingSchedules, setVestingSchedules] = useState<VestingSchedule[]>(
    []
  );

  const {
    data: userPresales,
    isLoading: isLoadingPresales,
    refetch: refetchPresales,
  } = useReadContracts({
    contracts: address
      ? [
          {
            address: vestingAddress,
            abi: vestingAbi,
            functionName: "getUserPresales",
            args: [address],
          },
        ]
      : [],
    query: { enabled: !!address },
  });

  const presaleAddresses =
    userPresales?.[0]?.status === "success"
      ? (userPresales[0].result as Address[])
      : [];

  const {
    data: vestingData,
    isLoading: isLoadingSchedules,
    refetch: refetchSchedules,
  } = useReadContracts({
    contracts: presaleAddresses.flatMap((presaleAddress) => [
      {
        address: vestingAddress,
        abi: vestingAbi,
        functionName: "schedules",
        args: [presaleAddress, address as Address],
      },
      {
        address: vestingAddress,
        abi: vestingAbi,
        functionName: "remainingVested",
        args: [presaleAddress, address as Address],
      },
    ]),
    query: { enabled: !!address && presaleAddresses.length > 0 },
  });

  const { data: tokenDetails, isLoading: isLoadingTokenDetails } =
    useReadContracts({
      contracts: presaleAddresses.flatMap((_presaleAddress, index) => {
        const scheduleData =
          vestingData && vestingData[index * 2]?.status === "success"
            ? (vestingData[index * 2].result as ScheduleData)
            : undefined;
        const tokenAddress = scheduleData?.tokenAddress;
        return tokenAddress
          ? [
              { address: tokenAddress, abi: erc20Abi, functionName: "symbol" },
              {
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "decimals",
              },
            ]
          : [];
      }),
      query: { enabled: !!vestingData && presaleAddresses.length > 0 },
    });

  useEffect(() => {
    if (!address || !vestingData || !presaleAddresses.length) {
      setVestingSchedules([]);
      return;
    }

    const schedules = presaleAddresses
      .map((presaleAddress, index) => {
        const scheduleData =
          vestingData[index * 2]?.status === "success"
            ? (vestingData[index * 2].result as ScheduleData)
            : undefined;
        const claimableData =
          vestingData[index * 2 + 1]?.status === "success"
            ? (vestingData[index * 2 + 1].result as bigint)
            : 0n;
        const tokenIndex = index * 2;
        const symbol =
          tokenDetails?.[tokenIndex]?.status === "success"
            ? (tokenDetails[tokenIndex].result as string)
            : "TKN";
        const decimals =
          tokenDetails?.[tokenIndex + 1]?.status === "success"
            ? (tokenDetails[tokenIndex + 1].result as number)
            : 18;

        if (!scheduleData || !scheduleData.exists) return null;

        const totalAmount = BigInt(scheduleData.totalAmount);
        const released = BigInt(scheduleData.released);
        const start = BigInt(scheduleData.start);
        const duration = BigInt(scheduleData.duration);
        const endTime = start + duration;
        const progressPercentage =
          totalAmount > 0n
            ? Math.min(100, Number((released * 100n) / totalAmount)).toString()
            : "0";

        return {
          presaleAddress,
          tokenAddress: scheduleData.tokenAddress,
          tokenSymbol: symbol,
          tokenDecimals: decimals,
          totalAmount,
          released,
          claimableAmount: claimableData,
          start,
          duration,
          endTime,
          progressPercentage,
          exists: scheduleData.exists,
        };
      })
      .filter((schedule): schedule is VestingSchedule => schedule !== null);

    setVestingSchedules(schedules);
  }, [vestingData, tokenDetails, presaleAddresses, address]);

  useEffect(() => {
    if (isClaimConfirmed && claimReceipt) {
      toast.success("Vesting claim successful!", {
        description: `Tx: ${ensureString(claimReceipt.transactionHash)}`,
      });
      setClaimingError(null);
      setClaimingPresaleAddress(null);
      refetchSchedules();
      refetchPresales();
      refetch();
      resetWriteContract();
    }
  }, [
    isClaimConfirmed,
    claimReceipt,
    refetchSchedules,
    refetchPresales,
    refetch,
    resetWriteContract,
  ]);

  const handleVestingClaim = async (presaleAddress: Address) => {
    if (!address) return;

    setClaimingError(null);
    setClaimingPresaleAddress(presaleAddress);

    try {
      await writeContractAsync({
        address: vestingAddress,
        abi: vestingAbi,
        functionName: "release",
        args: [presaleAddress],
      });
    } catch (error) {
      const errorMsg = ensureString(error, "Failed to claim vested tokens");
      setClaimingError(errorMsg);
      toast.error("Claim Failed", { description: errorMsg });
    }
  };

  const formatTimeRemaining = (endTime: bigint): string => {
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (endTime <= now) return "Vesting";
    const secondsRemaining = Number(endTime - now);
    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    return `${days}d ${hours}h remaining`;
  };

  const isLoading =
    isLoadingPresales || isLoadingSchedules || isLoadingTokenDetails;

  if (!address) {
    return (
      <p className="text-muted-foreground text-center py-4">
        Please connect your wallet to view vesting schedules.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          My Vesting Schedules
        </CardTitle>
        <CardDescription className="text-xs">
          Tokens being gradually unlocked from presales you participated in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-1">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2 mt-1" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {!isLoading && vestingSchedules.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-1">
            {vestingSchedules.map((schedule, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {schedule.tokenSymbol} Vesting
                      </CardTitle>
                      <CardDescription className="text-xs font-mono break-all pt-1">
                        Presale: {shortenAddress(schedule.presaleAddress)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        schedule.claimableAmount > 0n ? "default" : "outline"
                      }
                      className="text-xs"
                    >
                      {schedule.claimableAmount > 0n ? "Claimable" : "Vesting"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="w-full bg-secondary rounded-full h-2.5 mt-2">
                    <div
                      className="bg-primary h-2.5 rounded-full"
                      style={{ width: `${schedule.progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border">
                    <div>
                      <p className="font-medium text-foreground">
                        Total Vested:
                      </p>
                      <p>
                        {formatTokenAmount(
                          schedule.totalAmount,
                          schedule.tokenDecimals,
                          schedule.tokenSymbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Released:</p>
                      <p>
                        {formatTokenAmount(
                          schedule.released,
                          schedule.tokenDecimals,
                          schedule.tokenSymbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Claimable Now:
                      </p>
                      <p>
                        {formatTokenAmount(
                          schedule.claimableAmount,
                          schedule.tokenDecimals,
                          schedule.tokenSymbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Time Remaining:
                      </p>
                      <p>{formatTimeRemaining(schedule.endTime)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleVestingClaim(schedule.presaleAddress)
                      }
                      disabled={
                        schedule.claimableAmount <= 0n ||
                        isClaimPending ||
                        isClaimConfirming
                      }
                    >
                      Claim
                    </Button>
                  </div>
                  {claimingError &&
                    claimingPresaleAddress === schedule.presaleAddress && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{claimingError}</AlertDescription>
                      </Alert>
                    )}
                  {(isClaimPending || isClaimConfirming) &&
                    claimingPresaleAddress === schedule.presaleAddress && (
                      <Alert variant="default" className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {isClaimConfirming
                            ? "Confirming claim..."
                            : "Processing claim..."}
                          Tx: {shortenAddress(claimHash || undefined)}
                        </AlertDescription>
                      </Alert>
                    )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          !isLoading && (
            <p className="text-muted-foreground text-center py-4">
              You don't have any active vesting schedules.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default VestingSchedules;
