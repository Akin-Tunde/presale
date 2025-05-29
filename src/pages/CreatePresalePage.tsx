import React, { useState, useEffect, useCallback, ChangeEvent } from "react";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, parseUnits, isAddress, zeroAddress, zeroHash } from "viem";
// import { sepolia } from "viem/chains"; ///
// import { createConfig, http } from "@wagmi/core"; ///
import { getPublicClient } from "@wagmi/core";
import { supabase } from "@/lib/supabase";
// import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { config } from "@/lib/wagmiConfig"; // Adjust the import path as needed

// Wagmi configuration
// const config = createConfig({
//   chains: [sepolia],
//   transports: { [sepolia.id]: http() },
// });

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
    outputs: [],
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
  {
    name: "ERC20InsufficientBalance",
    type: "error",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
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
  {
    name: "ERC20InsufficientBalance",
    type: "error",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
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

// Helper function to save presale data to Supabase, including image upload
const savePresaleToSupabase = async (
  presaleFormData: FormDataState,
  creatorAddress: `0x${string}` | undefined,
  transactionHash: `0x${string}`
): Promise<{ success: boolean; message: string; imageUrl?: string }> => {
  if (!creatorAddress) {
    return { success: false, message: "Creator address is undefined." };
  }

  let presaleImageUrl: string | undefined = undefined;

  // 1. Handle image upload if presaleImage exists
  if (presaleFormData.presaleImage) {
    const file = presaleFormData.presaleImage;
    // Sanitize file name to prevent issues with special characters
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    // It's common to store public files in a 'public' folder within the bucket
    // or organize by user/presale ID if applicable.
    const filePath = `public/${fileName}`;

    try {
      console.log(
        `Attempting to upload ${filePath} to presale-images bucket...`
      );
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("presale-images") // Make sure 'presale-images' bucket exists in Supabase
        .upload(filePath, file, {
          cacheControl: "3600", // Cache for 1 hour
          upsert: false, // Set to true if you want to overwrite if file with same name exists
        });

      if (uploadError) {
        console.error("Supabase image upload error:", uploadError);
        // Decide if this error should prevent metadata saving.
        // For now, we'll proceed but won't have an image URL.
      } else if (uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("presale-images").getPublicUrl(filePath);
        presaleImageUrl = publicUrl;
        console.log("Image uploaded successfully:", presaleImageUrl);
      }
    } catch (e) {
      console.error("Exception during image upload:", e);
    }
  }

  // 2. Prepare data for Supabase table
  const dataToInsert = {
    creator: creatorAddress,
    token_address: presaleFormData.tokenAddress,
    currency_address: presaleFormData.currencyAddress,
    image_url: presaleImageUrl, // Store the public URL of the uploaded image
    presale_rate: presaleFormData.presaleRate,
    listing_rate: presaleFormData.listingRate,
    hard_cap: presaleFormData.hardCap,
    soft_cap: presaleFormData.softCap,
    min_contribution: presaleFormData.minContribution,
    max_contribution: presaleFormData.maxContribution,
    liquidity_bps: presaleFormData.liquidityBps,
    lockup_duration: presaleFormData.lockupDuration,
    start_time: presaleFormData.start,
    end_time: presaleFormData.end,
    claim_delay_minutes: presaleFormData.claimDelayMinutes,
    use_vesting: presaleFormData.useVesting,
    vesting_tge_percent: presaleFormData.vestingTgePercent,
    vesting_cycle_days: presaleFormData.vestingCycleDays,
    leftover_token_option: presaleFormData.leftoverTokenOption,
    slippage_bps: presaleFormData.slippageBps,
    whitelist_type: presaleFormData.whitelistType,
    merkle_root: presaleFormData.merkleRoot || zeroHash,
    nft_contract_address: presaleFormData.nftContractAddress || zeroAddress,
    transaction_hash: transactionHash,
    created_at: new Date().toISOString(),
  };

  // 3. Insert into Supabase 'presales' table
  try {
    const { error } = await supabase.from("presales").insert([dataToInsert]);
    if (error) {
      console.error("Supabase insert error:", error);
      return {
        success: false,
        message: `Failed to save presale to database: ${error.message}`,
      };
    }
    return {
      success: true,
      message: "Presale created and saved successfully!",
      imageUrl: presaleImageUrl,
    };
  } catch (error: any) {
    console.error("Exception during Supabase insert:", error);
    return {
      success: false,
      message: `Exception saving presale to database: ${error.message}`,
    };
  }
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
    currencyAddress: zeroAddress,
    presaleImage: null,
    presaleRate: "100",
    listingRate: "80",
    hardCap: "",
    softCap: "",
    minContribution: "0.1",
    maxContribution: "1",
    liquidityBps: "7000",
    lockupDuration: (1 * 30 * 24 * 60 * 60).toString(), // Default to 1 month in seconds
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
  const [status, setStatus] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { data: receipt, isLoading: isTxPending } =
    useWaitForTransactionReceipt({ hash: txHash });
  const [isTokenApproved, setIsTokenApproved] = useState(false);
  const [isFeeApproved, setIsFeeApproved] = useState(false);

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

  // Fetch allowances
  const { data: tokenAllowanceData } = useReadContract({
    address: formData.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, FACTORY_ADDRESS as `0x${string}`],
    query: { enabled: isConnected && isValidAddress(formData.tokenAddress) },
  });
  const { data: feeAllowanceData } = useReadContract({
    address: creationFeeTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, FACTORY_ADDRESS as `0x${string}`],
    query: {
      enabled:
        isConnected &&
        !!creationFeeTokenAddress &&
        creationFeeTokenAddress !== zeroAddress,
    },
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
          setStatus("");
        }
      } catch (error: any) {
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

  // Check approvals
  useEffect(() => {
    if (tokenAllowanceData && tokenDeposit !== "0") {
      const requiredAmount = parseUnits(tokenDeposit, tokenDecimals);
      setIsTokenApproved(Number(tokenAllowanceData) >= Number(requiredAmount));
    }
    if (
      feeAllowanceData &&
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== zeroAddress &&
      parseFloat(creationFee) > 0
    ) {
      const publicClient = getPublicClient(config);
      publicClient
        .readContract({
          address: creationFeeTokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "decimals",
        })
        .then((feeDecimals) => {
          const requiredFeeAmount = parseUnits(
            creationFee,
            Number(feeDecimals)
          );
          setIsFeeApproved(
            Number(feeAllowanceData) >= Number(requiredFeeAmount)
          );
        });
    } else if (
      creationFeeTokenAddress === zeroAddress ||
      parseFloat(creationFee) === 0
    ) {
      setIsFeeApproved(true);
    }
  }, [
    tokenAllowanceData,
    feeAllowanceData,
    tokenDeposit,
    creationFee,
    creationFeeTokenAddress,
    tokenDecimals,
  ]);

  // Handle transaction receipt
  useEffect(() => {
    if (receipt && receipt.status === "success") {
      setStatus(`Presale created successfully! Tx: ${receipt.transactionHash}`);

      // Call the new function to save data to Supabase
      savePresaleToSupabase(formData, address, receipt.transactionHash)
        .then((result) => {
          if (result.success) {
            setStatus(
              `${result.message} Tx: ${receipt.transactionHash}${
                result.imageUrl ? ` Image: ${result.imageUrl}` : ""
              }`
            );
          } else {
            setStatus(
              `Presale created on-chain, but DB save failed: ${result.message} Tx: ${receipt.transactionHash}`
            );
          }
        })
        .catch((error) => {
          setStatus(
            `Presale created on-chain, but an unexpected error occurred during DB save: ${error.message}`
          );
        });
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
        currency: zeroAddress as `0x${string}`,
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

    if (name === "lockupDuration" && type === "select-one") {
      const selectedMonths = parseInt(value);
      const durationInSeconds = selectedMonths * 30 * 24 * 60 * 60; // Assuming 30 days per month
      newFormData = {
        ...formData,
        lockupDuration: durationInSeconds.toString(),
      };
    } else if (type === "checkbox") {
      newFormData = {
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      };
    } else if (type === "file") {
      const file = (e.target as HTMLInputElement).files
        ? (e.target as HTMLInputElement).files![0]
        : null;
      newFormData = {
        ...formData,
        [name]: file,
      };
      if (file && name === "presaleImage") {
        setStatus(`Selected image: ${file.name}`);
      }
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

  const validateTimes = (): string | null => {
    const now = Date.now();
    const startTime = new Date(formData.start).getTime();
    const endTime = new Date(formData.end).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      return "Invalid date format for start or end time. Please ensure they are correctly set.";
    }

    // Start time must be at least (e.g.) 5 minutes in the future
    const minStartDelay = 5 * 60 * 1000;
    if (startTime <= now + minStartDelay) {
      return `Start time must be at least ${
        minStartDelay / (60 * 1000)
      } minutes in the future.`;
    }

    if (endTime <= startTime) {
      return "End time must be after start time.";
    }

    const minDuration = 1 * 60 * 60 * 1000; // 1 hour
    if (endTime - startTime < minDuration) {
      return "Presale duration must be at least 1 hour.";
    }

    const maxDuration = 90 * 24 * 60 * 60 * 1000; // 90 days
    if (endTime - startTime > maxDuration) {
      return "Presale duration cannot exceed 90 days.";
    }
    const maxStartAhead = 180 * 24 * 60 * 60 * 1000; // 180 days
    if (startTime > now + maxStartAhead) {
      return `Start time cannot be scheduled more than 180 days in the future. The provided 2025 dates might be too far out.`;
    }
    return null;
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
      setStatus(
        `Error approving ${type}: ${
          error.message || "Unknown error"
        }. Check console.`
      );
      return false;
    }
  };

  const handleApprove = async () => {
    if (tokenDeposit === "0" || !formData.tokenAddress) {
      setStatus(
        "Calculate or enter valid token deposit and token address first."
      );
      return;
    }

    const publicClient = getPublicClient(config);

    // Approve presale token
    if (!isTokenApproved) {
      const success = await approveToken(
        formData.tokenAddress,
        tokenDeposit,
        FACTORY_ADDRESS,
        tokenDecimals,
        tokenSymbol,
        "Presale Token"
      );
      if (success) return;
    }

    // Approve fee token
    if (
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== zeroAddress &&
      parseFloat(creationFee) > 0 &&
      !isFeeApproved
    ) {
      try {
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
      }
    }
  };

  const createPresale = async () => {
    if (!isConnected) {
      setStatus("Please connect wallet.");
      return;
    }
    setStatus("Validating parameters...");

    const timeValidationError = validateTimes();
    if (timeValidationError) {
      setStatus(timeValidationError);
      return;
    }

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

    if (!isTokenApproved || !isFeeApproved) {
      setStatus("Please approve tokens first.");
      return;
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
        currency: zeroAddress as `0x${string}`,
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
      const publicClient = getPublicClient(config);
      try {
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
      setStatus(`Error creating presale: ${error.message || "Check console."}`);
    }
  };

  interface FormInputProps {
    label: string;
    name: keyof FormDataState | string;
    type?: string;
    placeholder?: string;
    value?: string | number | boolean | File | null;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    children?: React.ReactNode;
    info?: string;
    error?: string;
    required?: boolean;
    checked?: boolean;
    [key: string]: any;
  }

  const FormInput: React.FC<FormInputProps> = ({
    label,
    name,
    type = "text",
    placeholder,
    value,
    onChange,
    children,
    info,
    error,
    required,
    checked,
    ...props
  }) => (
    <div className="relative mb-6 group">
      <label
        htmlFor={name as string}
        className="block text-base font-semibold text-[#BFD4BF] mb-2 transition-all duration-300 group-hover:text-[#D4E8D4]"
      >
        {label} {required && <span className="text-red-500">*</span>}
        {info && (
          <span className="text-sm text-[#BFD4BF]/70 ml-2">({info})</span>
        )}
      </label>
      {type === "checkbox" ? (
        <input
          type={type}
          id={name as string}
          name={name as string}
          checked={checked}
          onChange={onChange}
          className="h-5 w-5 text-[#BFD4BF] border-[#BFD4BF]/50 rounded focus:ring-[#BFD4BF]/50 focus:ring-2 cursor-pointer transition-all duration-300 hover:bg-[#BFD4BF]/10"
          {...props}
        />
      ) : type === "select" ? (
        <select
          id={name as string}
          name={name as string}
          value={value as string | number}
          onChange={onChange}
          className="w-full p-3 bg-[#1C2A4A] border border-[#BFD4BF]/20 rounded-xl shadow-sm focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 text-[#BFD4BF] text-base transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNOCAxMS41TDEyLjUgNy41SDMuNUw4IDExLjVaIiBmaWxsPSIjQkZENEJGIi8+PC9zdmc+')] bg-no-repeat bg-[right_0.75rem_center] bg-[length:12px_12px]"
          {...props}
        >
          {children}
        </select>
      ) : type === "file" ? (
        <div className="relative">
          <input
            type={type}
            id={name as string}
            name={name as string}
            onChange={onChange}
            className="w-full p-3 bg-[#1C2A4A] border border-[#BFD4BF]/20 rounded-xl shadow-sm text-[#BFD4BF] text-base file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#BFD4BF]/20 file:text-[#BFD4BF] file:font-semibold file:hover:bg-[#BFD4BF]/30 file:transition-all file:duration-300 cursor-pointer focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30"
            {...props}
          />
          {name === "presaleImage" && typeof value === "object" && value && (
            <span className="text-sm text-[#BFD4BF]/80 ml-2 mt-1 block">
              Selected: {(value as File).name}
            </span>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type={type}
            id={name as string}
            name={name as string}
            // Conditionally set value for non-file inputs
            value={type !== "file" ? (value as string | number) : undefined}
            placeholder={placeholder}
            onChange={onChange}
            className="w-full p-3 bg-[#1C2A4A] border border-[#BFD4BF]/20 rounded-xl shadow-sm focus:ring-2 focus:ring-[#BFD4BF]/50 focus:border-[#BFD4BF]/50 text-[#BFD4BF] text-base placeholder-[#BFD4BF]/50 transition-all duration-300 hover:shadow-[#BFD4BF]/10 hover:border-[#BFD4BF]/30"
            {...props}
          />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#BFD4BF]/10 to-[#BFD4BF]/5 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-500 mt-1.5 font-medium">{error}</p>
      )}
    </div>
  );

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-xl font-bold text-[#BFD4BF] mt-8 mb-4 pt-4 border-t border-[#BFD4BF]/20 relative">
      {title}
      <div className="absolute bottom-0 left-0 w-4 h-1 bg-[#BFD4BF] rounded-full" />
    </h2>
  );

  return (
    <div className="min-h-screen bg-emerald-100 flex items-center justify-center p-4 md:p-6 relative">
      <div className="relative bg-[#1C2526]/95 backdrop-blur-xl p-8 rounded-lg shadow-2xl shadow-[#BFD4BF]/5 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#BFD4BF]">
          Create Your Token Presale
        </h1>

        {!isConnected ? (
          <button
            className="w-full bg-[#BFD4BF] text-[#14213E] py-3 px-6 rounded-lg font-semibold text-lg hover:bg-[#D4E8D4] focus:outline-none focus:ring-2 focus:ring-[#BFD4BF]/50 transition-all duration-300 shadow-md hover:shadow-[#BFD4BF]/30"
            onClick={connectWallet}
          >
            Connect Wallet
          </button>
        ) : (
          <>
            <div className="space-y-6">
              <SectionTitle title="Token & Currency Information" />
              <FormInput
                label="Token Address"
                name="tokenAddress"
                value={formData.tokenAddress}
                onChange={handleInputChange}
                placeholder="0x..."
                required
              />
              <div className="mb-4 p-2 bg-[#1C2526] rounded-lg border-t border-[#BFD4BF]/20">
                <p className="text-sm font-medium text-[#BFD4BF]">
                  Currency: ETH
                </p>
              </div>
              <FormInput
                label="Presale Image (Optional)"
                name="presaleImage"
                type="file"
                value={formData.presaleImage} // Pass the file object to FormInput
                onChange={handleInputChange}
                info="Select an image file"
              />

              <SectionTitle title="Sale Settings" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Presale Rate"
                  name="presaleRate"
                  type="text"
                  value={formData.presaleRate}
                  onChange={handleInputChange}
                  placeholder="Tokens per ETH"
                  required
                  info="Tokens per ETH"
                />
                <FormInput
                  label="Listing Rate"
                  name="listingRate"
                  type="text"
                  value={formData.listingRate}
                  onChange={handleInputChange}
                  placeholder="Tokens per ETH for LP"
                  required
                  info="For DEX liquidity"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Hard Cap"
                  name="hardCap"
                  type="text"
                  value={formData.hardCap}
                  onChange={handleInputChange}
                  placeholder="e.g., 100"
                  required
                  info="In ETH"
                />
                <FormInput
                  label="Soft Cap"
                  name="softCap"
                  type="text"
                  value={formData.softCap}
                  onChange={handleInputChange}
                  placeholder="e.g., 50"
                  required
                  info="In ETH"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Min Contribution"
                  name="minContribution"
                  type="text"
                  value={formData.minContribution}
                  onChange={handleInputChange}
                  placeholder="e.g., 0.1"
                  required
                  info="Per user, in ETH"
                />
                <FormInput
                  label="Max Contribution"
                  name="maxContribution"
                  type="text"
                  value={formData.maxContribution}
                  onChange={handleInputChange}
                  placeholder="e.g., 1"
                  required
                  info="Per user, in ETH"
                />
              </div>

              <SectionTitle title="Liquidity & Schedule" />
              <FormInput
                label="Liquidity BPS"
                name="liquidityBps"
                type="select"
                value={formData.liquidityBps}
                onChange={handleInputChange}
                required
                info="% of funds for LP"
              >
                <option value="">Select %</option>
                <option value="5000">50%</option>
                <option value="6000">60%</option>
                <option value="7000">70%</option>
                <option value="8000">80%</option>
                <option value="9000">90%</option>
                <option value="10000">100%</option>
              </FormInput>
              <FormInput
                label="LP Lockup Duration (Months)"
                name="lockupDuration"
                type="select"
                value={(
                  parseInt(
                    formData.lockupDuration ||
                      (1 * 30 * 24 * 60 * 60).toString()
                  ) /
                  (30 * 24 * 60 * 60)
                ).toString()}
                onChange={handleInputChange}
                required
                info="Select lockup period in months"
              >
                {[...Array(6)].map((_, i) => {
                  const months = i + 1;
                  return (
                    <option key={months} value={months.toString()}>
                      {months} Month{months > 1 ? "s" : ""}
                    </option>
                  );
                })}
              </FormInput>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput
                  label="Start Time"
                  name="start"
                  type="datetime-local"
                  value={formData.start}
                  onChange={handleInputChange}
                  required
                />
                <FormInput
                  label="End Time"
                  name="end"
                  type="datetime-local"
                  value={formData.end}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <FormInput
                label="Claim Delay"
                name="claimDelayMinutes"
                type="text"
                value={formData.claimDelayMinutes}
                onChange={handleInputChange}
                placeholder="Minutes after presale"
                info="Informational"
              />
              <FormInput
                label="Slippage BPS"
                name="slippageBps"
                type="text"
                value={formData.slippageBps}
                onChange={handleInputChange}
                placeholder="0-10000 (e.g., 500 for 5%)"
                required
              />

              <SectionTitle title="Vesting" />
              <div className="flex items-center gap-3">
                <FormInput
                  label=""
                  name="useVesting"
                  type="checkbox"
                  checked={formData.useVesting}
                  onChange={handleInputChange}
                />
                <label
                  htmlFor="useVesting"
                  className="text-base font-semibold text-[#BFD4BF] cursor-pointer hover:text-[#D4E8D4]"
                >
                  Enable Vesting
                </label>
              </div>

              {formData.useVesting && (
                <div className="pl-6 space-y-6">
                  <FormInput
                    label="TGE %"
                    name="vestingTgePercent"
                    type="text"
                    value={formData.vestingTgePercent}
                    onChange={handleInputChange}
                    placeholder="0-100 (e.g., 10%)"
                    info="Tokens at TGE"
                  />
                  <FormInput
                    label="Vesting Days"
                    name="vestingCycleDays"
                    type="text"
                    value={formData.vestingCycleDays}
                    onChange={handleInputChange}
                    placeholder="e.g., 30"
                    info="Per cycle"
                  />
                </div>
              )}

              <SectionTitle title="Additional Options" />
              <FormInput
                label="Leftover Tokens"
                name="leftoverTokenOption"
                type="select"
                value={formData.leftoverTokenOption}
                onChange={handleInputChange}
                required
              >
                <option value="0">Return to Owner</option>
                <option value="1">Burn</option>
                {/* <option value="2">Vest</option> */}
              </FormInput>

              <SectionTitle title="Whitelist" />
              <FormInput
                label="Whitelist Type"
                name="whitelistType"
                type="select"
                value={formData.whitelistType}
                onChange={handleInputChange}
              >
                <option value="0">Public</option>
                <option value="1">Merkle Tree</option>
                <option value="2">NFT Holders</option>
              </FormInput>
              {formData.whitelistType === "1" && (
                <FormInput
                  label="Merkle Root"
                  name="merkleRoot"
                  value={formData.merkleRoot}
                  onChange={handleInputChange}
                  placeholder="0x..."
                />
              )}
              {formData.whitelistType === "2" && (
                <FormInput
                  label="NFT Contract"
                  name="nftContractAddress"
                  value={formData.nftContractAddress}
                  onChange={handleInputChange}
                  placeholder="0x..."
                />
              )}

              <div className="mt-6 pt-4 border-t border-[#BFD4BF]/20">
                <p className="text-base text-[#BFD4BF] mb-1">
                  Token to Deposit:{" "}
                  <span className="font-semibold">
                    {tokenDeposit} {tokenSymbol}
                  </span>
                </p>
                <p className="text-base text-[#BFD4BF] mb-1">
                  Your Balance:{" "}
                  <span className="font-semibold">
                    {tokenBalance} {tokenSymbol}
                  </span>
                </p>
                <p className="text-base text-[#BFD4BF]">
                  Creation Fee:{" "}
                  <span className="font-semibold">
                    {creationFee} {creationFeeTokenSymbol}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  className="w-full bg-[#BFD4BF] text-[#14213E] py-3 px-6 rounded-lg font-semibold text-lg hover:bg-[#D4E8D4] focus:outline-none transition-all duration-300 shadow-md hover:shadow-[#BFD4BF]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={
                    isTokenApproved && isFeeApproved
                      ? createPresale
                      : handleApprove
                  }
                  disabled={isTxPending}
                >
                  {isTokenApproved && isFeeApproved
                    ? "Create Presale"
                    : "Approve Tokens"}
                </button>
                <button
                  type="button"
                  className="p-2 text-[#BFD4BF] hover:text-[#D4E8D4] transition-all duration-300"
                  onClick={checkTokenBalanceAndDetails}
                  disabled={isTxPending}
                  title="Refresh Token Details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {status && (
              <div className="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg max-w-sm w-full bg-white/90 text-base flex items-center justify-between">
                <span
                  className={`${
                    status.includes("error")
                      ? "text-red-600"
                      : status.includes("success")
                      ? "text-green-600"
                      : "text-blue-600"
                  }`}
                >
                  {status}
                </span>
                <button
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  onClick={() => setStatus("")}
                >
                  Dismiss
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreatePresalePage;

/**
 * 
 * // Run this in Remix or a script to find matching selectors
console.log(keccak256("0xe450d38c()").slice(0, 10));

 */
