import { Fuel } from "lucide-react";
import { formatEther } from "viem";

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

export default EstimatedFeeDisplay;
