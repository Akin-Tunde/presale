import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import { ethers, BigNumber } from "ethers"; // Assuming ethers v5

// --- ABIs (as used in the HTML version) ---
const factoryAbi = [
  "function createPresale(tuple(uint256 tokenDeposit, uint256 hardCap, uint256 softCap, uint256 min, uint256 max, uint256 presaleRate, uint256 listingRate, uint256 liquidityBps, uint256 slippageBps, uint256 start, uint256 end, uint256 lockupDuration, uint256 vestingPercentage, uint256 vestingDuration, uint256 leftoverTokenOption, address currency, uint8 whitelistType, bytes32 merkleRoot, address nftContractAddress) memory options, address _token, address _weth, address _uniswapV2Router02) payable returns (address presaleContract)",
  "function creationFee() view returns (uint256)",
  "function feeToken() view returns (address)",
  "function calculateTotalTokensNeededForPresale(tuple(uint256 tokenDeposit, uint256 hardCap, uint256 softCap, uint256 min, uint256 max, uint256 presaleRate, uint256 listingRate, uint256 liquidityBps, uint256 slippageBps, uint256 start, uint256 end, uint256 lockupDuration, uint256 vestingPercentage, uint256 vestingDuration, uint256 leftoverTokenOption, address currency, uint8 whitelistType, bytes32 merkleRoot, address nftContractAddress) memory options, address _token) view returns (uint256 totalTokens)",
];

const erc20Abi = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
  "function balanceOf(address account) public view returns (uint256)",
  "function symbol() public view returns (string)",
];

// --- CONFIGURATION (Update these with your actual addresses or pass as props) ---
const FACTORY_ADDRESS = "0x7b676709cBF74bD668F380c2434aF18c4F75934f"; // Example, use your deployed factory
const WETH_ADDRESS = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"; // Example, use WETH for your network
const UNISWAP_V2_ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Example, use Router for your network

// --- Helper Functions ---
const formatDateForInput = (date: Date | null | undefined): string => {
  if (!date) return "";
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isValidAddress = (address: string): boolean => {
  return address === "" || ethers.utils.isAddress(address);
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

// Augment the Window interface
interface ExtendedWindow extends Window {
  ethereum?: any; // Consider using a more specific type if available from ethers or your project
}
declare let window: ExtendedWindow;

const CreatePresalePage: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] =
    useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  const initialStartTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  const initialEndTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

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
    start: formatDateForInput(initialStartTime),
    end: formatDateForInput(initialEndTime),
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

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(
          window.ethereum as any
        );
        setProvider(web3Provider);
        if (!FACTORY_ADDRESS || !isValidAddress(FACTORY_ADDRESS)) {
          setStatus("Configuration Error: Invalid Factory Address.");
          return;
        }
        const factoryContract = new ethers.Contract(
          FACTORY_ADDRESS,
          factoryAbi,
          web3Provider
        );
        try {
          const fee = await factoryContract.creationFee();
          const feeTokenAddr = await factoryContract.feeToken();
          setCreationFeeTokenAddress(feeTokenAddr);

          if (feeTokenAddr && feeTokenAddr !== ethers.constants.AddressZero) {
            const feeTokenContract = new ethers.Contract(
              feeTokenAddr,
              erc20Abi,
              web3Provider
            );
            const symbol = await feeTokenContract.symbol();
            const decimals = await feeTokenContract.decimals();
            setCreationFee(ethers.utils.formatUnits(fee, decimals));
            setCreationFeeTokenSymbol(symbol);
          } else {
            setCreationFee(ethers.utils.formatEther(fee));
            setCreationFeeTokenSymbol("ETH");
          }
          setStatus("Factory fee loaded. Ready to connect.");
        } catch (error: any) {
          console.error("Error fetching fee details:", error);
          setStatus(
            `Error fetching fee details: ${
              error.message || "Unknown error"
            }. Check console.`
          );
        }
      } else {
        setStatus("Please install MetaMask!");
      }
    };
    init();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        if (provider) {
          const currentSigner = provider.getSigner();
          setSigner(currentSigner);
          setStatus(
            `Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`
          );
          fetchTokenDetails(formData.tokenAddress, currentSigner);
        }
      } catch (error: any) {
        console.error("Wallet connection failed:", error);
        setStatus(
          `Wallet connection failed: ${
            error.message || "Unknown error"
          }. Check console.`
        );
      }
    } else {
      setStatus("Please install MetaMask!");
    }
  };

  const validateAndParseAddress = (addr: string, fieldName: string): string => {
    if (addr && !isValidAddress(addr)) {
      setStatus(`Invalid ${fieldName} address.`);
      return ethers.constants.AddressZero; // Or handle error differently
    }
    return addr || ethers.constants.AddressZero;
  };

  const fetchTokenDetails = async (
    tokenAddress: string,
    currentSignerOrProvider: ethers.Signer | ethers.providers.Provider | null
  ) => {
    if (
      !currentSignerOrProvider ||
      !tokenAddress ||
      !isValidAddress(tokenAddress)
    ) {
      setTokenDecimals(18);
      setTokenSymbol("");
      setTokenBalance("0");
      if (tokenAddress)
        setStatus("Invalid token address for fetching details.");
      return false;
    }
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        erc20Abi,
        currentSignerOrProvider
      );
      const decimals = await tokenContract.decimals();
      const symbol = await tokenContract.symbol();
      setTokenDecimals(decimals);
      setTokenSymbol(symbol);
      if (account) {
        const balance = await tokenContract.balanceOf(account);
        setTokenBalance(
          ethers.utils.formatUnits(balance, decimals).split(".")[0]
        );
      }
      setStatus(`Token ${symbol} (Decimals: ${decimals}) details loaded.`);
      return true;
    } catch (error: any) {
      console.error("Error fetching token details:", error);
      setStatus(
        `Error fetching token details: ${
          error.message || "Is it a valid ERC20 token?"
        }`
      );
      setTokenDecimals(18);
      setTokenSymbol("");
      return false;
    }
  };

  const calculateAndSetTokenDeposit = useCallback(async () => {
    if (
      !provider ||
      !FACTORY_ADDRESS ||
      !formData.tokenAddress ||
      !isValidAddress(formData.tokenAddress)
    ) {
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
      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        factoryAbi,
        provider
      );
      let currentTokenDecimals = tokenDecimals;
      // A simple check, might need refinement if ensAddress isn't suitable for this check on all networks
      const network = await factoryContract.provider.getNetwork();
      if (formData.tokenAddress !== network.ensAddress) {
        const tokenContract = new ethers.Contract(
          formData.tokenAddress,
          erc20Abi,
          provider
        );
        try {
          currentTokenDecimals = await tokenContract.decimals();
          setTokenDecimals(currentTokenDecimals);
        } catch {
          /* ignore, use previous */
        }
      }

      const options = {
        tokenDeposit: BigNumber.from(0),
        hardCap: ethers.utils.parseEther(formData.hardCap || "0"),
        softCap: ethers.utils.parseEther(formData.softCap || "0"),
        min: ethers.utils.parseEther(formData.minContribution || "0"),
        max: ethers.utils.parseEther(formData.maxContribution || "0"),
        presaleRate: BigNumber.from(
          Math.floor(parseFloat(formData.presaleRate || "0"))
        ),
        listingRate: BigNumber.from(
          Math.floor(parseFloat(formData.listingRate || "0"))
        ),
        liquidityBps: parseInt(formData.liquidityBps || "0"),
        slippageBps: parseInt(formData.slippageBps || "0"),
        start: formData.start
          ? Math.floor(new Date(formData.start).getTime() / 1000)
          : 0,
        end: formData.end
          ? Math.floor(new Date(formData.end).getTime() / 1000)
          : 0,
        lockupDuration: parseInt(formData.lockupDuration || "0"),
        vestingPercentage: formData.useVesting
          ? parseInt(formData.vestingTgePercent || "0") * 100
          : 0,
        vestingDuration: formData.useVesting
          ? parseInt(formData.vestingCycleDays || "0") * 24 * 60 * 60
          : 0,
        leftoverTokenOption: parseInt(formData.leftoverTokenOption || "0"),
        currency: validateAndParseAddress(formData.currencyAddress, "Currency"),
        whitelistType: parseInt(formData.whitelistType || "0"),
        merkleRoot:
          formData.whitelistType === "1" && formData.merkleRoot
            ? formData.merkleRoot
            : ethers.constants.HashZero,
        nftContractAddress:
          formData.whitelistType === "2" && formData.nftContractAddress
            ? validateAndParseAddress(
                formData.nftContractAddress,
                "NFT Contract"
              )
            : ethers.constants.AddressZero,
      };

      const totalTokensNeeded =
        await factoryContract.calculateTotalTokensNeededForPresale(
          options,
          formData.tokenAddress
        );
      const formattedTokens = ethers.utils
        .formatUnits(totalTokensNeeded, currentTokenDecimals)
        .split(".")[0];
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
  }, [provider, formData, tokenDecimals, tokenSymbol, account]);

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
        fetchTokenDetails(
          value,
          provider ||
            (window.ethereum
              ? new ethers.providers.Web3Provider(window.ethereum as any)
              : null)
        );
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
    // Add other specific input validations as in HTML version if needed
  };

  const checkTokenBalanceAndDetails = async () => {
    if (
      !signer ||
      !formData.tokenAddress ||
      !isValidAddress(formData.tokenAddress)
    ) {
      setStatus("Connect wallet and enter a valid token address.");
      return;
    }
    const fetched = await fetchTokenDetails(formData.tokenAddress, signer);
    if (fetched && account) {
      const tokenContract = new ethers.Contract(
        formData.tokenAddress,
        erc20Abi,
        signer
      );
      const balance = await tokenContract.balanceOf(account);
      const formattedBalance = ethers.utils
        .formatUnits(balance, tokenDecimals)
        .split(".")[0];
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
      !signer ||
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
      const tokenContract = new ethers.Contract(tokenAddr, erc20Abi, signer);
      const amountInWei =
        type === "Max"
          ? ethers.constants.MaxUint256
          : ethers.utils.parseUnits(amountToApprove, tokenDecimalsToUse);

      setStatus(
        `Approving ${tokenSymbolToUse || type} (${amountToApprove})...`
      );
      const tx = await tokenContract.approve(spenderAddr, amountInWei);
      await tx.wait();
      setStatus(`${tokenSymbolToUse || type} approved successfully!`);
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

  const handleApproveFeeToken = () => {
    if (
      !creationFeeTokenAddress ||
      creationFeeTokenAddress === ethers.constants.AddressZero
    ) {
      setStatus("Fee is in ETH, no token approval needed.");
      return;
    }
    if (parseFloat(creationFee) <= 0) {
      setStatus("Creation fee is zero, no approval needed.");
      return;
    }
    const feeTokenContract = new ethers.Contract(
      creationFeeTokenAddress,
      erc20Abi,
      provider as ethers.providers.Provider
    );
    feeTokenContract
      .decimals()
      .then((feeDecimals: number) => {
        approveToken(
          creationFeeTokenAddress!,
          creationFee,
          FACTORY_ADDRESS,
          feeDecimals,
          creationFeeTokenSymbol,
          "Fee Token"
        );
      })
      .catch((err: any) => {
        setStatus("Could not get fee token decimals for approval.");
        console.error("Fee token decimals error:", err);
      });
  };

  const createPresale = async () => {
    if (!signer) {
      setStatus("Please connect wallet.");
      return;
    }
    setStatus("Validating parameters...");

    // --- Comprehensive Validation (simplified for brevity, expand as needed) ---
    if (
      !isValidAddress(formData.tokenAddress) ||
      formData.tokenAddress === ethers.constants.AddressZero
    ) {
      setStatus("Invalid or missing Token Address.");
      return;
    }
    // ... (Add all validations from HTML version)
    if (tokenDeposit === "0" || parseFloat(tokenDeposit) <= 0) {
      setStatus(
        "Calculated token deposit is zero or invalid. Check parameters and recalculate."
      );
      return;
    }

    // Check allowance for presale token
    const tokenContract = new ethers.Contract(
      formData.tokenAddress,
      erc20Abi,
      signer
    );
    const requiredTokenAmountWei = ethers.utils.parseUnits(
      tokenDeposit,
      tokenDecimals
    );
    const allowance = await tokenContract.allowance(account!, FACTORY_ADDRESS);
    if (allowance.lt(requiredTokenAmountWei)) {
      setStatus(
        `Insufficient presale token allowance. Need ${tokenDeposit}, approved ${ethers.utils.formatUnits(
          allowance,
          tokenDecimals
        )}. Please approve.`
      );
      return;
    }

    // Check allowance for fee token
    if (
      creationFeeTokenAddress &&
      creationFeeTokenAddress !== ethers.constants.AddressZero &&
      parseFloat(creationFee) > 0
    ) {
      const feeTokenContract = new ethers.Contract(
        creationFeeTokenAddress,
        erc20Abi,
        signer
      );
      const feeTokenDecimalsResult = await feeTokenContract.decimals(); // Ethers v5 returns BigNumber for decimals
      const feeTokenDecimals = feeTokenDecimalsResult.toNumber(); // Convert BigNumber to number
      const requiredFeeAmountWei = ethers.utils.parseUnits(
        creationFee,
        feeTokenDecimals
      );
      const feeAllowance = await feeTokenContract.allowance(
        account!,
        FACTORY_ADDRESS
      );
      if (feeAllowance.lt(requiredFeeAmountWei)) {
        setStatus(
          `Insufficient fee token allowance. Need ${creationFee} ${creationFeeTokenSymbol}. Please approve.`
        );
        return;
      }
    }

    setStatus("All checks passed. Preparing transaction...");

    try {
      const factoryContract = new ethers.Contract(
        FACTORY_ADDRESS,
        factoryAbi,
        signer
      );
      const presaleOptions = {
        tokenDeposit: requiredTokenAmountWei,
        hardCap: ethers.utils.parseEther(formData.hardCap),
        softCap: ethers.utils.parseEther(formData.softCap),
        min: ethers.utils.parseEther(formData.minContribution),
        max: ethers.utils.parseEther(formData.maxContribution),
        presaleRate: BigNumber.from(
          Math.floor(parseFloat(formData.presaleRate))
        ),
        listingRate: BigNumber.from(
          Math.floor(parseFloat(formData.listingRate))
        ),
        liquidityBps: parseInt(formData.liquidityBps),
        slippageBps: parseInt(formData.slippageBps),
        start: Math.floor(new Date(formData.start).getTime() / 1000),
        end: Math.floor(new Date(formData.end).getTime() / 1000),
        lockupDuration: parseInt(formData.lockupDuration),
        vestingPercentage: formData.useVesting
          ? parseInt(formData.vestingTgePercent) * 100
          : 0,
        vestingDuration: formData.useVesting
          ? parseInt(formData.vestingCycleDays) * 24 * 60 * 60
          : 0,
        leftoverTokenOption: parseInt(formData.leftoverTokenOption),
        currency: validateAndParseAddress(formData.currencyAddress, "Currency"),
        whitelistType: parseInt(formData.whitelistType),
        merkleRoot:
          formData.whitelistType === "1" && formData.merkleRoot
            ? formData.merkleRoot
            : ethers.constants.HashZero,
        nftContractAddress:
          formData.whitelistType === "2" && formData.nftContractAddress
            ? validateAndParseAddress(
                formData.nftContractAddress,
                "NFT Contract"
              )
            : ethers.constants.AddressZero,
      };

      let txOptions: { gasLimit: BigNumber; value?: BigNumber } = {
        gasLimit: BigNumber.from(5000000),
      };

      if (
        !creationFeeTokenAddress ||
        creationFeeTokenAddress === ethers.constants.AddressZero
      ) {
        if (parseFloat(creationFee) > 0) {
          txOptions.value = ethers.utils.parseEther(creationFee);
        }
      }

      setStatus("Sending transaction to create presale...");
      try {
        const gasEstimate = await factoryContract.estimateGas.createPresale(
          presaleOptions,
          formData.tokenAddress,
          WETH_ADDRESS,
          UNISWAP_V2_ROUTER,
          txOptions
        );
        txOptions.gasLimit = gasEstimate.mul(120).div(100);
        setStatus(
          `Gas estimated: ${txOptions.gasLimit.toString()}. Creating presale...`
        );
      } catch (gasError: any) {
        console.warn("Gas estimation failed, using manual limit:", gasError);
        setStatus(
          `Gas estimation failed (${
            gasError.message || "Unknown reason"
          }), trying with manual gas limit.`
        );
      }

      const tx = await factoryContract.createPresale(
        presaleOptions,
        formData.tokenAddress,
        WETH_ADDRESS,
        UNISWAP_V2_ROUTER,
        txOptions
      );
      setStatus(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      await tx.wait();
      setStatus(`Presale created successfully! Tx: ${tx.hash}`);
    } catch (error: any) {
      console.error("Error creating presale:", error);
      let errorMessage = error.message;
      if (error.data && error.data.message) {
        errorMessage = error.data.message;
      } else if (error.reason) {
        errorMessage = error.reason;
      }
      setStatus(`Error creating presale: ${errorMessage}. Check console.`);
      if (error.data) console.log("Revert data:", error.data);
    }
  };

  interface FormInputProps {
    label: string;
    name: keyof FormDataState | string; // Allow specific keys or general string for checkboxes like 'useVesting'
    type?: string;
    placeholder?: string;
    value?: string | number | boolean;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    children?: React.ReactNode;
    info?: string;
    error?: string;
    required?: boolean;
    checked?: boolean; // For checkbox
    // Allow any other standard HTML input props
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
    <div className="mb-4">
      <label
        htmlFor={name as string}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
        {info && <span className="text-xs text-gray-500 ml-1">({info})</span>}
      </label>
      {type === "checkbox" ? (
        <input
          type={type}
          id={name as string}
          name={name as string}
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          {...props}
        />
      ) : type === "select" ? (
        <select
          id={name as string}
          name={name as string}
          value={value as string | number}
          onChange={onChange}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          {...props}
        >
          {children}
        </select>
      ) : (
        <input
          type={type}
          id={name as string}
          name={name as string}
          value={value as string | number}
          placeholder={placeholder}
          onChange={onChange}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          {...props}
        />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
    <h2 className="text-xl font-semibold mt-6 mb-3 pt-4 border-t border-gray-200">
      {title}
    </h2>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Create Your Token Presale
        </h1>

        {!account ? (
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

        {account && (
          <form
            onSubmit={(e: FormEvent) => e.preventDefault()}
            className="space-y-4"
          >
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
            {/* ... (rest of the form structure from the HTML version) ... */}
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
            </div>

            <SectionTitle title="Liquidity & Schedule" />
            <FormInput
              label="Liquidity BPS"
              name="liquidityBps"
              type="select"
              value={formData.liquidityBps}
              onChange={handleInputChange}
              required
              info="Percent of raised funds for LP"
            >
              <option value="">Select Liquidity %</option>
              <option value="5000">50%</option>
              <option value="6000">60%</option>
              <option value="7000">70%</option>
              <option value="8000">80%</option>
              <option value="9000">90%</option>
              <option value="10000">100%</option>
            </FormInput>
            <FormInput
              label="LP Lockup Duration (seconds)"
              name="lockupDuration"
              type="number"
              value={formData.lockupDuration}
              onChange={handleInputChange}
              placeholder="e.g., 2592000 for 30 days"
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Presale Start Time"
                name="start"
                type="datetime-local"
                value={formData.start}
                onChange={handleInputChange}
                required
              />
              <FormInput
                label="Presale End Time"
                name="end"
                type="datetime-local"
                value={formData.end}
                onChange={handleInputChange}
                required
              />
            </div>
            <FormInput
              label="Claim Delay (minutes after presale ends)"
              name="claimDelayMinutes"
              type="number"
              value={formData.claimDelayMinutes}
              onChange={handleInputChange}
              info="Informational, not enforced by this base contract"
            />
            <FormInput
              label="Router Slippage BPS"
              name="slippageBps"
              type="number"
              value={formData.slippageBps}
              onChange={handleInputChange}
              placeholder="0-10000 (e.g., 500 for 5%)"
              required
            />

            <SectionTitle title="Vesting (Optional)" />
            <div className="flex items-center">
              <FormInput
                label="" // No visible label for the checkbox itself, handled by the sibling label
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

            {formData.useVesting && (
              <div className="pl-6 mt-2 space-y-4 border-l-2 border-gray-200">
                <FormInput
                  label="TGE Percent"
                  name="vestingTgePercent"
                  type="number"
                  value={formData.vestingTgePercent}
                  onChange={handleInputChange}
                  placeholder="0-100 (e.g., 10 for 10%)"
                  info="Percentage of tokens released at TGE"
                />
                <FormInput
                  label="Vesting Cycle Days"
                  name="vestingCycleDays"
                  type="number"
                  value={formData.vestingCycleDays}
                  onChange={handleInputChange}
                  placeholder="e.g., 30"
                  info="Duration of each vesting period after TGE"
                />
              </div>
            )}

            <SectionTitle title="Additional Options" />
            <FormInput
              label="Leftover Token Option"
              name="leftoverTokenOption"
              type="select"
              value={formData.leftoverTokenOption}
              onChange={handleInputChange}
              required
            >
              <option value="0">Return to Owner</option>
              <option value="1">Burn</option>
              <option value="2">
                Vest with Liquidity (if contract supports)
              </option>
            </FormInput>

            <SectionTitle title="Whitelist Configuration" />
            <FormInput
              label="Whitelist Type"
              name="whitelistType"
              type="select"
              value={formData.whitelistType}
              onChange={handleInputChange}
            >
              <option value="0">None (Public Sale)</option>
              <option value="1">Merkle Tree</option>
              <option value="2">NFT Holders</option>
            </FormInput>
            {formData.whitelistType === "1" && (
              <FormInput
                label="Merkle Root"
                name="merkleRoot"
                value={formData.merkleRoot}
                onChange={handleInputChange}
                placeholder="0x... (32-byte hex)"
              />
            )}
            {formData.whitelistType === "2" && (
              <FormInput
                label="NFT Contract Address"
                name="nftContractAddress"
                value={formData.nftContractAddress}
                onChange={handleInputChange}
                placeholder="0x..."
              />
            )}

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-700">
                Token to Deposit:{" "}
                <span className="font-semibold">
                  {tokenDeposit} {tokenSymbol}
                </span>{" "}
                (Decimals: {tokenDecimals})
              </p>
              <p className="text-sm text-gray-700">
                Your Token Balance:{" "}
                <span className="font-semibold">
                  {tokenBalance} {tokenSymbol}
                </span>
              </p>
              <p className="text-sm text-gray-700">
                Presale Creation Fee:{" "}
                <span className="font-semibold">
                  {creationFee} {creationFeeTokenSymbol}
                </span>
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                className="w-full bg-indigo-500 text-white py-2 px-4 rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
                onClick={checkTokenBalanceAndDetails}
              >
                Refresh Token Balance & Details
              </button>
              {creationFeeTokenAddress &&
                creationFeeTokenAddress !== ethers.constants.AddressZero &&
                parseFloat(creationFee) > 0 && (
                  <button
                    type="button"
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
                    onClick={handleApproveFeeToken}
                  >
                    Approve Fee Token ({creationFeeTokenSymbol})
                  </button>
                )}
              <button
                type="button"
                className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50"
                onClick={handleApprovePresaleToken}
              >
                Approve Presale Token ({tokenSymbol || "Token"})
              </button>
              <button
                type="button"
                className="w-full bg-green-600 text-white py-2.5 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 font-semibold text-lg"
                onClick={createPresale}
              >
                Create Presale
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreatePresalePage;
