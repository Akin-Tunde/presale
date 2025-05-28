<<<<<<< Updated upstream
import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, parseUnits, isAddress, zeroAddress, zeroHash } from "viem";
import { createClient } from "@supabase/supabase-js";
import { sepolia } from "viem/chains";
import { createConfig, http } from "@wagmi/core";
import { getAccount, getPublicClient, getWalletClient } from "@wagmi/core";

// Supabase client setup (replace with your Supabase URL and anon key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Wagmi configuration
const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

// ABIs
const factoryAbi = [
  {
    inputs: [
      {
        components: [
          { name: "tokenDeposit", type: "uint256" },
          { name: "hardCap", type: "uint256" },
          { name: "softCap", type: "uint256" },
          { name: "min", type: "uint256" },
          { name: "max", type: "uint256" },
          { name: "presaleRate", type: "uint256" },
          { name: "listingRate", type: "uint256" },
          { name: "liquidityBps", type: "uint256" },
          { name: "slippageBps", type: "uint256" },
          { name: "start", type: "uint256" },
          { name: "end", type: "uint256" },
          { name: "lockupDuration", type: "uint256" },
          { name: "vestingPercentage", type: "uint256" },
          { name: "vestingDuration", type: "uint256" },
          { name: "leftoverTokenOption", type: "uint256" },
          { name: "currency", type: "address" },
          { name: "whitelistType", type: "uint8" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "nftContractAddress", type: "address" },
        ],
        name: "options",
        type: "tuple",
      },
      { name: "_token", type: "address" },
      { name: "_weth", type: "address" },
      { name: "_uniswapV2Router02", type: "address" },
    ],
    name: "createPresale",
    outputs: [{ name: "presaleContract", type: "address" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "creationFee",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "feeToken",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "tokenDeposit", type: "uint256" },
          { name: "hardCap", type: "uint256" },
          { name: "softCap", type: "uint256" },
          { name: "min", type: "uint256" },
          { name: "max", type: "uint256" },
          { name: "presaleRate", type: "uint256" },
          { name: "listingRate", type: "uint256" },
          { name: "liquidityBps", type: "uint256" },
          { name: "slippageBps", type: "uint256" },
          { name: "start", type: "uint256" },
          { name: "end", type: "uint256" },
          { name: "lockupDuration", type: "uint256" },
          { name: "vestingPercentage", type: "uint256" },
          { name: "vestingDuration", type: "uint256" },
          { name: "leftoverTokenOption", type: "uint256" },
          { name: "currency", type: "address" },
          { name: "whitelistType", type: "uint8" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "nftContractAddress", type: "address" },
        ],
        name: "options",
        type: "tuple",
      },
      { name: "_token", type: "address" },
    ],
    name: "calculateTotalTokensNeededForPresale",
    outputs: [{ name: "totalTokens", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const erc20Abi = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
];

// Configuration
const FACTORY_ADDRESS = "0x7b676709cBF74bD668F380c2434aF18c4F75934f";
const WETH_ADDRESS = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
const UNISWAP_V2_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

// Helper Functions
const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date) return "";
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isValidAddress = (address: string): boolean => {
  return address === "" || isAddress(address);
};

interface FormDataState {
  tokenAddress: string;
  currencyAddress: string;
  presaleImage: File | null;
  presaleRate: string;
  listingRate: string;
  hardCap: string;
  softCap: string;
  minContribution: string;
  maxContribution: string;
  liquidityBps: string;
  lockupDuration: string;
  start: string;
  end: string;
  claimDelayMinutes: string;
  useVesting: boolean;
  vestingTgePercent: string;
  vestingCycleDays: string;
  leftoverTokenOption: string;
  slippageBps: string;
  whitelistType: string;
  merkleRoot: string;
  nftContractAddress: string;
}

const CreatePresalePage: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { writeContractAsync } = useWriteContract();
  const [formData, setFormData] = useState<FormDataState>({
    tokenAddress: "",
    currencyAddress: "",
    presaleImage: null,
    presaleRate: "100",
    listingRate: "80",
    hardCap: "",
    softCap: "",
    minContribution: "0.1",
    maxContribution: "1",
    liquidityBps: "7000",
    lockupDuration: (30 * 24 * 60 * 60).toString(),
    start: formatDateForInput(new Date(Date.now() + 5 * 60 * 1000)),
    end: formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    claimDelayMinutes: "10",
    useVesting: false,
    vestingTgePercent: "10",
    vestingCycleDays: "30",
    leftoverTokenOption: "0",
    slippageBps: "500",
    whitelistType: "0",
    merkleRoot: "",
    nftContractAddress: "",
  });
  const [tokenDeposit, setTokenDeposit] = useState<string>("0");
  const [creationFee, setCreationFee] = useState<string>("0");
  const [creationFeeTokenAddress, setCreationFeeTokenAddress] = useState<
    string | null
  >(null);
  const [creationFeeTokenSymbol, setCreationFeeTokenSymbol] =
    useState<string>("ETH");
  const [status, setStatus] = useState<string>("Please connect your wallet.");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: receipt, isLoading: isTxPending } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Fetch factory fee and fee token
  const { data: creationFeeData } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "creationFee",
  });
  const { data: feeTokenAddress } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "feeToken",
  });

  // Fetch token details
  const { data: tokenDecimalsData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: isValidAddress(formData.tokenAddress) },
  });
  const { data: tokenSymbolData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: isValidAddress(formData.tokenAddress) },
  });
  const { data: tokenBalanceData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: isConnected && isValidAddress(formData.tokenAddress) },
  });

  // Initialize provider and fetch fee details
  useEffect(() => {
    const init = async () => {
      if (!FACTORY_ADDRESS || !isValidAddress(FACTORY_ADDRESS)) {
        setStatus("Configuration Error: Invalid Factory Address.");
        return;
      }
      try {
        if (creationFeeData && feeTokenAddress) {
          setCreationFeeTokenAddress(feeTokenAddress as `0x${string}`);
          if (feeTokenAddress !== zeroAddress) {
            const publicClient = getPublicClient(config);
            const feeTokenSymbol = (await publicClient.readContract({
              address: feeTokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "symbol",
            })) as string;
            const feeTokenDecimals = (await publicClient.readContract({
              address: feeTokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: "decimals",
            })) as number;
            setCreationFee(
              (Number(creationFeeData) / 10 ** feeTokenDecimals).toString()
            );
            setCreationFeeTokenSymbol(feeTokenSymbol);
          } else {
            setCreationFee((Number(creationFeeData) / 10 ** 18).toString());
            setCreationFeeTokenSymbol("ETH");
          }
          setStatus("Factory fee loaded. Ready to connect.");
        }
      } catch (error: any) {
        console.error("Error fetching fee details:", error);
        setStatus(
          `Error fetching fee details: ${
            error.message || "Unknown error"
          }. Check console.`
        );
      }
    };
    init();
  }, [creationFeeData, feeTokenAddress]);

  // Update token details
  useEffect(() => {
    if (tokenDecimalsData) setTokenDecimals(Number(tokenDecimalsData));
    if (tokenSymbolData) setTokenSymbol(tokenSymbolData as string);
    if (tokenBalanceData && tokenDecimalsData) {
      setTokenBalance(
        (Number(tokenBalanceData) / 10 ** Number(tokenDecimalsData)).toFixed(0)
      );
    }
  }, [tokenDecimalsData, tokenSymbolData, tokenBalanceData]);

  // Handle transaction receipt
  useEffect(() => {
    if (receipt && receipt.status === "success") {
      setStatus(`Presale created successfully! Tx: ${receipt.transactionHash}`);
      // Save presale data to Supabase
      const savePresale = async () => {
        try {
          const { error } = await supabase.from("presales").insert([
            {
              creator: address,
              token_address: formData.tokenAddress,
              currency_address: formData.currencyAddress || zeroAddress,
              presale_rate: formData.presaleRate,
              listing_rate: formData.listingRate,
              hard_cap: formData.hardCap,
              soft_cap: formData.softCap,
              min_contribution: formData.minContribution,
              max_contribution: formData.maxContribution,
              liquidity_bps: formData.liquidityBps,
              lockup_duration: formData.lockupDuration,
              start_time: formData.start,
              end_time: formData.end,
              claim_delay_minutes: formData.claimDelayMinutes,
              use_vesting: formData.useVesting,
              vesting_tge_percent: formData.vestingTgePercent,
              vesting_cycle_days: formData.vestingCycleDays,
              leftover_token_option: formData.leftoverTokenOption,
              slippage_bps: formData.slippageBps,
              whitelist_type: formData.whitelistType,
              merkle_root: formData.merkleRoot || zeroHash,
              nft_contract_address: formData.nftContractAddress || zeroAddress,
              transaction_hash: receipt.transactionHash,
              created_at: new Date().toISOString(),
            },
          ]);
          if (error) throw error;
          setStatus(
            `Presale created and saved successfully! Tx: ${receipt.transactionHash}`
          );
        } catch (error: any) {
          console.error("Error saving presale to Supabase:", error);
          setStatus(
            `Presale created but failed to save to Supabase: ${error.message}`
          );
        }
      };
      savePresale();
    } else if (receipt && receipt.status === "reverted") {
      setStatus("Transaction failed: Reverted. Check console.");
    }
  }, [receipt, address, formData]);

  const connectWallet = () => {
    if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    } else {
      setStatus("No wallet connectors available. Please install MetaMask.");
    }
  };

  const validateAndParseAddress = (
    addr: string,
    fieldName: string
  ): `0x${string}` => {
    if (addr && !isValidAddress(addr)) {
      setStatus(`Invalid ${fieldName} address.`);
      return zeroAddress as `0x${string}`;
    }
    return (addr || zeroAddress) as `0x${string}`;
  };

  const fetchTokenDetails = async (tokenAddress: string) => {
    if (!isValidAddress(tokenAddress)) {
      setTokenDecimals(18);
      setTokenSymbol("");
      setTokenBalance("0");
      if (tokenAddress)
        setStatus("Invalid token address for fetching details.");
      return false;
    }
    return true;
  };

  const calculateAndSetTokenDeposit = useCallback(async () => {
    if (!formData.tokenAddress || !isValidAddress(formData.tokenAddress)) {
      setTokenDeposit("0");
      return;
    }

    const allInputsValidForCalc =
      formData.hardCap &&
      parseFloat(formData.hardCap) > 0 &&
      formData.presaleRate &&
      parseFloat(formData.presaleRate) > 0 &&
      formData.listingRate &&
      parseFloat(formData.listingRate) > 0 &&
      formData.liquidityBps &&
      parseInt(formData.liquidityBps) > 0;

    if (!allInputsValidForCalc) {
      setTokenDeposit("0");
      return;
    }

    try {
      const publicClient = getPublicClient(config);
      const options = {
        tokenDeposit: BigInt(0),
        hardCap: parseEther(formData.hardCap || "0"),
        softCap: parseEther(formData.softCap || "0"),
        min: parseEther(formData.minContribution || "0"),
        max: parseEther(formData.maxContribution || "0"),
        presaleRate: BigInt(
          Math.floor(parseFloat(formData.presaleRate || "0"))
        ),
        listingRate: BigInt(
          Math.floor(parseFloat(formData.listingRate || "0"))
        ),
        liquidityBps: BigInt(parseInt(formData.liquidityBps || "0")),
        slippageBps: BigInt(parseInt(formData.slippageBps || "0")),
        start: formData.start
          ? BigInt(Math.floor(new Date(formData.start).getTime() / 1000))
          : BigInt(0),
        end: formData.end
          ? BigInt(Math.floor(new Date(formData.end).getTime() / 1000))
          : BigInt(0),
        lockupDuration: BigInt(parseInt(formData.lockupDuration || "0")),
        vestingPercentage: formData.useVesting
          ? BigInt(parseInt(formData.vestingTgePercent || "0") * 100)
          : BigInt(0),
        vestingDuration: formData.useVesting
          ? BigInt(parseInt(formData.vestingCycleDays || "0") * 24 * 60 * 60)
          : BigInt(0),
        leftoverTokenOption: BigInt(
          parseInt(formData.leftoverTokenOption || "0")
        ),
        currency: validateAndParseAddress(formData.currencyAddress, "Currency"),
        whitelistType: BigInt(parseInt(formData.whitelistType || "0")),
        merkleRoot: (formData.whitelistType === "1" && formData.merkleRoot
          ? formData.merkleRoot
          : zeroHash) as `0x${string}`,
        nftContractAddress: (formData.whitelistType === "2" &&
        formData.nftContractAddress
          ? validateAndParseAddress(formData.nftContractAddress, "NFT Contract")
          : zeroAddress) as `0x${string}`,
      };

      const totalTokensNeeded = (await publicClient.readContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi,
        functionName: "calculateTotalTokensNeededForPresale",
        args: [options, formData.tokenAddress as `0x${string}`],
      })) as bigint;

      const formattedTokens = (
        Number(totalTokensNeeded) /
        10 ** tokenDecimals
      ).toFixed(0);
      setTokenDeposit(formattedTokens);
      setStatus(
        `Required token deposit: ${formattedTokens} ${tokenSymbol || "tokens"}.`
      );
    } catch (error: any) {
      console.error("Error calculating token deposit:", error);
      setTokenDeposit("0");
      setStatus(
        `Error calculating token deposit: ${
          error.message || "Check inputs or console."
        }`
      );
    }
  }, [formData, tokenDecimals, tokenSymbol]);

  useEffect(() => {
    calculateAndSetTokenDeposit();
  }, [calculateAndSetTokenDeposit]);

  const handleInputChange = async (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let newFormData = { ...formData };

    if (type === "checkbox") {
      newFormData = {
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      };
    } else if (type === "file") {
      newFormData = {
        ...formData,
        [name]: (e.target as HTMLInputElement).files
          ? (e.target as HTMLInputElement).files![0]
          : null,
      };
    } else {
      newFormData = { ...formData, [name]: value };
    }
    setFormData(newFormData);
    setStatus("");

    if (name === "tokenAddress") {
      if (isValidAddress(value)) {
        await fetchTokenDetails(value);
      } else if (value !== "") {
        setStatus("Invalid token address format.");
        setTokenDecimals(18);
        setTokenSymbol("");
        setTokenBalance("0");
        setTokenDeposit("0");
      } else {
        setTokenDecimals(18);
        setTokenSymbol("");
        setTokenBalance("0");
        setTokenDeposit("0");
      }
    }
  };

  const checkTokenBalanceAndDetails = async () => {
    if (
      !isConnected ||
      !formData.tokenAddress ||
      !isValidAddress(formData.tokenAddress)
    ) {
      setStatus("Connect wallet and enter a valid token address.");
      return;
    }
    const fetched = await fetchTokenDetails(formData.tokenAddress);
    if (fetched && address && tokenBalanceData && tokenDecimalsData) {
      const formattedBalance = (
        Number(tokenBalanceData) /
        10 ** Number(tokenDecimalsData)
      ).toFixed(0);
      setTokenBalance(formattedBalance);
      setStatus(
        `Token: ${tokenSymbol}, Balance: ${formattedBalance}, Decimals: ${tokenDecimals}`
      );
    }
  };

  const approveToken = async (
    tokenAddr: string,
    amountToApprove: string,
    spenderAddr: string,
    tokenDecimalsToUse: number,
    tokenSymbolToUse: string,
    type: string
  ) => {
    if (
      !isConnected ||
      !tokenAddr ||
      !isValidAddress(tokenAddr) ||
      !spenderAddr ||
      !isValidAddress(spenderAddr)
    ) {
      setStatus(
        `Cannot approve: Invalid parameters or wallet not connected for ${type} approval.`
      );
      return false;
    }
    if (parseFloat(amountToApprove) <= 0 && type !== "Max") {
      setStatus(`Approval amount for ${type} must be positive.`);
      return false;
    }

    try {
      const amountInWei =
        type === "Max"
          ? BigInt(2 ** 256 - 1)
          : parseUnits(amountToApprove, tokenDecimalsToUse);
      setStatus(
        `Approving ${tokenSymbolToUse || type} (${amountToApprove})...`
      );
      const hash = await writeContractAsync({
        address: tokenAddr as `0x${string}`,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddr as `0x${string}`, amountInWei],
      });
      setTxHash(hash);
      return true;
    } catch (error: any) {
      console.error(`Error approving ${type}:`, error);
      setStatus(
        `Error approving ${type}: ${
          error.message || "Unknown error"
        }. Check console.`
      );
      return false;
    }
  };

  const handleApprovePresaleToken = () => {
    if (tokenDeposit === "0" || !formData.tokenAddress) {
      setStatus(
        "Calculate or enter valid token deposit and token address first."
      );
      return;
    }
    approveToken(
      formData.tokenAddress,
      tokenDeposit,
      FACTORY_ADDRESS,
      tokenDecimals,
      tokenSymbol,
      "Presale Token"
    );
  };

  const handleApproveFeeToken = async () => {
    if (!creationFeeTokenAddress || creationFeeTokenAddress === zeroAddress) {
      setStatus("Fee is in ETH, no token approval needed.");
      return;
    }
    if (parseFloat(creationFee) <= 0) {
      setStatus("Creation fee is zero, no approval needed.");
      return;
    }
    try {
      const publicClient = getPublicClient(config);
      const feeDecimals = (await publicClient.readContract({
        address: creationFeeTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      })) as number;
      await approveToken(
        creationFeeTokenAddress,
        creationFee,
        FACTORY_ADDRESS,
        feeDecimals,
        creationFeeTokenSymbol,
        "Fee Token"
      );
    } catch (err: any) {
      setStatus("Could not get fee token decimals for approval.");
      console.error("Fee token decimals error:", err);
    }
  };

  const createPresale = async () => {
    if (!isConnected) {
      setStatus("Please connect wallet.");
      return;
    }
    setStatus("Validating parameters...");

    if (
      !isValidAddress(formData.tokenAddress) ||
      formData.tokenAddress === zeroAddress
    ) {
      setStatus("Invalid or missing Token Address.");
      return;
    }
    if (tokenDeposit === "0" || parseFloat(tokenDeposit) <= 0) {
      setStatus(
        "Calculated token deposit is zero or invalid. Check parameters and recalculate."
      );
      return;
    }

    // Check presale token allowance
    const publicClient = getPublicClient(config);
    const requiredTokenAmountWei = parseUnits(tokenDeposit, tokenDecimals);
    const allowance = (await publicClient.readContract({
      address: formData.tokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address!, FACTORY_ADDRESS as `0x${string}`],
    })) as bigint;
    if (allowance < requiredTokenAmountWei) {
      setStatus(
        `Insufficient presale token allowance. Need ${tokenDeposit}, approved ${(
          Number(allowance) /
          10 ** tokenDecimals
        ).toFixed(0)}. Please approve.`
      );
      return;
    }

    // Check fee token allowance
    if (
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== zeroAddress &&
      parseFloat(creationFee) > 0
    ) {
      const feeTokenDecimals = (await publicClient.readContract({
        address: creationFeeTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals",
      })) as number;
      const requiredFeeAmountWei = parseUnits(creationFee, feeTokenDecimals);
      const feeAllowance = (await publicClient.readContract({
        address: creationFeeTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address!, FACTORY_ADDRESS as `0x${string}`],
      })) as bigint;
      if (feeAllowance < requiredFeeAmountWei) {
        setStatus(
          `Insufficient fee token allowance. Need ${creationFee} ${creationFeeTokenSymbol}. Please approve.`
        );
        return;
      }
    }

    setStatus("All checks passed. Preparing transaction...");

    try {
      const presaleOptions = {
        tokenDeposit: parseUnits(tokenDeposit, tokenDecimals),
        hardCap: parseEther(formData.hardCap),
        softCap: parseEther(formData.softCap),
        min: parseEther(formData.minContribution),
        max: parseEther(formData.maxContribution),
        presaleRate: BigInt(Math.floor(parseFloat(formData.presaleRate))),
        listingRate: BigInt(Math.floor(parseFloat(formData.listingRate))),
        liquidityBps: BigInt(parseInt(formData.liquidityBps)),
        slippageBps: BigInt(parseInt(formData.slippageBps)),
        start: BigInt(Math.floor(new Date(formData.start).getTime() / 1000)),
        end: BigInt(Math.floor(new Date(formData.end).getTime() / 1000)),
        lockupDuration: BigInt(parseInt(formData.lockupDuration)),
        vestingPercentage: formData.useVesting
          ? BigInt(parseInt(formData.vestingTgePercent) * 100)
          : BigInt(0),
        vestingDuration: formData.useVesting
          ? BigInt(parseInt(formData.vestingCycleDays) * 24 * 60 * 60)
          : BigInt(0),
        leftoverTokenOption: BigInt(parseInt(formData.leftoverTokenOption)),
        currency: validateAndParseAddress(formData.currencyAddress, "Currency"),
        whitelistType: BigInt(parseInt(formData.whitelistType)),
        merkleRoot: (formData.whitelistType === "1" && formData.merkleRoot
          ? formData.merkleRoot
          : zeroHash) as `0x${string}`,
        nftContractAddress: (formData.whitelistType === "2" &&
        formData.nftContractAddress
          ? validateAndParseAddress(formData.nftContractAddress, "NFT Contract")
          : zeroAddress) as `0x${string}`,
      };

      let txOptions: { gas: bigint; value?: bigint } = { gas: BigInt(5000000) };
      if (!creationFeeTokenAddress || creationFeeTokenAddress === zeroAddress) {
        if (parseFloat(creationFee) > 0) {
          txOptions.value = parseEther(creationFee);
        }
      }

      setStatus("Sending transaction to create presale...");
      try {
        const walletClient = await getWalletClient(config);
        const gasEstimate = await publicClient.estimateContractGas({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: factoryAbi,
          functionName: "createPresale",
          args: [
            presaleOptions,
            formData.tokenAddress as `0x${string}`,
            WETH_ADDRESS as `0x${string}`,
            UNISWAP_V2_ROUTER as `0x${string}`,
          ],
          account: address!,
          value: txOptions.value,
        });
        txOptions.gas = (gasEstimate * BigInt(120)) / BigInt(100);
        setStatus(
          `Gas estimated: ${txOptions.gas.toString()}. Creating presale...`
        );
      } catch (gasError: any) {
        console.warn("Gas estimation failed, using manual limit:", gasError);
        setStatus(
          `Gas estimation failed (${
            gasError.message || "Unknown reason"
          }), trying with manual gas limit.`
        );
      }

      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: factoryAbi,
        functionName: "createPresale",
        args: [
          presaleOptions,
          formData.tokenAddress as `0x${string}`,
          WETH_ADDRESS as `0x${string}`,
          UNISWAP_V2_ROUTER as `0x${string}`,
        ],
        gas: txOptions.gas,
        value: txOptions.value,
      });
      setTxHash(hash);
      setStatus(`Transaction sent: ${hash}. Waiting for confirmation...`);
    } catch (error: any) {
      console.error("Error creating presale:", error);
      setStatus(`Error creating presale: ${error.message || "Check console."}`);
    }
  };

  interface FormInputProps {
    label: string;
    name: keyof FormDataState | string;
    type?: string;
    placeholder?: string;
    value?: string | number | boolean;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    children?: React.ReactNode;
    info?: string;
    error?: string;
    required?: boolean;
    checked?: boolean;
    [key: string]: any;
=======
import { useState, useEffect, useMemo, useCallback, useRef } from "react"; // Added useCallback
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useEstimateGas,
  useFeeData,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { getEventSelector,  decodeEventLog } from 'viem';
import {
  parseUnits,
  zeroAddress,
  type Abi,
  formatUnits,
  encodeFunctionData,
  type Address,
  isAddress,
  maxUint256,
} from "viem";
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import ERC20Json from "@/abis/ERC20.json";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarIcon,
  Info,
  Loader2,
  ServerCrash,
   X,
  CheckCircle2,
  ArrowDownUp,
  BadgeEuro,
  ArrowDown,
  ArrowUp,
  // Droplets,
  // Percent,
  Clock,
  Coins,
  Copy,
  Rocket,
  // ClipboardCheck,
  // CircleDollarSign,
  Lock,
  Hash,
  ArrowRight,
  ArrowLeft,
   Image,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EstimatedFeeDisplay } from "@/pages/PresaleDetailPage";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMinutes, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
// import { Progress } from "@/components/ui/progress";
import { uploadPresaleImage } from "@/lib/supabase";


const factoryAbi = PresaleFactoryJson.abi as Abi;
const erc20Abi = ERC20Json as Abi;

// Attempt to get addresses from environment variables
let factoryAddress: Address | undefined;
let wethAddress: Address | undefined;
let uniswapRouterAddress: Address | undefined;

try {
  const envFactory = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS;
  if (envFactory && typeof envFactory === "string" && isAddress(envFactory)) {
    factoryAddress = envFactory;
  } else {
    console.error(
      "VITE_PRESALE_FACTORY_ADDRESS is missing or invalid in environment variables."
    );
>>>>>>> Stashed changes
  }

  const envWeth = import.meta.env.VITE_WETH_ADDRESS;
  if (envWeth && typeof envWeth === "string" && isAddress(envWeth)) {
    wethAddress = envWeth;
  } else {
    console.error(
      "VITE_WETH_ADDRESS is missing or invalid in environment variables."
    );
  }

  const envRouter = import.meta.env.VITE_UNISWAP_ROUTER_ADDRESS;
  if (envRouter && typeof envRouter === "string" && isAddress(envRouter)) {
    uniswapRouterAddress = envRouter;
  } else {
    console.error(
      "VITE_UNISWAP_ROUTER_ADDRESS is missing or invalid in environment variables."
    );
  }
} catch (e) {
  console.error("Error accessing environment variables:", e);
}

// Default values
const DEFAULT_LISTING_RATE = 100;
const DEFAULT_LIQUIDITY_RATE = 80;
const DEFAULT_LIQUIDITY_LOCK_DAYS = 30;
const DEFAULT_LIQUIDITY_PERCENT = 51;
const DEFAULT_START_DELAY_MINUTES = 5;
const DEFAULT_END_DURATION_DAYS = 7;
const DEFAULT_CLAIM_DELAY_MINUTES = 10;



// Helper function for strict numeric input handling
const handleNumericInput = (
  value: string,
  setter: (value: string) => void,
  allowDecimal: boolean = false,
  maxDigits?: number,
  maxDecimalPlaces?: number,
  maxValue?: number
) => {
  let sanitizedValue = value;
  const regex = allowDecimal ? /[^0-9.]/g : /[^0-9]/g;
  sanitizedValue = sanitizedValue.replace(regex, "");

  if (allowDecimal) {
    const parts = sanitizedValue.split(".");
    if (parts.length > 2) {
      sanitizedValue = parts[0] + "." + parts.slice(1).join("");
    }
    if (
      maxDecimalPlaces !== undefined &&
      parts[1] &&
      parts[1].length > maxDecimalPlaces
    ) {
      sanitizedValue = parts[0] + "." + parts[1].substring(0, maxDecimalPlaces);
    }
  }

  if (maxDigits !== undefined) {
    const currentDigits = sanitizedValue.replace(".", "").length;
    if (currentDigits > maxDigits) {
      return;
    }
  }

  if (
    sanitizedValue.length > 1 &&
    sanitizedValue.startsWith("0") &&
    !sanitizedValue.startsWith("0.")
  ) {
    sanitizedValue = sanitizedValue.substring(1);
  }
  if (sanitizedValue === ".") {
    sanitizedValue = "0.";
  }

  if (maxValue !== undefined) {
    try {
      const numericValue = parseFloat(sanitizedValue);
      if (!isNaN(numericValue) && numericValue > maxValue) {
        sanitizedValue = maxValue.toString();
      }
    } catch {}
  }

  setter(sanitizedValue);
};

const CreatePresalePage = () => {
  const navigate = useNavigate();
  const { address: userAddress, isConnected } = useAccount();
  const {
    writeContractAsync,
    data: hash,
    isPending: isWritePending,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });
  const { data: feeData } = useFeeData();

  // Image State
const [presaleImage, setPresaleImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string | null>(null);
const [isUploadingImage, setIsUploadingImage] = useState(false);
const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Stage State ---
  const [currentStage, setCurrentStage] = useState<number>(1);

  // --- Approval State & Hooks ---
  const [approvalHash, setApprovalHash] = useState<Address | undefined>();
  const { writeContractAsync: approveAsync } = useWriteContract();
  const { isLoading: isConfirmingApproval, isSuccess: isApprovedSuccess } =
    useWaitForTransactionReceipt({ hash: approvalHash });

  // --- Fee Token Approval State & Hooks ---
  const [feeTokenApprovalHash, setFeeTokenApprovalHash] = useState<
    Address | undefined
  >();
  const { writeContractAsync: approveFeeTokenAsync } = useWriteContract();
  const {
    isLoading: isConfirmingFeeTokenApproval,
    isSuccess: isFeeTokenApprovedSuccess,
  } = useWaitForTransactionReceipt({ hash: feeTokenApprovalHash });
  const [isApprovingFeeToken, setIsApprovingFeeToken] = useState(false);
  const [hasSufficientFeeTokenAllowance, setHasSufficientFeeTokenAllowance] =
    useState(false);

  // Form State
  const [tokenAddress, setTokenAddress] = useState<Address | "">("");
  const [currencyAddress] = useState<Address>(zeroAddress);
  const [ratePresale, setRatePresale] = useState(
    DEFAULT_LISTING_RATE.toString()
  );
  const [rateLiquidity, setRateLiquidity] = useState(
    DEFAULT_LIQUIDITY_RATE.toString()
  );
  const [hardCap, setHardCap] = useState("");
  const [softCap, setSoftCap] = useState("");
  const [minContribution, setMinContribution] = useState("");
  const [maxContribution, setMaxContribution] = useState("");
  const [liquidityPercent, setLiquidityPercent] = useState(
    DEFAULT_LIQUIDITY_PERCENT.toString()
  );
  const [liquidityLockDays, setLiquidityLockDays] = useState(
    DEFAULT_LIQUIDITY_LOCK_DAYS.toString()
  );
  const [startTime, setStartTime] = useState<Date | undefined>(
    addMinutes(new Date(), DEFAULT_START_DELAY_MINUTES)
  );
  const [endTime, setEndTime] = useState<Date | undefined>(
    addDays(new Date(), DEFAULT_END_DURATION_DAYS)
  );
  const [claimDelay, setClaimDelay] = useState(
    DEFAULT_CLAIM_DELAY_MINUTES.toString()
  );
  const [useVesting, setUseVesting] = useState(false);
  const [vestingTgePercent, setVestingTgePercent] = useState("10");
  const [vestingCycleDays, setVestingCycleDays] = useState("30");
  const [vestingCyclePercent, setVestingCyclePercent] = useState("10");
  const [leftoverTokenOption, setLeftoverTokenOption] = useState(2);

  // Whitelist State
  const [whitelistType, setWhitelistType] = useState<number>(0);
  const [nftContractAddress, setNftContractAddress] = useState<Address | "">(
    ""
  );


  // UI/Error State
  const [actionError, setActionError] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [hasSufficientAllowance, setHasSufficientAllowance] = useState(false);

const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Validate file size
  if (file.size > 2 * 1024 * 1024) {
    toast.error('Image too large', { description: 'Maximum file size is 2MB' });
    return;
  }
  
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    toast.error('Invalid file type', { description: 'Only JPG, PNG, and WebP are supported' });
    return;
  }
  
  setPresaleImage(file);
  
  // Create preview
  const reader = new FileReader();
  reader.onloadend = () => {
    setImagePreview(reader.result as string);
  };
  reader.readAsDataURL(file);
};

  // --- Check Config Addresses ---
  useEffect(() => {
    if (!factoryAddress) {
      setConfigError(
        "Configuration Error: Presale Factory address is not set."
      );
    } else if (!wethAddress) {
      setConfigError("Configuration Error: WETH address is not set.");
    } else if (!uniswapRouterAddress) {
      setConfigError("Configuration Error: Uniswap Router address is not set.");
    }
  }, []);

  // --- Factory Config ---
  const {
    data: factoryCreationFeeData,
    isLoading: isLoadingFactoryCreationFee,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "creationFee",
    query: { enabled: !!factoryAddress && isConnected },
  });
  const factoryCreationFee = useMemo(
    () =>
      typeof factoryCreationFeeData === "bigint"
        ? factoryCreationFeeData
        : undefined,
    [factoryCreationFeeData]
  );

  const {
    data: factoryFeeTokenAddressData,
    isLoading: isLoadingFactoryFeeToken,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "feeToken",
    query: { enabled: !!factoryAddress && isConnected },
  });
  const factoryFeeTokenAddress = useMemo(
    () =>
      typeof factoryFeeTokenAddressData === "string" &&
      isAddress(factoryFeeTokenAddressData)
        ? factoryFeeTokenAddressData
        : undefined,
    [factoryFeeTokenAddressData]
  );

  const {
    data: factoryFeeTokenDecimalsData,
    isLoading: isLoadingFactoryFeeTokenDecimals,
  } = useReadContract({
    address:
      factoryFeeTokenAddress === zeroAddress
        ? undefined
        : factoryFeeTokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: {
      enabled:
        !!factoryFeeTokenAddress &&
        factoryFeeTokenAddress !== zeroAddress &&
        isConnected,
    },
  });
  const factoryFeeTokenDecimals = useMemo(() => {
    if (factoryFeeTokenAddress === zeroAddress) return 18;
    return typeof factoryFeeTokenDecimalsData === "number" ||
      typeof factoryFeeTokenDecimalsData === "bigint"
      ? Number(factoryFeeTokenDecimalsData)
      : undefined;
  }, [factoryFeeTokenAddress, factoryFeeTokenDecimalsData]);

  const {
    data: factoryFeeTokenSymbolData,
    isLoading: isLoadingFactoryFeeTokenSymbol,
  } = useReadContract({
    address:
      factoryFeeTokenAddress === zeroAddress
        ? undefined
        : factoryFeeTokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: {
      enabled:
        !!factoryFeeTokenAddress &&
        factoryFeeTokenAddress !== zeroAddress &&
        isConnected,
    },
  });
  const factoryFeeTokenSymbol = useMemo(() => {
    if (factoryFeeTokenAddress === zeroAddress) return "ETH";
    return typeof factoryFeeTokenSymbolData === "string"
      ? factoryFeeTokenSymbolData
      : undefined;
  }, [factoryFeeTokenAddress, factoryFeeTokenSymbolData]);

  // --- Check Fee Token Allowance ---
  const { data: currentFeeTokenAllowance, refetch: refetchFeeTokenAllowance } =
    useReadContract({
      address:
        factoryFeeTokenAddress === zeroAddress
          ? undefined
          : factoryFeeTokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress!, factoryAddress!],
      query: {
        enabled:
          !!factoryFeeTokenAddress &&
          factoryFeeTokenAddress !== zeroAddress &&
          !!userAddress &&
          !!factoryAddress &&
          isConnected &&
          factoryCreationFee !== undefined &&
          factoryCreationFee > 0n,
      },
    });

  useEffect(() => {
    if (
      factoryFeeTokenAddress &&
      factoryFeeTokenAddress !== zeroAddress &&
      typeof factoryCreationFee === "bigint" &&
      typeof currentFeeTokenAllowance === "bigint"
    ) {
      setHasSufficientFeeTokenAllowance(
        currentFeeTokenAllowance >= factoryCreationFee
      );
    } else if (factoryFeeTokenAddress === zeroAddress) {
      setHasSufficientFeeTokenAllowance(true);
    }
  }, [factoryFeeTokenAddress, currentFeeTokenAllowance, factoryCreationFee]);

  useEffect(() => {
    if (isFeeTokenApprovedSuccess) {
      toast.success("Fee Token Approved Successfully!");
      refetchFeeTokenAllowance();
      setIsApprovingFeeToken(false);
    }
  }, [isFeeTokenApprovedSuccess, refetchFeeTokenAllowance]);

  // --- Derived Values ---
  const currencyDecimals = 18;
  const calculatedStartTime = useMemo(() => {
    return startTime ? BigInt(Math.floor(startTime.getTime() / 1000)) : 0n;
  }, [startTime]);
  const calculatedEndTime = useMemo(() => {
    return endTime ? BigInt(Math.floor(endTime.getTime() / 1000)) : 0n;
  }, [endTime]);
  const hardCapParsed = useMemo(() => {
    try {
      return parseUnits(hardCap || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [hardCap, currencyDecimals]);
  const softCapParsed = useMemo(() => {
    try {
      return parseUnits(softCap || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [softCap, currencyDecimals]);
  const minContributionParsed = useMemo(() => {
    try {
      return parseUnits(minContribution || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [minContribution, currencyDecimals]);
  const maxContributionParsed = useMemo(() => {
    try {
      return parseUnits(maxContribution || "0", currencyDecimals);
    } catch {
      return 0n;
    }
  }, [maxContribution, currencyDecimals]);

const publicClient = usePublicClient();

  // --- Fetch Token Decimals ---
  const { data: tokenDecimalsData, isLoading: isLoadingTokenDecimals } =
    useReadContract({
      address: tokenAddress && isAddress(tokenAddress) ? tokenAddress : undefined,
      abi: erc20Abi,
      functionName: "decimals",
      query: {
        enabled: !!tokenAddress && isAddress(tokenAddress),
      },
    });
  const tokenDecimals = useMemo(() => {
    return typeof tokenDecimalsData === "number" ||
      typeof tokenDecimalsData === "bigint"
      ? Number(tokenDecimalsData)
      : undefined;
  }, [tokenDecimalsData]);

  // --- Calculate Required Token Deposit ---
  const calculationOptions = useMemo(
    () => ({
      tokenDeposit: 0n,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n,
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration:
        BigInt(parseInt(liquidityLockDays || "0") * 24 * 60 * 60),
      vestingPercentage: useVesting
        ? BigInt(parseInt(vestingTgePercent || "0") * 100)
        : 0n,
      vestingDuration: useVesting
        ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60)
        : 0n,
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      whitelistType: BigInt(whitelistType),
      merkleRoot:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      nftContractAddress:
        whitelistType === 2 && isAddress(nftContractAddress)
          ? nftContractAddress
          : zeroAddress,
    }),
    [
      hardCapParsed,
      softCapParsed,
      minContributionParsed,
      maxContributionParsed,
      ratePresale,
      rateLiquidity,
      liquidityPercent,
      calculatedStartTime,
      calculatedEndTime,
      liquidityLockDays,
      useVesting,
      vestingTgePercent,
      vestingCycleDays,
      leftoverTokenOption,
      currencyAddress,
      whitelistType,
      nftContractAddress,
    ]
  );

  const {
    data: calculatedTokenDeposit,
    isLoading: isLoadingDepositCalc,
    error: depositCalcError,
  } = useReadContract({
    address: factoryAddress,
    abi: factoryAbi,
    functionName: "calculateTotalTokensNeededForPresale",
    args: [calculationOptions, tokenAddress && isAddress(tokenAddress) ? tokenAddress : zeroAddress],
    query: {
      enabled:
        !!factoryAddress &&
        !!tokenAddress &&
        isAddress(tokenAddress) &&
        hardCapParsed > 0n &&
        BigInt(ratePresale || "0") > 0n &&
        BigInt(rateLiquidity || "0") > 0n &&
        BigInt(parseInt(liquidityPercent || "0")) > 0n &&
        !isLoadingTokenDecimals &&
        tokenDecimals !== undefined,
      refetchInterval: false,
    },
  });

  // --- Check Allowance ---
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: tokenAddress && isAddress(tokenAddress) ? tokenAddress : undefined,
      abi: erc20Abi,
      functionName: "allowance",
      args: [userAddress!, factoryAddress!],
      query: {
        enabled:
          !!tokenAddress &&
          isAddress(tokenAddress) &&
          !!userAddress &&
          !!factoryAddress &&
          isConnected,
      },
    }
  );

  useEffect(() => {
    if (
      typeof calculatedTokenDeposit === "bigint" &&
      typeof currentAllowance === "bigint"
    ) {
      setHasSufficientAllowance(currentAllowance >= calculatedTokenDeposit);
    }
  }, [currentAllowance, calculatedTokenDeposit]);

  useEffect(() => {
    if (isApprovedSuccess) {
      toast.success("Token Approved Successfully!");
      refetchAllowance();
      setIsApproving(false);
    }
  }, [isApprovedSuccess, refetchAllowance]);

  // --- Prepare Contract Arguments ---
  const presaleOptionsArgs = useMemo(
    () => ({
      tokenDeposit:
        typeof calculatedTokenDeposit === "bigint"
          ? calculatedTokenDeposit
          : 0n,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale || "0"),
      listingRate: BigInt(rateLiquidity || "0"),
      liquidityBps: BigInt(parseInt(liquidityPercent || "0") * 100),
      slippageBps: 300n,
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration: BigInt(parseInt(liquidityLockDays || "0") * 24 * 60 * 60),
      vestingPercentage: useVesting
        ? BigInt(parseInt(vestingTgePercent || "0") * 100)
        : 0n,
      vestingDuration: useVesting
        ? BigInt(parseInt(vestingCycleDays || "0") * 24 * 60 * 60)
        : 0n,
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      whitelistType: BigInt(whitelistType),
      merkleRoot:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      nftContractAddress:
        whitelistType === 2 && isAddress(nftContractAddress)
          ? nftContractAddress
          : zeroAddress,
    }),
    [
      calculatedTokenDeposit,
      hardCapParsed,
      softCapParsed,
      minContributionParsed,
      maxContributionParsed,
      ratePresale,
      rateLiquidity,
      liquidityPercent,
      calculatedStartTime,
      calculatedEndTime,
      liquidityLockDays,
      useVesting,
      vestingTgePercent,
      vestingCycleDays,
      leftoverTokenOption,
      currencyAddress,
      vestingCyclePercent,
      whitelistType,
      nftContractAddress,
    ]
  );

  // --- Gas Estimation ---
  const { data: createGas } = useEstimateGas({
    to: factoryAddress,
    data: (() => {
      try {
        // Validate all addresses before encoding
        if (!tokenAddress || !isAddress(tokenAddress)) {
          console.warn("Invalid token address detected during gas estimation");
          return "0x"; // Return empty hex to prevent encoding error
        }
        
        if (!factoryAddress || !isAddress(factoryAddress)) {
          console.warn("Invalid factory address detected during gas estimation");
          return "0x";
        }
        
        if (!wethAddress || !isAddress(wethAddress)) {
          console.warn("Invalid WETH address detected during gas estimation");
          return "0x";
        }
        
        if (!uniswapRouterAddress || !isAddress(uniswapRouterAddress)) {
          console.warn("Invalid Uniswap Router address detected during gas estimation");
          return "0x";
        }
        
        // Only encode if all addresses are valid
        return encodeFunctionData({
          abi: factoryAbi,
          functionName: "createPresale",
          args: [
            presaleOptionsArgs,
            tokenAddress,
            wethAddress,
            uniswapRouterAddress,
          ],
        });
      } catch (error) {
        console.error("Error encoding function data:", error);
        return "0x"; // Return empty hex to prevent encoding error
      }
    })(),
    value:
      factoryFeeTokenAddress === zeroAddress &&
      typeof factoryCreationFee === "bigint"
        ? factoryCreationFee
        : 0n,
    account: userAddress,
    query: {
      enabled:
        !!factoryAddress &&
        !!wethAddress &&
        !!uniswapRouterAddress &&
        isConnected &&
        !!tokenAddress &&
        hardCapParsed > 0n &&
        softCapParsed > 0n &&
        presaleOptionsArgs.tokenDeposit > 0n &&
        !isLoadingDepositCalc,
    },
  });
  const calculateFee = (gas: bigint | undefined) =>
    gas && feeData?.gasPrice ? gas * feeData.gasPrice : undefined;
  const createFeeCost = calculateFee(createGas);

  // --- Effect Hooks ---
  useEffect(() => {
    if (isConfirmed) {
      toast.success("Presale Created Successfully!");
      navigate("/presales");
    }
  }, [isConfirmed, navigate]);


// 4. Add this useEffect to handle the transaction confirmation and image upload:
useEffect(() => {
  const uploadImage = async () => {
    if (isConfirmed && hash && presaleImage) {
      let transactionReceipt = null; // Define outside try block for wider scope
      
      try {
        setIsUploadingImage(true);
        
        // Check if publicClient is available
        if (!publicClient) {
          throw new Error("Public client is not available");
        }
        
        // Get the transaction receipt using wagmi's publicClient
        transactionReceipt = await publicClient.getTransactionReceipt({ hash });
        
        if (!transactionReceipt || !transactionReceipt.logs) {
          throw new Error("Transaction receipt or logs not available");
        }
        
        // Extract the presale address from the logs
        const presaleAddress = extractPresaleAddressFromLogs(transactionReceipt.logs);
        
        if (!presaleAddress) {
          throw new Error("Could not extract presale address from transaction logs");
        }
        
        // Upload the image with the presale address (don't assign to unused variable)
        await uploadPresaleImage(presaleImage, presaleAddress);
        
        toast.success("Image Uploaded", {
          description: "Your presale image has been uploaded successfully.",
        });
        
        // Navigate to the presale detail page
        navigate(`/presale/${presaleAddress}`);
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Image Upload Failed", {
          description: `Error: ${(error as Error).message}`,
        });
        
        // Try to navigate even if image upload fails
        try {
          if (transactionReceipt && transactionReceipt.logs) {
            const presaleAddress = extractPresaleAddressFromLogs(transactionReceipt.logs);
            if (presaleAddress) {
              navigate(`/presale/${presaleAddress}`);
            }
          }
        } catch (navError) {
          console.error("Error navigating after failed upload:", navError);
        }
      } finally {
        setIsUploadingImage(false);
      }
    }
  };
  
  if (isConfirmed && hash) {
    uploadImage();
  }
}, [isConfirmed, hash, presaleImage, navigate, publicClient]);



  // --- Action Handlers ---
  const handleApproveFeeToken = async () => {
    if (
      !factoryFeeTokenAddress ||
      factoryFeeTokenAddress === zeroAddress ||
      !factoryAddress ||
      typeof factoryCreationFee !== "bigint" ||
      factoryCreationFee <= 0n
    ) {
      toast.error("Fee Approval Error", {
        description:
          "Missing fee token address, factory address, or fee amount for approval.",
      });
      return;
    }
    setActionError("");
    setIsApprovingFeeToken(true);
    try {
      const hash = await approveFeeTokenAsync({
        address: factoryFeeTokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [factoryAddress, factoryCreationFee],
      });
      setFeeTokenApprovalHash(hash);
      toast.info("Fee Token Approval Sent", {
        description: "Waiting for confirmation...",
      });
    } catch (error: any) {
      console.error("Fee token approval error:", error);
      const displayError =
        error?.shortMessage ||
        error?.message ||
        "An unknown error occurred during fee token approval.";
      setActionError(`Fee token approval failed: ${displayError}`);
      toast.error("Fee Token Approval Failed", { description: displayError });
      setIsApprovingFeeToken(false);
    }
  };

  const handleApprove = async () => {
    if (
      !tokenAddress ||
      !isAddress(tokenAddress) ||
      !factoryAddress ||
      typeof calculatedTokenDeposit !== "bigint" ||
      calculatedTokenDeposit <= 0n
    ) {
      toast.error("Approval Error", {
        description:
          "Missing token address, factory address, or deposit amount for approval.",
      });
      return;
    }
    setActionError("");
    setIsApproving(true);
    try {
      const hash = await approveAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [factoryAddress, maxUint256],
      });
      setApprovalHash(hash);
      toast.info("Approval Transaction Sent", {
        description: "Waiting for confirmation...",
      });
    } catch (error: any) {
      console.error("Approval error:", error);
      const displayError =
        error?.shortMessage ||
        error?.message ||
        "An unknown error occurred during approval.";
      setActionError(`Approval failed: ${displayError}`);
      toast.error("Approval Failed", { description: displayError });
      setIsApproving(false);
    }
  };


// The full handleCreatePresale function
const handleCreatePresale = async () => {
  // Final validation before creating
  if (!validateAllStages(true)) {
    // validateAllStages will show toast on error
    return;
  }

  // Additional address validation to prevent runtime errors
  if (!tokenAddress || !isAddress(tokenAddress)) {
    toast.error("Invalid Token Address", {
      description: "Please enter a valid token address before creating the presale."
    });
    setCurrentStage(1); // Return to token input stage
    return;
  }

  if (whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress))) {
    toast.error("Invalid NFT Contract Address", {
      description: "Please enter a valid NFT contract address for whitelist."
    });
    setCurrentStage(3); // Return to whitelist stage
    return;
  }

  setActionError("");
  try {
    // Check if publicClient is available
    if (!publicClient) {
      throw new Error("Public client is not available");
    }
    
    const ethToSend =
      factoryFeeTokenAddress === zeroAddress &&
      typeof factoryCreationFee === "bigint"
        ? factoryCreationFee
        : 0n;

    // Ensure all addresses are valid before proceeding
    if (!factoryAddress || !isAddress(factoryAddress)) {
      throw new Error("Invalid factory address configuration");
    }
    
    if (!wethAddress || !isAddress(wethAddress)) {
      throw new Error("Invalid WETH address configuration");
    }
    
    if (!uniswapRouterAddress || !isAddress(uniswapRouterAddress)) {
      throw new Error("Invalid Uniswap Router address configuration");
    }

    // Prepare the presale options
    const presaleOptionsArgs = {
      tokenDeposit: calculatedTokenDeposit,
      hardCap: hardCapParsed,
      softCap: softCapParsed,
      min: minContributionParsed,
      max: maxContributionParsed,
      presaleRate: BigInt(ratePresale),
      listingRate: BigInt(rateLiquidity),
      liquidityBps: BigInt(parseInt(liquidityPercent) * 100),
      slippageBps: 500n, // 5% slippage
      start: calculatedStartTime,
      end: calculatedEndTime,
      lockupDuration: BigInt(parseInt(liquidityLockDays) * 86400), // days to seconds
      vestingPercentage: useVesting ? BigInt(parseInt(vestingTgePercent) * 100) : 0n, // Set to 0 if not using vesting
      vestingDuration: useVesting ? BigInt(parseInt(vestingCycleDays) * 86400) : 0n, // days to seconds
      leftoverTokenOption: BigInt(leftoverTokenOption),
      currency: currencyAddress,
      whitelistType: whitelistType,
      merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
      nftContractAddress: whitelistType === 2 && nftContractAddress ? nftContractAddress : zeroAddress,
    };

    // *** ADD DEBUG LOGGING HERE ***
    console.log("DEBUG: Calling createPresale with:", {
      options: presaleOptionsArgs,
      token: tokenAddress,
      weth: wethAddress,
      router: uniswapRouterAddress,
      value: ethToSend.toString(), // Log value as string for readability
    });

    // Send the transaction
    const txHash = await writeContractAsync({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "createPresale",
      args: [
        presaleOptionsArgs,
        tokenAddress,
        wethAddress,
        uniswapRouterAddress,
      ],
      value: ethToSend,
    });
    
    toast.info("Create Presale Transaction Sent", {
      description: "Waiting for confirmation...",
    });
    
    // Wait for transaction confirmation using publicClient
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // *** ADD THIS CHECK ***
    if (receipt.status === 'success') {
      // Transaction SUCCEEDED
      toast.success("Transaction Confirmed Successfully!");

      // Extract presale address from logs
      let presaleAddress = null;
      if (receipt.logs) { // Check if logs exist (should for success)
        presaleAddress = extractPresaleAddressFromLogs(receipt.logs);
      }

      // If we have a presale address, upload the image and navigate
      if (presaleAddress) {
        // Upload image if available
        if (presaleImage) {
          setIsUploadingImage(true);
          try {
            await uploadPresaleImage(presaleImage, presaleAddress);
            toast.success("Image uploaded successfully");
          } catch (error) {
            console.error("Error uploading image:", error);
            toast.error("Failed to upload image", {
              description: error instanceof Error ? error.message : "Unknown error"
            });
          } finally {
            setIsUploadingImage(false);
          }
        }
        toast.success("Presale created and configured!");
        navigate(`/presale/${presaleAddress}`);
      } else {
        // This case might indicate an issue with log extraction even on success
        console.error("Transaction succeeded but failed to extract presale address from logs.", receipt);
        toast.error("Presale Created, But Address Extraction Failed", {
          description: "Please check the transaction on a block explorer."
        });
        // Navigate to a general page as a fallback
        navigate('/presales');
      }
    } else {
      // *** HANDLE TRANSACTION FAILURE ***
      // Transaction FAILED (reverted)
      console.error("Transaction failed (reverted). Receipt:", receipt);
      setActionError("Transaction failed on the blockchain. It may have been reverted.");
      toast.error("Presale Creation Failed", {
        description: "The transaction was reverted on the blockchain. Please check your parameters (e.g., start time) and try again."
      });
      // Do not attempt log extraction or navigation
    }
    
  } catch (error: any) {
    console.error("Create presale error:", error);
    const displayError =
      error?.shortMessage ||
      error?.message ||
      "An unknown error occurred during presale creation.";
    setActionError(`Presale creation failed: ${displayError}`);
    toast.error("Presale Creation Failed", { description: displayError });
  }
};


 // Ensure this import is added/present at the top

// ... (keep existing imports and code before the function)

// Pre-calculate or define the event signature hash outside the component if possible,
// or inside if factoryAbi is only available there.
// Note: This assumes factoryAbi is available in this scope.
let presaleCreatedEventSignature: string | undefined;
try {
  // Use the known signature string directly for simplicity and robustness
  presaleCreatedEventSignature = getEventSelector("PresaleCreated(address,address,address,uint256,uint256)");
  console.log("Using PresaleCreated event signature:", presaleCreatedEventSignature);
} catch (e) {
   console.error("Error generating event selector:", e);
}


// Robust function to extract presale address from logs
const extractPresaleAddressFromLogs = (logs: ReadonlyArray<any>): string | null => { // Use ReadonlyArray if applicable from wagmi/viem types
  if (!presaleCreatedEventSignature) {
     console.error("PresaleCreated event signature hash is not available.");
     return null;
  }
  if (!factoryAddress) {
     console.error("Factory address is not available for log filtering.");
     return null;
  }

  console.log(`Searching for event signature: ${presaleCreatedEventSignature} from factory: ${factoryAddress} in ${logs.length} logs`);

  for (const log of logs) {
    // Check 1: Does the log come from our factory?
    if (log.address?.toLowerCase() !== factoryAddress?.toLowerCase()) {
      continue; // Skip logs from other contracts
    }

    // Check 2: Does the event signature match PresaleCreated?
    if (log.topics && log.topics[0] === presaleCreatedEventSignature) {
       console.log("Found potential PresaleCreated event log:", log);
      try {
        // Decode the log using the ABI to easily access parameters
        const decodedLog = decodeEventLog({
          abi: factoryAbi, // Ensure factoryAbi is accessible here
          data: log.data,
          topics: log.topics as any, // Cast topics if needed based on viem version
        });

        // Access the presaleContract address by name (more robust)
        if (decodedLog.eventName === 'PresaleCreated' && decodedLog.args && typeof decodedLog.args === 'object' && 'presaleContract' in decodedLog.args) {
           const presaleAddress = decodedLog.args.presaleContract as Address; // Type assertion
           if (isAddress(presaleAddress)) {
             console.log('Successfully extracted presale address via decoding:', presaleAddress);
             return presaleAddress;
           } else {
              console.warn('Decoded presaleContract address is invalid:', presaleAddress);
           }
        } else {
           console.warn('Decoded log did not match expected eventName or args structure. Decoded:', decodedLog);
        }
      } catch (error) {
        console.error('Error decoding PresaleCreated event log:', error);
        // Fallback to topic index if decoding fails (less ideal but better than nothing)
        if (log.topics.length > 2) { // Need at least signature + creator + presaleContract topics
           const potentialAddress = `0x${log.topics[2].slice(-40)}`;
           if (isAddress(potentialAddress)) {
             console.warn('Extracted presale address using topic index as fallback:', potentialAddress);
             return potentialAddress;
           } else {
              console.warn('Fallback topic index extraction resulted in invalid address:', potentialAddress);
           }
        }
      }
    }
  }
  console.error('Could not find PresaleCreated event log or extract address from provided logs.');
  return null;
};


  // --- Stage Validation Logic ---
  const validateStage1 = useCallback(() => {
    if (!tokenAddress || !isAddress(tokenAddress)) {
      toast.error("Validation Error", { description: "Please enter a valid Token Address." });
      return false;
    }
    if (tokenDecimals === undefined) {
      toast.error("Validation Error", { description: "Token decimals could not be loaded." });
      return false;
    }
    if (!ratePresale || parseFloat(ratePresale) <= 0) {
      toast.error("Validation Error", { description: "Presale Rate must be a positive number." });
      return false;
    }
    if (!rateLiquidity || parseFloat(rateLiquidity) <= 0) {
      toast.error("Validation Error", { description: "Listing Rate must be a positive number." });
      return false;
    }
    if (!hardCap || parseFloat(hardCap) <= 0) {
      toast.error("Validation Error", { description: "Hard Cap must be a positive number." });
      return false;
    }
    if (!softCap || parseFloat(softCap) <= 0) {
      toast.error("Validation Error", { description: "Soft Cap must be a positive number." });
      return false;
    }
    if (softCapParsed > hardCapParsed) {
      toast.error("Validation Error", { description: "Soft Cap cannot be greater than Hard Cap." });
      return false;
    }
    if (!minContribution || parseFloat(minContribution) <= 0) {
      toast.error("Validation Error", { description: "Min Contribution must be a positive number." });
      return false;
    }
    if (!maxContribution || parseFloat(maxContribution) <= 0) {
      toast.error("Validation Error", { description: "Max Contribution must be a positive number." });
      return false;
    }
    if (maxContributionParsed < minContributionParsed) {
      toast.error("Validation Error", { description: "Max Contribution must be greater than or equal to Min Contribution." });
      return false;
    }
    return true;
  }, [
    tokenAddress,
    tokenDecimals,
    ratePresale,
    rateLiquidity,
    hardCap,
    softCap,
    minContribution,
    maxContribution,
    softCapParsed,
    hardCapParsed,
    minContributionParsed,
    maxContributionParsed,
  ]);

  const validateStage2 = useCallback(() => {
    const liqPercentNum = parseInt(liquidityPercent || "0");
    if (liqPercentNum <= 0 || liqPercentNum > 100) {
      toast.error("Validation Error", { description: "Liquidity Percent must be between 1 and 100." });
      return false;
    }
    if (!liquidityLockDays || parseInt(liquidityLockDays) < 0) {
      toast.error("Validation Error", { description: "Liquidity Lock Days cannot be negative." });
      return false;
    }
    if (!startTime) {
      toast.error("Validation Error", { description: "Please select a Start Time." });
      return false;
    }
    if (!endTime) {
      toast.error("Validation Error", { description: "Please select an End Time." });
      return false;
    }
    if (endTime <= startTime) {
      toast.error("Validation Error", { description: "End Time must be after Start Time." });
      return false;
    }
    if (startTime <= new Date()) {
      toast.error("Validation Error", { description: "Start Time must be in the future." });
      return false;
    }
    if (!claimDelay || parseInt(claimDelay) < 0) {
      toast.error("Validation Error", { description: "Claim Delay cannot be negative." });
      return false;
    }
    if (useVesting) {
      const tgePercentNum = parseInt(vestingTgePercent || "0");
      if (tgePercentNum < 0 || tgePercentNum > 100) {
        toast.error("Validation Error", { description: "TGE Percent must be between 0 and 100." });
        return false;
      }
      if (!vestingCycleDays || parseInt(vestingCycleDays) <= 0) {
        toast.error("Validation Error", { description: "Vesting Cycle Length must be positive." });
        return false;
      }
      const cyclePercentNum = parseInt(vestingCyclePercent || "0");
      if (cyclePercentNum <= 0 || cyclePercentNum > 100) {
        toast.error("Validation Error", { description: "Vesting Cycle Release must be between 1 and 100." });
        return false;
      }
    }
    return true;
  }, [
    liquidityPercent,
    liquidityLockDays,
    startTime,
    endTime,
    claimDelay,
    useVesting,
    vestingTgePercent,
    vestingCycleDays,
    vestingCyclePercent,
  ]);

  const validateStage3 = useCallback(() => {
    if (whitelistType === 2 && (!nftContractAddress || !isAddress(nftContractAddress))) {
      toast.error("Validation Error", { description: "Please enter a valid NFT Contract Address for NFT whitelist." });
      return false;
    }
    if (isLoadingDepositCalc) {
      toast.warning("Calculation Pending", { description: "Waiting for token deposit calculation to complete." });
      return false;
    }
    if (depositCalcError || typeof calculatedTokenDeposit !== "bigint" || calculatedTokenDeposit <= 0n) {
      toast.error("Calculation Error", { description: `Could not calculate required token deposit. Error: ${depositCalcError?.message || "Unknown error"}` });
      return false;
    }
    if (!hasSufficientAllowance) {
      toast.error("Approval Error", { description: "Presale tokens not sufficiently approved. Please approve." });
      return false;
    }
    if (factoryFeeTokenAddress && factoryFeeTokenAddress !== zeroAddress && !hasSufficientFeeTokenAllowance) {
      toast.error("Approval Error", { description: "Fee tokens not sufficiently approved. Please approve." });
      return false;
    }
    if (factoryCreationFee === undefined) {
      toast.error("Fee Error", { description: "Creation fee not loaded or invalid." });
      return false;
    }
    return true;
  }, [
    whitelistType,
    nftContractAddress,
    isLoadingDepositCalc,
    depositCalcError,
    calculatedTokenDeposit,
    hasSufficientAllowance,
    factoryFeeTokenAddress,
    hasSufficientFeeTokenAllowance,
    factoryCreationFee,
  ]);

  // Combined validation for final submission
  const validateAllStages = useCallback((showToast = false) => {
    if (!validateStage1()) {
      if (showToast) toast.error("Error in Stage 1", { description: "Please review Token & Basic Configuration." });
      setCurrentStage(1);
      return false;
    }
    if (!validateStage2()) {
      if (showToast) toast.error("Error in Stage 2", { description: "Please review Schedule & Distribution." });
      setCurrentStage(2);
      return false;
    }
    if (!validateStage3()) {
      if (showToast) toast.error("Error in Stage 3", { description: "Please review Security & Review." });
      setCurrentStage(3);
      return false;
    }
    return true;
  }, [validateStage1, validateStage2, validateStage3]);

  // --- Navigation Handlers ---
  const handleNextStage = () => {
    setActionError(""); // Clear previous errors
    if (currentStage === 1) {
      if (validateStage1()) {
        setCurrentStage(2);
      }
    } else if (currentStage === 2) {
      if (validateStage2()) {
        setCurrentStage(3);
      }
    }
  };

  const handlePreviousStage = () => {
    setActionError(""); // Clear previous errors
    setCurrentStage((prev) => Math.max(1, prev - 1));
  };

  // --- Render Logic ---
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
        <Alert
          variant="destructive"
          className="max-w-md bg-destructive/10 border-destructive/20 text-destructive shadow-card"
        >
          <ServerCrash className="h-5 w-5" />
          <AlertTitle className="text-lg font-heading">
            Configuration Error
          </AlertTitle>
          <AlertDescription className="text-sm">{configError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background animate-fade-in">
        <Alert
          variant="destructive"
          className="max-w-md bg-destructive/10 border-destructive/20 text-destructive shadow-card"
        >
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="text-lg font-heading">
            Wallet Not Connected
          </AlertTitle>
          <AlertDescription className="text-sm">
            Please connect your wallet to create a presale.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isActionLoading = isWritePending || isConfirming || isApproving || isConfirmingApproval || isApprovingFeeToken || isConfirmingFeeTokenApproval;

  // Determine if calculation is possible
  const canCalculateDeposit =
    !!factoryAddress &&
    !!tokenAddress &&
    isAddress(tokenAddress) &&
    hardCapParsed > 0n &&
    BigInt(ratePresale || "0") > 0n &&
    BigInt(rateLiquidity || "0") > 0n &&
    BigInt(parseInt(liquidityPercent || "0")) > 0n &&
    !isLoadingTokenDecimals &&
    tokenDecimals !== undefined;

  const stageTitles = [
    "Token & Basic Configuration",
    "Schedule & Distribution",
    "Security & Review",
  ];

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Create Your Token Presale
        </h1>

        {!isConnected ? (
          <button
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition ease-in-out duration-150 font-medium mb-4"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        ) : null}

        {status && (
          <div
            className={`p-3 mb-4 rounded-md text-sm ${
              status.toLowerCase().includes("error")
                ? "bg-red-100 text-red-700"
                : status.toLowerCase().includes("success")
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {status}
          </div>
        )}

        {isConnected && (
          <div className="space-y-4">
            <SectionTitle title="Token & Currency Information" />
            <FormInput
              label="Token Address"
              name="tokenAddress"
              value={formData.tokenAddress}
              onChange={handleInputChange}
              placeholder="0x..."
              required
            />
            <FormInput
              label="Currency Address"
              name="currencyAddress"
              value={formData.currencyAddress}
              onChange={handleInputChange}
              placeholder="Leave empty for ETH (Native Currency)"
              info="e.g., USDC, USDT contract address"
            />
            <FormInput
              label="Presale Image (Optional)"
              name="presaleImage"
              type="file"
              onChange={handleInputChange}
              info="Select an image file"
            />

            <SectionTitle title="Sale Parameters" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Presale Rate"
                name="presaleRate"
                type="number"
                value={formData.presaleRate}
                onChange={handleInputChange}
                placeholder="Tokens per ETH"
                required
                info={`Tokens per ${
                  formData.currencyAddress ? "selected currency" : "ETH"
                }`}
              />
              <FormInput
                label="Listing Rate"
                name="listingRate"
                type="number"
                value={formData.listingRate}
                onChange={handleInputChange}
                placeholder="Tokens per ETH for LP"
                required
                info="For initial DEX liquidity"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Hard Cap"
                name="hardCap"
                type="number"
                value={formData.hardCap}
                onChange={handleInputChange}
                placeholder="e.g., 100"
                required
                info={`In ${
                  formData.currencyAddress ? "selected currency" : "ETH"
                }`}
              />
              <FormInput
                label="Soft Cap"
                name="softCap"
                type="number"
                value={formData.softCap}
                onChange={handleInputChange}
                placeholder="e.g., 50"
                required
                info={`In ${
                  formData.currencyAddress ? "selected currency" : "ETH"
                }`}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Minimum Contribution"
                name="minContribution"
                type="number"
                value={formData.minContribution}
                onChange={handleInputChange}
                placeholder="e.g., 0.1"
                required
                info={`Per user, in ${
                  formData.currencyAddress ? "selected currency" : "ETH"
                }`}
              />
              <FormInput
                label="Maximum Contribution"
                name="maxContribution"
                type="number"
                value={formData.maxContribution}
                onChange={handleInputChange}
                placeholder="e.g., 1"
                required
                info={`Per user, in ${
                  formData.currencyAddress ? "selected currency" : "ETH"
                }`}
              />
=======
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 py-12 px-4 md:px-6 lg:px-8">
        <Card className="max-w-4xl mx-auto border shadow-xl bg-background/95 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary-900 to-primary-800 text-primary-foreground rounded-t-lg px-6 py-8 relative">
            <div 
              className="absolute inset-0 opacity-10 mix-blend-overlay"
              style={{ backgroundImage: "url('/api/placeholder/1000/300')" }}
            ></div>
            <div className="relative z-10">
              <div className="flex items-center mb-2">
                <span className="bg-white/20 text-xs font-medium text-white px-2.5 py-1 rounded-full mr-2">
                  New
                </span>
                <span className="text-xs text-white/70">
                  Create and configure your token presale in minutes
                </span>
              </div>
              <CardTitle className="text-3xl font-heading text-white flex items-center gap-2">
                <Rocket className="h-8 w-8" />
                Create New Presale
              </CardTitle>
              <CardDescription className="text-white/80 mt-2">
                Follow the steps below to launch your token presale.
              </CardDescription>
            </div>
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 px-6">
              <div className="w-full h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white" 
                  style={{ width: `${(currentStage / 3) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-white/80 mt-1.5">
                <span>Stage {currentStage} of 3</span>
                <span>{stageTitles[currentStage - 1]}</span>
              </div>
>>>>>>> Stashed changes
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            {/* Stage 1: Token & Basic Configuration */}
            {currentStage === 1 && (
              <div className="space-y-8 animate-fade-in">
                {/* Token Address */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Token Details
                    </h3>
                  </div>

<<<<<<< Updated upstream
            <SectionTitle title="Vesting (Optional)" />
            <div className="flex items-center">
              <FormInput
                label=""
                name="useVesting"
                type="checkbox"
                checked={formData.useVesting}
                onChange={handleInputChange}
              />
              <label
                htmlFor="useVesting"
                className="ml-2 text-sm font-medium text-gray-700 cursor-pointer"
              >
                Enable Vesting for Participants
              </label>
            </div>
=======
                  <div className="space-y-3 animate-slide-up">
                    <Label
                      htmlFor="tokenAddress"
                      className="text-base font-medium flex items-center"
                    >
                      Token Address <span className="text-destructive ml-1">*</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover border-input text-popover-foreground">
                          <p className="max-w-xs">
                            Enter the ERC-20 token contract address that you want to
                            use for this presale.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="relative">
                      <Input
                        id="tokenAddress"
                        placeholder="0x..."
                        value={tokenAddress}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\s+/g, "");
                          let pfx = "";
                          if (val.toLowerCase().startsWith("0x")) {
                            pfx = val.substring(0, 2);
                            val = val.substring(2);
                          }
                          val = val.replace(/[^0-9a-fA-F]/gi, "").substring(0, 40);
                          setTokenAddress((pfx + val) as Address);
                        }}
                        disabled={isActionLoading}
                        className={`text-foreground pr-10 font-mono text-sm ${
                          tokenAddress && !isAddress(tokenAddress) ? "border-destructive focus-visible:ring-destructive" : ""
                        }`}
                      />
                      {tokenAddress && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary-900"
                          onClick={() =>
                            navigator.clipboard.writeText(tokenAddress)
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {isLoadingTokenDecimals && (
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-900" />{" "}
                        Fetching token decimals...
                      </p>
                    )}
                    {tokenAddress && !isAddress(tokenAddress) && (
                      <p className="text-sm text-destructive flex items-center">
                        <AlertCircle className="mr-2 h-4 w-4" /> 
                        {(tokenAddress as string).startsWith("0x") ? (
                          (tokenAddress as string).length < 42 ? 
                            `Address is ${42 - (tokenAddress as string).length} character${42 - (tokenAddress as string).length === 1 ? '' : 's'} short` : 
                            (tokenAddress as string).length > 42 ? 
                              `Address is ${(tokenAddress as string).length - 42} character${(tokenAddress as string).length - 42 === 1 ? '' : 's'} too long` : 
                              "Invalid address format"
                        ) : "Address must start with 0x"}
                      </p>
                    )}
                    {tokenAddress &&
                      isAddress(tokenAddress) &&
                      !isLoadingTokenDecimals &&
                      tokenDecimals === undefined && (
                        <p className="text-sm text-destructive flex items-center">
                          <AlertCircle className="mr-2 h-4 w-4" /> Could not fetch
                          decimals for this token.
                        </p>
                      )}
                    {tokenAddress &&
                      isAddress(tokenAddress) &&
                      !isLoadingTokenDecimals &&
                      tokenDecimals !== undefined && (
                        <p className="text-sm text-primary-800 bg-primary-50 py-1.5 px-3 rounded-md inline-flex items-center">
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Token Decimals:{" "}
                          <span className="font-medium ml-1">{tokenDecimals}</span>
                        </p>
                      )}
                    {!tokenAddress && (
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Info className="mr-2 h-4 w-4" /> Enter the address of the
                        token you want to sell.
                      </p>
                    )}
                  </div>
>>>>>>> Stashed changes

{/* Image Upload Section */}
<div className="space-y-4 mt-6">
  <Label htmlFor="presaleImage">Presale Image (Optional)</Label>
  <div className="flex flex-col space-y-2">
    {imagePreview && (
      <div className="relative w-full h-48 bg-muted rounded-md overflow-hidden">
        <img 
          src={imagePreview} 
          alt="Presale preview" 
          className="w-full h-full object-cover"
        />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2"
          onClick={() => {
            setPresaleImage(null);
            setImagePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )}
    
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          ref={fileInputRef}
          id="presaleImage"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="flex-1"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Image className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
    
    <p className="text-xs text-muted-foreground">
      Recommended: Square image (800x800px). Max size: 2MB. Formats: JPG, PNG, WebP.
    </p>
  </div>
</div>


                  {/* Currency */}
                  <div className="space-y-3 animate-slide-up">
                    <Label className="text-base font-medium">Currency</Label>
                    <div className="flex items-center space-x-2 bg-muted p-3 rounded-md text-muted-foreground border border-input">
                      <div className="bg-primary-100 text-primary-800 p-1.5 rounded-full">
                        <Coins className="h-5 w-5" />
                      </div>
                      <span className="flex-1">ETH (Native Currency)</span>
                      <Badge
                        variant="secondary"
                        className="bg-primary-50 text-primary-700 border-none"
                      >
                        Default
                      </Badge>
                    </div>
                  </div>
                </section>

                {/* Rates */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Pricing & Rates
                    </h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <ArrowDownUp className="h-4 w-4 mr-1" />
                      <span>Token Economics</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                    <div className="space-y-3">
                      <Label
                        htmlFor="ratePresale"
                        className="text-base font-medium flex items-center"
                      >
                        Presale Rate{" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="ratePresale"
                          type="text"
                          inputMode="numeric"
                          placeholder={`e.g., ${DEFAULT_LISTING_RATE}`}
                          value={ratePresale}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setRatePresale,
                              false
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <Hash className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        How many tokens per 1 ETH?
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="rateLiquidity"
                        className="text-base font-medium flex items-center"
                      >
                        Listing Rate{" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="rateLiquidity"
                          type="text"
                          inputMode="numeric"
                          placeholder={`e.g., ${DEFAULT_LIQUIDITY_RATE}`}
                          value={rateLiquidity}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setRateLiquidity,
                              false
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <Hash className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Initial Uniswap listing rate (tokens per 1 ETH).
                      </p>
                      <Alert className="mt-2 bg-primary-50 border-primary-100 text-primary-900">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          The listing rate determines the initial price on the DEX
                          after presale completion.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </section>

                {/* Caps */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Funding Caps
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                    <div className="space-y-3">
                      <Label
                        htmlFor="hardCap"
                        className="text-base font-medium flex items-center"
                      >
                        Hard Cap (ETH){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="hardCap"
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g., 100"
                          value={hardCap}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setHardCap,
                              true,
                              undefined,
                              currencyDecimals
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <BadgeEuro className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Maximum ETH to raise.
                        </p>
                        {hardCap &&
                          softCap &&
                          parseFloat(hardCap) > 0 &&
                          parseFloat(softCap) > 0 && (
                            <p className="text-xs text-primary-900">
                              {(
                                (parseFloat(softCap) / parseFloat(hardCap)) *
                                100
                              ).toFixed(0)}
                              % ratio
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="softCap"
                        className="text-base font-medium flex items-center"
                      >
                        Soft Cap (ETH){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="softCap"
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g., 50"
                          value={softCap}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setSoftCap,
                              true,
                              undefined,
                              currencyDecimals
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <BadgeEuro className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Minimum ETH needed for success.
                      </p>
                    </div>
                  </div>

                  {hardCap &&
                    softCap &&
                    parseFloat(hardCap) > 0 &&
                    parseFloat(softCap) > 0 && (
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-primary-700 to-primary-500 h-2.5 rounded-full"
                          style={{
                            width: `${Math.max(
                              10,
                              Math.min(
                                100,
                                (parseFloat(softCap) / parseFloat(hardCap)) * 100
                              )
                            )}%`,
                          }}
                        ></div>
                      </div>
                    )}
                </section>

                {/* Contributions */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Participant Limits
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                    <div className="space-y-3">
                      <Label
                        htmlFor="minContribution"
                        className="text-base font-medium flex items-center"
                      >
                        Min Contribution (ETH){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="minContribution"
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g., 0.1"
                          value={minContribution}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setMinContribution,
                              true,
                              undefined,
                              currencyDecimals
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <ArrowDown className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Minimum amount each participant can contribute.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="maxContribution"
                        className="text-base font-medium flex items-center"
                      >
                        Max Contribution (ETH){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="maxContribution"
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g., 5"
                          value={maxContribution}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setMaxContribution,
                              true,
                              undefined,
                              currencyDecimals
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <ArrowUp className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Maximum amount each participant can contribute.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Stage 2: Schedule & Distribution */}
            {currentStage === 2 && (
              <div className="space-y-8 animate-fade-in">
                {/* Dates & Times */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Schedule
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                    <div className="space-y-3">
                      <Label
                        htmlFor="startTime"
                        className="text-base font-medium flex items-center"
                      >
                        Start Time <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal text-foreground border-input group",
                              !startTime && "text-muted-foreground"
                            )}
                            disabled={isActionLoading}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary-900 group-hover:text-primary-800" />
                            {startTime ? (
                              format(startTime, "PPP HH:mm")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card border-input shadow-card">
                          <Calendar
                            mode="single"
                            selected={startTime}
                            onSelect={setStartTime}
                            initialFocus
                            className="rounded-t-md border-b"
                          />
                          <div className="p-3 border-t border-input">
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                value={startTime ? format(startTime, "HH:mm") : ""}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value
                                    .split(":")
                                    .map(Number);
                                  const newDate = startTime
                                    ? new Date(startTime)
                                    : new Date();
                                  newDate.setHours(hours, minutes);
                                  setStartTime(newDate);
                                }}
                                className="text-foreground"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-muted-foreground">
                        Presale start time (UTC).
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="endTime"
                        className="text-base font-medium flex items-center"
                      >
                        End Time <span className="text-destructive ml-1">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal text-foreground border-input group",
                              !endTime && "text-muted-foreground"
                            )}
                            disabled={isActionLoading}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary-900 group-hover:text-primary-800" />
                            {endTime ? (
                              format(endTime, "PPP HH:mm")
                            ) : (
                              <span>Pick a date and time</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card border-input shadow-card">
                          <Calendar
                            mode="single"
                            selected={endTime}
                            onSelect={setEndTime}
                            initialFocus
                            className="rounded-t-md border-b"
                          />
                          <div className="p-3 border-t border-input">
                            <div className="flex items-center">
                              <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="time"
                                value={endTime ? format(endTime, "HH:mm") : ""}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value
                                    .split(":")
                                    .map(Number);
                                  const newDate = endTime
                                    ? new Date(endTime)
                                    : new Date();
                                  newDate.setHours(hours, minutes);
                                  setEndTime(newDate);
                                }}
                                className="text-foreground"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <p className="text-sm text-muted-foreground">
                        Presale end time (UTC).
                      </p>
                    </div>
                  </div>

                  {startTime && endTime && (
                    <div className="px-4 py-3 bg-primary-50 rounded-lg border border-primary-100 text-primary-900 flex items-center text-sm">
                      <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Duration: </span>
                        {(() => {
                          const diffMs = endTime.getTime() - startTime.getTime();
                          const diffDays = Math.floor(
                            diffMs / (1000 * 60 * 60 * 24)
                          );
                          const diffHours = Math.floor(
                            (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
                          );
                          return `${diffDays} days, ${diffHours} hours`;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Claim Delay */}
                  <div className="space-y-3 animate-slide-up mt-4">
                    <Label
                      htmlFor="claimDelay"
                      className="text-base font-medium flex items-center"
                    >
                      Claim Delay (Minutes){" "}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="claimDelay"
                        type="text"
                        inputMode="numeric"
                        placeholder={`e.g., ${DEFAULT_CLAIM_DELAY_MINUTES}`}
                        value={claimDelay}
                        onChange={(e) =>
                          handleNumericInput(e.target.value, setClaimDelay, false)
                        }
                        disabled={isActionLoading}
                        className="text-foreground pl-10"
                      />
                      <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                        <Clock className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Delay before token claims are available after presale end.
                    </p>
                  </div>
                </section>

                {/* Liquidity Settings */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Liquidity Settings
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                    <div className="space-y-3">
                      <Label
                        htmlFor="liquidityPercent"
                        className="text-base font-medium flex items-center"
                      >
                        Liquidity Percent (%){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="liquidityPercent"
                          type="text"
                          inputMode="numeric"
                          placeholder={`e.g., ${DEFAULT_LIQUIDITY_PERCENT}`}
                          value={liquidityPercent}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setLiquidityPercent,
                              false,
                              3,
                              0,
                              100
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pr-8"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                          %
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Percentage of raised ETH used for Uniswap liquidity.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Label
                        htmlFor="liquidityLockDays"
                        className="text-base font-medium flex items-center"
                      >
                        Liquidity Lock (Days){" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="liquidityLockDays"
                          type="text"
                          inputMode="numeric"
                          placeholder={`e.g., ${DEFAULT_LIQUIDITY_LOCK_DAYS}`}
                          value={liquidityLockDays}
                          onChange={(e) =>
                            handleNumericInput(
                              e.target.value,
                              setLiquidityLockDays,
                              false
                            )
                          }
                          disabled={isActionLoading}
                          className="text-foreground pl-10"
                        />
                        <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                          <Lock className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Days liquidity is locked after presale.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Vesting Options */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Distribution & Vesting
                    </h3>
                  </div>

                  <Card className="bg-muted/50 border shadow-sm animate-slide-up overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-primary-50/80 to-primary-50/30 border-b border-primary-100/30">
                      <CardTitle className="text-lg font-heading flex items-center">
                        <div className="flex items-center justify-center w-6 h-6 bg-primary-100 rounded-full mr-2">
                          <Checkbox
                            id="useVesting"
                            checked={useVesting}
                            onCheckedChange={(checked) =>
                              setUseVesting(Boolean(checked))
                            }
                            className="border-primary-900 data-[state=checked]:bg-primary-900"
                            disabled={isActionLoading}
                          />
                        </div>
                        <Label htmlFor="useVesting" className="cursor-pointer">
                          Enable Vesting (Optional)
                        </Label>
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Distribute tokens gradually over time instead of all at
                        once.
                      </CardDescription>
                    </CardHeader>
                    {useVesting && (
                      <CardContent className="space-y-6 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-3">
                            <Label
                              htmlFor="vestingTgePercent"
                              className="text-base font-medium"
                            >
                              TGE Percent (%)
                              <span className="text-destructive ml-1">*</span>
                            </Label>
                            <div className="relative">
                              <Input
                                id="vestingTgePercent"
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g., 10"
                                value={vestingTgePercent}
                                onChange={(e) =>
                                  handleNumericInput(
                                    e.target.value,
                                    setVestingTgePercent,
                                    false,
                                    3,
                                    0,
                                    100
                                  )
                                }
                                disabled={isActionLoading}
                                className="text-foreground pr-8"
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                                %
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Percentage released at Token Generation Event.
                            </p>
                          </div>
                          <div className="space-y-3">
                            <Label
                              htmlFor="vestingCycleDays"
                              className="text-base font-medium"
                            >
                              Cycle Length (Days)
                              <span className="text-destructive ml-1">*</span>
                            </Label>
                            <div className="relative">
                              <Input
                                id="vestingCycleDays"
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g., 30"
                                value={vestingCycleDays}
                                onChange={(e) =>
                                  handleNumericInput(
                                    e.target.value,
                                    setVestingCycleDays,
                                    false
                                  )
                                }
                                disabled={isActionLoading}
                                className="text-foreground pl-10"
                              />
                              <div className="absolute inset-y-0 left-0 px-3 flex items-center pointer-events-none text-muted-foreground">
                                <CalendarIcon className="h-4 w-4" />
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Duration of each vesting cycle in days.
                            </p>
                          </div>
                          <div className="space-y-3">
                            <Label
                              htmlFor="vestingCyclePercent"
                              className="text-base font-medium"
                            >
                              Cycle Release (%)
                              <span className="text-destructive ml-1">*</span>
                            </Label>
                            <div className="relative">
                              <Input
                                id="vestingCyclePercent"
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g., 10"
                                value={vestingCyclePercent}
                                onChange={(e) =>
                                  handleNumericInput(
                                    e.target.value,
                                    setVestingCyclePercent,
                                    false,
                                    3,
                                    0,
                                    100
                                  )
                                }
                                disabled={isActionLoading}
                                className="text-foreground pr-8"
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-muted-foreground">
                                %
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Percentage released per cycle.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </section>

                {/* Leftover Token Handling */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Unsold Tokens
                    </h3>
                  </div>
                  <div className="space-y-3 animate-slide-up">
                    <Label
                      htmlFor="leftoverTokenOption"
                      className="text-base font-medium flex items-center"
                    >
                      Handling Unsold Tokens{" "}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    <Select
                      value={leftoverTokenOption.toString()}
                      onValueChange={(value) =>
                        setLeftoverTokenOption(parseInt(value))
                      }
                      disabled={isActionLoading}
                    >
                      <SelectTrigger
                        id="leftoverTokenOption"
                        className="text-foreground border-input"
                      >
                        <SelectValue placeholder="Select option..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input text-popover-foreground">
                        <SelectItem value="0">Burn Unsold Tokens</SelectItem>
                        <SelectItem value="1">Refund to Creator</SelectItem>
                        <SelectItem value="2">Add to Liquidity</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose what happens to tokens not sold during the presale.
                    </p>
                  </div>
                </section>
              </div>
            )}

            {/* Stage 3: Security & Review */}
            {currentStage === 3 && (
              <div className="space-y-8 animate-fade-in">
                {/* Whitelist Configuration */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Whitelist Configuration
                    </h3>
                  </div>
                  <div className="space-y-3 animate-slide-up">
                    <Label
                      htmlFor="whitelistType"
                      className="text-base font-medium flex items-center"
                    >
                      Whitelist Type
                    </Label>
                    <Select
                      value={whitelistType.toString()}
                      onValueChange={(value) =>
                        setWhitelistType(parseInt(value))
                      }
                      disabled={isActionLoading}
                    >
                      <SelectTrigger
                        id="whitelistType"
                        className="text-foreground border-input"
                      >
                        <SelectValue placeholder="Select whitelist type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-input text-popover-foreground">
                        <SelectItem value="0">None (Public)</SelectItem>
                        <SelectItem value="1" disabled>
                          Merkle Proof (Coming Soon)
                        </SelectItem>
                        <SelectItem value="2">NFT Holder</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Restrict participation based on criteria.
                    </p>
                  </div>

<<<<<<< Updated upstream
            <div className="mt-8 space-y-3">
              <button
                type="button"
                className="w-full bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                onClick={checkTokenBalanceAndDetails}
                disabled={isTxPending}
              >
                Refresh Token Balance & Details
              </button>
              {creationFeeTokenAddress &&
                creationFeeTokenAddress !== zeroAddress &&
                parseFloat(creationFee) > 0 && (
                  <button
                    type="button"
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
                    onClick={handleApproveFeeToken}
                    disabled={isTxPending}
                  >
                    Approve Fee Token ({creationFeeTokenSymbol})
                  </button>
                )}
              <button
                type="button"
                className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
                onClick={handleApprovePresaleToken}
                disabled={isTxPending}
              >
                Approve Presale Token ({tokenSymbol || "Token"})
              </button>
              <button
                type="button"
                className="w-full bg-green-600 text-white py-2.5 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 font-semibold text-lg"
                onClick={createPresale}
                disabled={isTxPending}
              >
                Create Presale
              </button>
            </div>
          </div>
        )}
=======
                  {whitelistType === 2 && (
                    <div className="space-y-3 animate-slide-up">
                      <Label
                        htmlFor="nftContractAddress"
                        className="text-base font-medium flex items-center"
                      >
                        NFT Contract Address{" "}
                        <span className="text-destructive ml-1">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="nftContractAddress"
                          placeholder="0x..."
                          value={nftContractAddress}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\s+/g, "");
                            let pfx = "";
                            if (val.toLowerCase().startsWith("0x")) {
                              pfx = val.substring(0, 2);
                              val = val.substring(2);
                            }
                            val = val.replace(/[^0-9a-fA-F]/gi, "").substring(0, 40);
                            setNftContractAddress((pfx + val) as Address);
                          }}
                          disabled={isActionLoading}
                          className="text-foreground pr-10 font-mono text-sm"
                        />
                        {nftContractAddress && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary-900"
                            onClick={() =>
                              navigator.clipboard.writeText(nftContractAddress)
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enter the contract address of the required NFT collection.
                      </p>
                    </div>
                  )}
                </section>

                {/* Calculated Token Deposit Display */}
                <section className="space-y-6 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Token Deposit
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-medium flex items-center">
                      Required Token Deposit
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-popover border-input text-popover-foreground">
                          <p className="max-w-xs">
                            Total tokens required for the presale and liquidity pool
                            based on your settings.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="p-4 border border-input rounded-md bg-muted min-h-[48px] flex items-center">
                      {isLoadingDepositCalc && (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-900" />
                      )}
                      {canCalculateDeposit &&
                      !isLoadingDepositCalc &&
                      typeof calculatedTokenDeposit === "bigint" &&
                      tokenDecimals !== undefined ? (
                        <span className="text-foreground font-medium">
                          {formatUnits(calculatedTokenDeposit, tokenDecimals)}{" "}
                          Tokens
                        </span>
                      ) : canCalculateDeposit && isLoadingDepositCalc ? (
                        <span className="text-muted-foreground">
                          Calculating...
                        </span>
                      ) : depositCalcError ? (
                        <span className="text-destructive text-sm flex items-center">
                          <AlertCircle className="mr-2 h-4 w-4" /> Error calculating
                          deposit.
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Fill required fields to calculate.
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total tokens needed for presale and liquidity.
                    </p>
                  </div>
                </section>

                {/* Fees & Summary */}
                <section className="space-y-6 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-muted pb-2">
                    <h3 className="text-lg font-medium text-foreground">
                      Summary & Fees
                    </h3>
                  </div>
                  <Card className="bg-muted/50 border shadow-sm">
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex justify-between text-base">
                        <span className="flex items-center">
                          Creation Fee
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-popover border-input text-popover-foreground">
                              <p className="max-w-xs">
                                Fee charged by the presale factory to create the
                                presale.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span>
                          {isLoadingFactoryCreationFee ||
                          isLoadingFactoryFeeToken ||
                          isLoadingFactoryFeeTokenDecimals ||
                          isLoadingFactoryFeeTokenSymbol ? (
                            <span className="flex items-center">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-900" />{" "}
                              Loading fee...
                            </span>
                          ) : factoryCreationFee !== undefined &&
                            factoryFeeTokenDecimals !== undefined &&
                            factoryFeeTokenSymbol ? (
                            <span className="font-medium">
                              {formatUnits(
                                factoryCreationFee,
                                factoryFeeTokenDecimals
                              )}{" "}
                              {factoryFeeTokenSymbol}
                            </span>
                          ) : (
                            <span className="text-destructive flex items-center">
                              <AlertCircle className="mr-2 h-4 w-4" /> Error loading
                              fee
                            </span>
                          )}
                        </span>
                      </div>
                      {createFeeCost !== undefined && (
                        <div className="flex justify-between text-base">
                          <span className="flex items-center">
                            Estimated Gas Fee
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 ml-2 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-popover border-input text-popover-foreground">
                                <p className="max-w-xs">
                                  Estimated Ethereum network gas fee for deploying
                                  the presale contract.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </span>
                          <span className="font-medium">
                            <EstimatedFeeDisplay label="" fee={createFeeCost} />
                          </span>
                        </div>
                      )}
                      {actionError && (
                        <Alert
                          variant="destructive"
                          className="mt-4 bg-destructive/10 border-destructive/20 text-destructive"
                        >
                          <AlertCircle className="h-5 w-5" />
                          <AlertTitle className="text-base font-heading">
                            Error
                          </AlertTitle>
                          <AlertDescription className="text-sm">
                            {actionError}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </section>

                {/* Action Buttons */}
                <section className="space-y-6 animate-slide-up">
                  {isConnected &&
                  tokenAddress &&
                  isAddress(tokenAddress) &&
                  factoryAddress &&
                  typeof calculatedTokenDeposit === "bigint" &&
                  calculatedTokenDeposit > 0n &&
                  factoryCreationFee !== undefined &&
                  factoryFeeTokenAddress !== undefined &&
                  !configError ? (
                    !hasSufficientAllowance ? (
                      <Button
                        onClick={handleApprove}
                        disabled={
                          isLoadingDepositCalc ||
                          isApproving ||
                          isConfirmingApproval ||
                          isLoadingFactoryCreationFee ||
                          isLoadingFactoryFeeToken ||
                          isActionLoading
                        }
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg py-6 hover:from-yellow-600 hover:to-orange-600"
                      >
                        {isApproving || isConfirmingApproval ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                            Approving Presale Tokens...
                          </>
                        ) : (
                          "Approve Presale Tokens"
                        )}
                      </Button>
                    ) : factoryFeeTokenAddress !== zeroAddress &&
                      factoryCreationFee > 0n &&
                      !hasSufficientFeeTokenAllowance ? (
                      <Button
                        onClick={handleApproveFeeToken}
                        disabled={
                          isLoadingFactoryCreationFee ||
                          isLoadingFactoryFeeToken ||
                          isApprovingFeeToken ||
                          isConfirmingFeeTokenApproval ||
                          isActionLoading
                        }
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg py-6 hover:from-yellow-600 hover:to-orange-600"
                      >
                        {isApprovingFeeToken || isConfirmingFeeTokenApproval ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                            Approving Fee Token ({factoryFeeTokenSymbol})...
                          </>
                        ) : (
                          `Approve ${
                            factoryFeeTokenSymbol || "Fee Token"
                          } for Creation Fee`
                        )}
                      </Button>
                    ) : (
                      <Button
  onClick={handleCreatePresale}
  disabled={
    isLoadingDepositCalc ||
    isWritePending ||
    isConfirming ||
    isUploadingImage || // Add this condition
    isLoadingFactoryCreationFee ||
    isLoadingFactoryFeeToken ||
    isActionLoading
  }
  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg py-6 hover:from-green-600 hover:to-emerald-700"
>
  {isWritePending || isConfirming || isUploadingImage ? ( // Add isUploadingImage
    <>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
      {isUploadingImage 
        ? "Uploading Image..." 
        : "Creating Presale..."}
    </>
  ) : (
    "Create Presale"
  )}
</Button>

                    )
                  ) : (
                    <Button
                      disabled={true}
                      className="w-full text-lg py-6 bg-muted text-muted-foreground cursor-not-allowed"
                      title={
                        configError ||
                        "Connect wallet and fill required fields to enable actions."
                      }
                    >
                      {isLoadingFactoryCreationFee ||
                      isLoadingFactoryFeeToken ||
                      isLoadingDepositCalc ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
                          prerequisites...
                        </>
                      ) : (
                        "Create Presale"
                      )}
                    </Button>
                  )}
                </section>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-12 border-t pt-6">
              <Button
                variant="outline"
                onClick={handlePreviousStage}
                disabled={currentStage === 1 || isActionLoading}
                className="text-lg py-6 px-8"
              >
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back
              </Button>
              {currentStage < 3 ? (
                <Button
                  onClick={handleNextStage}
                  disabled={isActionLoading}
                  className="text-lg py-6 px-8 bg-gradient-to-r from-primary-900 to-primary-800 text-white hover:from-primary-800 hover:to-primary-700"
                >
                  Next
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                // Render the final action buttons directly here or keep them in Stage 3 section
                // For clarity, keeping the final action buttons within Stage 3 section above
                // This button is effectively replaced by the Approve/Create buttons in Stage 3
                <div className="w-[136px]"></div> // Placeholder to maintain layout
              )}
            </div>
          </CardContent>
        </Card>
>>>>>>> Stashed changes
      </div>
    </TooltipProvider>
  );
};

export default CreatePresalePage;