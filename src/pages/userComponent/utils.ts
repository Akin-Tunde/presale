// import { type PresaleStatusReturn } from "@/lib/utils";

export const ensureString = (value: any, fallback: string = "N/A"): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint")
    return String(value);
  if (value && typeof value.message === "string") return value.message;
  if (
    value &&
    typeof value.toString === "function" &&
    value.toString() !== "[object Object]"
  )
    return value.toString();
  return fallback;
};

export const shortenAddress = (address: string | undefined | null): string => {
  if (!address) return "N/A";
  return `${address.substring(0, 6)}...${address.substring(
    address.length - 4
  )}`;
};

export const formatTimestamp = (
  timestamp: bigint | number | undefined,
  fieldName?: string,
  state?: number // <-- add state as a separate argument
): string => {
  if (timestamp === undefined || timestamp === null) return "N/A";
  try {
    const numTimestamp = BigInt(timestamp);
    if (numTimestamp === 0n) {
      if (fieldName === "startTime" && (state === 0 || state === undefined))
        return "Not Started Yet";
      return "Not Set";
    }
    const date = new Date(Number(numTimestamp) * 1000);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString();
  } catch (e) {
    return "Invalid Timestamp";
  }
};
