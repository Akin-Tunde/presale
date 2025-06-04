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
import LiquidityLockerJson from "@/abis/LiquidityLocker.json";
import { ensureString, formatTokenAmount } from "@/lib/utils";
import { shortenAddress, formatTimestamp } from "./utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const liquidityLockerAbi = LiquidityLockerJson.abi as Abi;
const liquidityLockerAddress = import.meta.env
  .VITE_LIQUIDITY_LOCKER_ADDRESS as Address;

interface LiquidityLock {
  lockId: number;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: bigint;
  unlockTime: bigint;
  owner: Address;
  timeRemaining: string;
}

interface LiquidityLockerProps {
  address: Address | undefined;
  refetch: () => void;
}

const LiquidityLocker: React.FC<LiquidityLockerProps> = ({
  address,
  refetch,
}) => {
  const {
    writeContractAsync,
    data: withdrawHash,
    isPending: isWithdrawPending,
    error: withdrawError,
    reset,
  } = useWriteContract();
  const {
    isLoading: isWithdrawConfirming,
    isSuccess: isWithdrawConfirmed,
    data: withdrawReceipt,
  } = useWaitForTransactionReceipt({ hash: withdrawHash });
  const [withdrawingLockId, setWithdrawingLockId] = useState<
    number | undefined
  >(undefined);
  const [locks, setLocks] = useState<LiquidityLock[]>([]);

  const {
    data: userLockIds,
    isLoading: isLoadingIds,
    refetch: refetchIds,
  } = useReadContracts({
    contracts: address
      ? [
          {
            address: liquidityLockerAddress,
            abi: liquidityLockerAbi,
            functionName: "getUserLocks",
            args: [address],
          },
        ]
      : [],
    query: { enabled: !!address },
  });

  const lockIds =
    userLockIds?.[0]?.status === "success"
      ? (userLockIds[0].result as bigint[])
      : [];

  const {
    data: lockDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useReadContracts({
    contracts: lockIds.map((lockId) => ({
      address: liquidityLockerAddress,
      abi: liquidityLockerAbi,
      functionName: "getLock",
      args: [lockId],
    })),
    query: { enabled: !!address && lockIds.length > 0 },
  });

  const { data: tokenDetails, isLoading: isLoadingTokenDetails } =
    useReadContracts({
      contracts:
        lockDetails?.flatMap((lock) => {
          const tokenAddress =
            lock?.status === "success" ? (lock.result as any)[0] : undefined;
          return tokenAddress
            ? [
                {
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: "symbol",
                },
                {
                  address: tokenAddress,
                  abi: erc20Abi,
                  functionName: "decimals",
                },
              ]
            : [];
        }) ?? [],
      query: { enabled: !!lockDetails && lockIds.length > 0 },
    });

  useEffect(() => {
    if (!address || !lockDetails || !lockIds.length) {
      setLocks([]);
      return;
    }

    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const locks: LiquidityLock[] = lockIds
      .map((lockId, index) => {
        const lockData =
          lockDetails[index]?.status === "success"
            ? lockDetails[index].result
            : undefined;
        if (!lockData) return null;

        const [tokenAddress, amount, unlockTime, owner] = lockData as [
          Address,
          bigint,
          bigint,
          Address
        ];
        const tokenIndex = index * 2;
        const symbol =
          tokenDetails?.[tokenIndex]?.status === "success"
            ? (tokenDetails[tokenIndex].result as string)
            : "TKN";
        const decimals =
          tokenDetails?.[tokenIndex + 1]?.status === "success"
            ? (tokenDetails[tokenIndex + 1].result as number)
            : 18;

        if (amount === 0n) return null;

        const timeRemaining =
          unlockTime > currentTime
            ? formatTimeRemaining(unlockTime - currentTime)
            : "Unlocked";

        return {
          lockId: Number(lockId),
          tokenAddress,
          tokenSymbol: symbol,
          tokenDecimals: decimals,
          amount,
          unlockTime,
          owner,
          timeRemaining,
        };
      })
      .filter((lock): lock is LiquidityLock => lock !== null);

    setLocks(locks);
  }, [lockDetails, tokenDetails, lockIds, address]);

  useEffect(() => {
    if (isWithdrawConfirmed && withdrawReceipt) {
      toast.success("Withdrawal successful!", {
        description: `Tx: ${shortenAddress(withdrawReceipt.transactionHash)}`,
      });
      setWithdrawingLockId(undefined);
      refetchDetails();
      refetchIds();
      refetch();
      reset();
    }
  }, [
    isWithdrawConfirmed,
    withdrawReceipt,
    refetchDetails,
    refetchIds,
    refetch,
    reset,
  ]);

  const handleWithdraw = async (lockId: number) => {
    if (!address) return;

    setWithdrawingLockId(lockId);
    try {
      await writeContractAsync({
        address: liquidityLockerAddress,
        abi: liquidityLockerAbi,
        functionName: "withdraw",
        args: [BigInt(lockId)],
      });
    } catch (error) {
      const errorMsg = ensureString(error, "Failed to withdraw locked tokens");
      toast.error("Withdrawal Failed", { description: errorMsg });
      setWithdrawingLockId(undefined);
    }
  };

  const formatTimeRemaining = (seconds: bigint): string => {
    const secondsNum = Number(seconds);
    const days = Math.floor(secondsNum / 86400);
    const hours = Math.floor((secondsNum % 86400) / 3600);
    return `${days}d ${hours}h remaining`;
  };

  const isLoading = isLoadingIds || isLoadingDetails || isLoadingTokenDetails;

  if (!address) {
    return (
      <p className="text-muted-foreground text-center py-4">
        Please connect your wallet to view liquidity locks.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          My Liquidity Locks
        </CardTitle>
        <CardDescription className="text-xs">
          Tokens locked for liquidity provision, awaiting unlock.
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
        {!isLoading && locks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-1">
            {locks.map((lock, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-medium">
                        {lock.tokenSymbol} Lock #{lock.lockId}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono break-all pt-1">
                        Token: {shortenAddress(lock.tokenAddress)}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        lock.timeRemaining === "Unlocked"
                          ? "default"
                          : "outline"
                      }
                      className="text-xs"
                    >
                      {lock.timeRemaining === "Unlocked"
                        ? "Withdrawable"
                        : "Locked"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-3 pt-3 border-t border-border">
                    <div>
                      <p className="font-medium text-foreground">
                        Locked Amount:
                      </p>
                      <p>
                        {formatTokenAmount(
                          lock.amount,
                          lock.tokenDecimals,
                          lock.tokenSymbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Unlock Time:
                      </p>
                      <p>{formatTimestamp(lock.unlockTime)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Time Remaining:
                      </p>
                      <p>{lock.timeRemaining}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Owner:</p>
                      <p>{shortenAddress(lock.owner)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => handleWithdraw(lock.lockId)}
                      disabled={
                        lock.timeRemaining !== "Unlocked" ||
                        lock.amount === 0n ||
                        isWithdrawPending ||
                        isWithdrawConfirming
                      }
                    >
                      Withdraw
                    </Button>
                  </div>
                  {withdrawError && withdrawingLockId === lock.lockId && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {ensureString(withdrawError)}
                      </AlertDescription>
                    </Alert>
                  )}
                  {(isWithdrawPending || isWithdrawConfirming) &&
                    withdrawingLockId === lock.lockId && (
                      <Alert variant="default" className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {isWithdrawConfirming
                            ? "Confirming withdrawal..."
                            : "Processing withdrawal..."}
                          Tx: {shortenAddress(withdrawHash || undefined)}
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
              You don't have any active liquidity locks.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default LiquidityLocker;
