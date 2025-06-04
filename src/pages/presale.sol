
// // pragma solidity ^0.8.24;

// // import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// // import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// // import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// // import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// // import {Address} from "@openzeppelin/contracts/utils/Address.sol";
// // import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
// // import {IUniswapV2Router02} from "lib/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
// // import {IUniswapV2Pair} from "lib/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
// // import {IUniswapV2Factory} from "lib/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
// // import {IPresale} from "./interfaces/IPresale.sol";
// // import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// // import {LiquidityLocker} from "./LiquidityLocker.sol";
// // import {Vesting} from "./Vesting.sol";
// // import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// // contract Presale is ReentrancyGuard, Ownable, IPresale {
// //     using SafeERC20 for IERC20;
// //     using Address for address payable;

// //     enum PresaleState {
// //         Pending,
// //         Active,
// //         Canceled,
// //         Finalized
// //     }

// //     enum WhitelistType {
// //         None, // Public presale
// //         Merkle, // Whitelist based on Merkle root
// //         NFT // Whitelist based on holding an NFT from a specific collection

// //     }

// //     struct PresaleOptions {
// //         uint256 tokenDeposit;
// //         uint256 hardCap;
// //         uint256 softCap;
// //         uint256 min;
// //         uint256 max;
// //         uint256 presaleRate;
// //         uint256 listingRate;
// //         uint256 liquidityBps;
// //         uint256 slippageBps;
// //         uint256 start;
// //         uint256 end;
// //         uint256 lockupDuration;
// //         uint256 vestingPercentage;
// //         uint256 vestingDuration;
// //         uint256 leftoverTokenOption;
// //         address currency;
// //         WhitelistType whitelistType; // <<< ADDED
// //         bytes32 merkleRoot; // <<< ADDED (Used if whitelistType is Merkle)
// //         address nftContractAddress; // <<< ADDED (Used if whitelistType is NFT)
// //     }

// //     struct LiquidityParams {
// //         uint256 currencyAmount;
// //         uint256 tokenAmount;
// //         uint256 minToken;
// //         uint256 minCurrency;
// //         address pair;
// //         uint256 lpAmount;
// //     }

// //     struct LeftoverTokenParams {
// //         uint256 tokensSold;
// //         uint256 unsoldPresaleTokens;
// //         uint256 excessDeposit;
// //         uint256 totalLeftover;
// //     }

// //     struct TokenDistributionParams {
// //         uint256 totalTokens;
// //         uint256 vestingBps;
// //         uint256 vestedTokens;
// //         uint256 immediateTokens;
// //     }

// //     uint256 public totalRefundable;
// //     uint256 public constant BASIS_POINTS = 1e4;
// //     bool public paused;
// //     bool public immutable whitelistEnabled;
// //     // uint256 public claimDeadline;
// //     uint256 public ownerBalance;

// //     LiquidityLocker public immutable liquidityLocker;
// //     Vesting public immutable vestingContract;
// //     uint256 public immutable housePercentage;
// //     address public immutable houseAddress;
// //     address public immutable _presaleFactory; // Stores the address of *our* PresaleFactory

// //     PresaleOptions public options;
// //     PresaleState public state;
// //     mapping(address => uint256) public contributions;
// //     mapping(address => bool) private isContributor;
// //     address[] public contributors;
// //     // bytes32 public merkleRoot;

// //     uint256[] private ALLOWED_LIQUIDITY_BPS;

// //     ERC20 public immutable token;
// //     IUniswapV2Router02 public immutable uniswapV2Router02;
// //     address public immutable factory;
// //     address public immutable weth;
// //     uint256 public tokenBalance;
// //     uint256 public tokensClaimable;
// //     uint256 public tokensLiquidity;
// //     uint256 public totalRaised;
// //     uint256 public claimDeadline;

// //     modifier whenNotPaused() {
// //         if (paused) revert ContractPaused();
// //         _;
// //     }

// //     modifier onlyFactory() {
// //         if (msg.sender != _presaleFactory) revert NotFactory();
// //         _;
// //     }

// //     modifier onlyRefundable() {
// //         if (
// //             !(
// //                 state == PresaleState.Canceled
// //                     || (state == PresaleState.Active && block.timestamp > options.end && totalRaised < options.softCap)
// //             )
// //         ) {
// //             revert NotRefundable();
// //         }
// //         _;
// //     }

// //     constructor(
// //         address _weth,
// //         address _token,
// //         address _uniswapV2Router02,
// //         PresaleOptions memory _options,
// //         address _creator,
// //         address _liquidityLocker,
// //         address _vestingContract,
// //         uint256 _housePercentage,
// //         address _houseAddress,
// //         address _presaleFactoryAddress
// //     ) Ownable(_creator) {
// //         // Set allowed liquidity BPS values
// //         ALLOWED_LIQUIDITY_BPS.push(5000);
// //         ALLOWED_LIQUIDITY_BPS.push(6000);
// //         ALLOWED_LIQUIDITY_BPS.push(7000);
// //         ALLOWED_LIQUIDITY_BPS.push(8000);
// //         ALLOWED_LIQUIDITY_BPS.push(9000);
// //         ALLOWED_LIQUIDITY_BPS.push(10000);

// //         if (_weth == address(0) || _token == address(0) || _uniswapV2Router02 == address(0)) {
// //             revert InvalidInitialization();
// //         }
// //         if (_liquidityLocker == address(0) || _vestingContract == address(0)) {
// //             revert InvalidInitialization();
// //         }
// //         if (_options.leftoverTokenOption > 2) {
// //             revert InvalidLeftoverTokenOption();
// //         }
// //         if (_housePercentage > 500) revert InvalidHouseConfiguration();
// //         if (_houseAddress == address(0) && _housePercentage > 0) {
// //             revert InvalidHouseConfiguration();
// //         }

// //         if (_options.hardCap == 0 || _options.softCap == 0 || _options.softCap > _options.hardCap) {
// //             revert InvalidCapSettings();
// //         }
// //         if (_options.max == 0 || _options.min == 0 || _options.min > _options.max || _options.max > _options.hardCap) {
// //             revert InvalidContributionLimits();
// //         }
// //         if (_options.presaleRate == 0 || _options.listingRate == 0 || _options.listingRate >= _options.presaleRate) {
// //             revert InvalidRates();
// //         }
// //         if (_options.start < block.timestamp || _options.end <= _options.start) {
// //             revert InvalidTimestamps();
// //         }
// //         if (
// //             _options.vestingPercentage > BASIS_POINTS
// //                 || (_options.vestingPercentage > 0 && _options.vestingDuration == 0)
// //         ) revert InvalidVestingPercentage();

// //         if (_options.whitelistType == WhitelistType.Merkle && _options.merkleRoot == bytes32(0)) {
// //             revert InvalidMerkleRoot(); // Need a root if type is Merkle
// //         }
// //         if (_options.whitelistType == WhitelistType.NFT && _options.nftContractAddress == address(0)) {
// //             revert InvalidNftContractAddress(); // Need NFT contract if type is NFT
// //         }
// //         if (!isAllowedLiquidityBps(_options.liquidityBps)) {
// //             // <<< ADDED VALIDATION
// //             revert InvalidLiquidityBps();
// //         }

// //         // Set all state variables first
// //         weth = _weth;
// //         token = ERC20(_token);
// //         uniswapV2Router02 = IUniswapV2Router02(_uniswapV2Router02);
// //         liquidityLocker = LiquidityLocker(_liquidityLocker);
// //         vestingContract = Vesting(_vestingContract);
// //         housePercentage = _housePercentage;
// //         houseAddress = _houseAddress;
// //         options = _options;
// //         _presaleFactory = _presaleFactoryAddress;
// //         state = PresaleState.Pending;
// //         whitelistEnabled = (_options.whitelistType != WhitelistType.None);

// //         // Make external call after all state changes
// //         factory = uniswapV2Router02.factory();

// //         emit PresaleCreated(_creator, address(this), _token, _options.start, _options.end);
// //     }

// //     function finalize() external nonReentrant onlyOwner whenNotPaused returns (bool) {
// //         if (state != PresaleState.Active) revert InvalidState(uint8(state));
// //         if (block.timestamp <= options.end) revert PresaleNotEnded();
// //         if (totalRaised < options.softCap) revert SoftCapNotReached();

// //         uint256 liquidityAmount = _weiForLiquidity();
// //         uint256 tokensToPairForLiquidity =
// //             (liquidityAmount * options.listingRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //         uint256 actualTokensForLiquidity = 0;

// //         if (liquidityAmount > 0 && tokensToPairForLiquidity > 0) {
// //             actualTokensForLiquidity =
// //                 (tokensToPairForLiquidity > tokensLiquidity) ? tokensLiquidity : tokensToPairForLiquidity;
// //             if (tokenBalance < actualTokensForLiquidity) {
// //                 revert InsufficientTokensForLiquidity(tokenBalance, actualTokensForLiquidity);
// //             }
// //         }

// //         // Update all state variables before external interactions
// //         state = PresaleState.Finalized;
// //         if (actualTokensForLiquidity > 0) {
// //             tokenBalance -= actualTokensForLiquidity;
// //         }
// //         ownerBalance = totalRaised - liquidityAmount - ((totalRaised * housePercentage) / BASIS_POINTS);
// //         claimDeadline = block.timestamp + 180 days;

// //         // External interactions after state updates
// //         if (liquidityAmount > 0 && actualTokensForLiquidity > 0) {
// //             _liquify(liquidityAmount, actualTokensForLiquidity);
// //         }
// //         _distributeHouseFunds();
// //         _handleLeftoverTokens();

// //         emit Finalized(msg.sender, totalRaised, block.timestamp);
// //         return true;
// //     }

// //     function cancel() external nonReentrant onlyOwner whenNotPaused returns (bool) {
// //         // Only allow cancel if presale ended and soft cap NOT reached
// //         if (state != PresaleState.Active || block.timestamp <= options.end || totalRaised >= options.softCap) {
// //             revert InvalidState(uint8(state));
// //         }

// //         state = PresaleState.Canceled;

// //         if (tokenBalance > 0) {
// //             uint256 amountToReturn = tokenBalance;
// //             tokenBalance = 0;
// //             IERC20(token).safeTransfer(msg.sender, amountToReturn);
// //             emit LeftoverTokensReturned(amountToReturn, msg.sender);
// //         }

// //         emit Cancel(msg.sender, block.timestamp);
// //         return true;
// //     }

// //     function withdraw() external nonReentrant onlyOwner {
// //         if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
// //         uint256 amount = ownerBalance;
// //         if (amount == 0) revert NoFundsToWithdraw();
// //         ownerBalance = 0;
// //         _safeTransferCurrency(msg.sender, amount);
// //         emit Withdrawn(msg.sender, amount);
// //     }

// //     function extendClaimDeadline(uint256 _newDeadline) external onlyOwner {
// //         if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
// //         if (_newDeadline <= claimDeadline) revert InvalidDeadline();
// //         claimDeadline = _newDeadline;
// //         emit ClaimDeadlineExtended(_newDeadline);
// //     }

// //     function rescueTokens(address _erc20Token, address _to, uint256 _amount) external onlyOwner {
// //         if (_to == address(0)) revert InvalidAddress();
// //         if (state != PresaleState.Finalized && state != PresaleState.Canceled) {
// //             revert CannotRescueBeforeFinalizationOrCancellation();
// //         }
// //         if (
// //             state == PresaleState.Finalized && address(_erc20Token) == address(token)
// //                 && block.timestamp <= claimDeadline
// //         ) {
// //             revert CannotRescuePresaleTokens();
// //         }
// //         IERC20(_erc20Token).safeTransfer(_to, _amount);
// //         emit TokensRescued(_erc20Token, _to, _amount);
// //     }

// //     function pause() external onlyOwner {
// //         if (paused) revert AlreadyPaused();
// //         paused = true;
// //         emit Paused(msg.sender);
// //     }

// //     function unpause() external onlyOwner {
// //         if (!paused) revert NotPaused();
// //         paused = false;
// //         emit Unpaused(msg.sender);
// //     }

// //     function contribute(bytes32[] calldata _merkleProof) external payable nonReentrant whenNotPaused {
// //         _contribute(msg.sender, msg.value, _merkleProof);
// //     }

// //     receive() external payable nonReentrant whenNotPaused {
// //         bytes32[] memory emptyProof;
// //         _contribute(msg.sender, msg.value, emptyProof);
// //     }

// //     function contributeStablecoin(uint256 _amount, bytes32[] calldata _merkleProof)
// //         external
// //         nonReentrant
// //         whenNotPaused
// //     {
// //         if (options.currency == address(0)) revert StablecoinNotAccepted();
// //         if (_amount == 0) revert ZeroAmount();

// //         IERC20(options.currency).safeTransferFrom(msg.sender, address(this), _amount);
// //         _contribute(msg.sender, _amount, _merkleProof);
// //     }

// //     function claim() external nonReentrant whenNotPaused returns (uint256) {
// //         if (state != PresaleState.Finalized) revert InvalidState(uint8(state));
// //         if (block.timestamp > claimDeadline) revert ClaimPeriodExpired();

// //         uint256 totalTokens = userTokens(msg.sender);
// //         if (totalTokens == 0) revert NoTokensToClaim();

// //         contributions[msg.sender] = 0;
// //         if (tokenBalance < totalTokens) revert InsufficientTokenBalance();
// //         tokenBalance -= totalTokens;

// //         _distributeTokens(msg.sender, totalTokens);
// //         emit TokenClaim(msg.sender, totalTokens, block.timestamp);
// //         return totalTokens;
// //     }

// //     function refund() external nonReentrant onlyRefundable returns (uint256) {
// //         uint256 amount = contributions[msg.sender];
// //         if (amount == 0) revert NoFundsToRefund();

// //         contributions[msg.sender] = 0;
// //         if (totalRefundable >= amount) {
// //             totalRefundable -= amount;
// //         } else {
// //             totalRefundable = 0;
// //         }

// //         _safeTransferCurrency(msg.sender, amount);
// //         emit Refund(msg.sender, amount, block.timestamp);
// //         return amount;
// //     }

// //     function _contribute(address _contributor, uint256 _amount, bytes32[] memory _merkleProof) private {
// //         if (state != PresaleState.Active) revert InvalidState(uint8(state));
// //         if (block.timestamp < options.start || block.timestamp > options.end) {
// //             revert NotInPurchasePeriod();
// //         }
// //         if (_contributor == address(0)) revert InvalidContributorAddress();

// //         if (options.whitelistType == WhitelistType.Merkle) {
// //             if (
// //                 // Use root from options
// //                 !MerkleProof.verify(_merkleProof, options.merkleRoot, keccak256(abi.encodePacked(_contributor)))
// //             ) {
// //                 revert NotWhitelisted();
// //             }
// //         } else if (options.whitelistType == WhitelistType.NFT) {
// //             try IERC721(options.nftContractAddress).balanceOf(_contributor) returns (uint256 balance) {
// //                 if (balance == 0) {
// //                     revert NotNftHolder(); // Custom error for NFT check failure
// //                 }
// //             } catch {
// //                 revert NftCheckFailed(); // Error during the balanceOf call
// //             }
// //         }

// //         _validateCurrencyAndAmount(_contributor, _amount);
// //         uint256 contributionAmount = (options.currency == address(0)) ? msg.value : _amount;

// //         totalRaised += contributionAmount;
// //         totalRefundable += contributionAmount;
// //         if (!isContributor[_contributor]) {
// //             isContributor[_contributor] = true;
// //             contributors.push(_contributor);
// //         }
// //         contributions[_contributor] += contributionAmount;

// //         emit Purchase(_contributor, contributionAmount);
// //         emit Contribution(_contributor, contributionAmount, options.currency == address(0));
// //     }

// //     function _handleLeftoverTokens() private {
// //         LeftoverTokenParams memory params;
// //         params.tokensSold = (totalRaised * options.presaleRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //         if (params.tokensSold > tokensClaimable) {
// //             params.tokensSold = tokensClaimable;
// //         }

// //         params.unsoldPresaleTokens = tokensClaimable - params.tokensSold;
// //         uint256 totalTokensNeededAtDeposit = tokensClaimable + tokensLiquidity;
// //         params.excessDeposit = (tokenBalance + tokensLiquidity > totalTokensNeededAtDeposit)
// //             ? (tokenBalance + tokensLiquidity - totalTokensNeededAtDeposit)
// //             : 0;
// //         params.totalLeftover = params.unsoldPresaleTokens + params.excessDeposit;
// //         if (params.totalLeftover > tokenBalance) {
// //             params.totalLeftover = tokenBalance;
// //         }

// //         if (params.totalLeftover == 0) return;

// //         tokenBalance -= params.totalLeftover;
// //         if (options.leftoverTokenOption == 0) {
// //             IERC20(token).safeTransfer(owner(), params.totalLeftover);
// //             emit LeftoverTokensReturned(params.totalLeftover, owner());
// //         } else if (options.leftoverTokenOption == 1) {
// //             IERC20(token).safeTransfer(address(0xdead), params.totalLeftover);
// //             emit LeftoverTokensBurned(params.totalLeftover);
// //         } else {
// //             IERC20(token).approve(address(vestingContract), params.totalLeftover);
// //             vestingContract.createVesting(
// //                 address(this), owner(), address(token), params.totalLeftover, block.timestamp, options.vestingDuration
// //             );
// //             emit LeftoverTokensVested(params.totalLeftover, owner());
// //         }
// //     }

// //     function _liquify(uint256 _currencyAmount, uint256 _tokenAmount) private {
// //         address pair = _getOrCreatePair();
// //         (uint256 reserveA, uint256 reserveB,) = IUniswapV2Pair(pair).getReserves();
// //         bool tokenIsA = address(token) < (options.currency == address(0) ? weth : options.currency);
// //         (uint256 reserveToken, uint256 reserveCurrency) = tokenIsA ? (reserveA, reserveB) : (reserveB, reserveA);

// //         // Adjust currencyAmount to match reserves
// //         if (reserveToken > 0) {
// //             uint256 expectedCurrency = (_tokenAmount * reserveCurrency) / reserveToken;
// //             if (_currencyAmount > expectedCurrency) {
// //                 _currencyAmount = expectedCurrency; // Use reserve-compatible amount
// //                 _tokenAmount =
// //                     (_currencyAmount * options.listingRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //             }
// //         }

// //         (uint256 minToken, uint256 minCurrency) = _calculateMinAmounts(_tokenAmount, _currencyAmount);
// //         LiquidityParams memory params = LiquidityParams({
// //             currencyAmount: _currencyAmount,
// //             tokenAmount: _tokenAmount,
// //             minToken: minToken,
// //             minCurrency: minCurrency,
// //             pair: pair,
// //             lpAmount: 0
// //         });

// //         IERC20(token).approve(address(uniswapV2Router02), params.tokenAmount);
// //         uint256 lpAmountBefore = IERC20(params.pair).balanceOf(address(this));
// //         if (options.currency == address(0)) {
// //             _addLiquidityETH(params);
// //         } else {
// //             _addLiquidityERC20(params);
// //         }
// //         IERC20(token).approve(address(uniswapV2Router02), 0);

// //         params.lpAmount = IERC20(params.pair).balanceOf(address(this)) - lpAmountBefore;
// //         if (params.lpAmount == 0) revert LiquificationYieldedZeroLP();

// //         _lockLiquidity(params.pair, params.lpAmount);
// //     }

// //     function _calculateMinAmounts(uint256 _tokenAmount, uint256 _currencyAmount)
// //         private
// //         view
// //         returns (uint256 minToken, uint256 minCurrency)
// //     {
// //         minToken = (_tokenAmount * (BASIS_POINTS - options.slippageBps)) / BASIS_POINTS;
// //         minCurrency = (_currencyAmount * (BASIS_POINTS - options.slippageBps)) / BASIS_POINTS;
// //     }

// //     function _getOrCreatePair() private returns (address pair) {
// //         address pairCurrency = (options.currency == address(0)) ? weth : options.currency;
// //         pair = IUniswapV2Factory(factory).getPair(address(token), pairCurrency);

// //         if (pair == address(0)) {
// //             try IUniswapV2Factory(factory).createPair(address(token), pairCurrency) returns (address newPair) {
// //                 pair = newPair;
// //             } catch {
// //                 revert PairCreationFailed(address(token), pairCurrency);
// //             }
// //         }
// //         if (pair == address(0)) revert PairAddressZero();
// //     }

// //     function simulateLiquidityAddition() external view returns (bool, uint256, uint256) {
// //         uint256 liquidityAmount = _weiForLiquidity();
// //         uint256 tokenAmount =
// //             (liquidityAmount * options.listingRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //         tokenAmount = tokenAmount > tokensLiquidity ? tokensLiquidity : tokenAmount;
// //         if (tokenBalance < tokenAmount) return (false, tokenBalance, tokenAmount);

// //         address pair =
// //             IUniswapV2Factory(factory).getPair(address(token), options.currency == address(0) ? weth : options.currency);
// //         if (pair == address(0)) return (true, tokenAmount, liquidityAmount);

// //         (uint256 reserveA, uint256 reserveB,) = IUniswapV2Pair(pair).getReserves();
// //         bool tokenIsA = address(token) < (options.currency == address(0) ? weth : options.currency);
// //         (uint256 reserveToken, uint256 reserveCurrency) = tokenIsA ? (reserveA, reserveB) : (reserveB, reserveA);
// //         uint256 expectedCurrency = reserveToken > 0 ? (tokenAmount * reserveCurrency) / reserveToken : liquidityAmount;

// //         return (liquidityAmount >= (expectedCurrency * 9700) / BASIS_POINTS, tokenAmount, expectedCurrency);
// //     }

// //     function _addLiquidityETH(LiquidityParams memory params) private {
// //         try uniswapV2Router02.addLiquidityETH{value: params.currencyAmount}(
// //             address(token),
// //             params.tokenAmount,
// //             params.minToken,
// //             params.minCurrency,
// //             address(this),
// //             block.timestamp + 600
// //         ) {} catch Error(string memory reason) {
// //             revert LiquificationFailedReason(reason);
// //         } catch {
// //             revert LiquificationFailed();
// //         }
// //     }

// //     function _addLiquidityERC20(LiquidityParams memory params) private {
// //         // Approve the router to spend the currency token from this presale contract
// //         IERC20(options.currency).approve(address(uniswapV2Router02), params.currencyAmount);

// //         try uniswapV2Router02.addLiquidity(
// //             address(token),
// //             options.currency,
// //             params.tokenAmount,
// //             params.currencyAmount,
// //             params.minToken,
// //             params.minCurrency,
// //             address(this),
// //             block.timestamp + 600
// //         ) {} catch Error(string memory reason) {
// //             revert LiquificationFailedReason(reason);
// //         } catch {
// //             revert LiquificationFailed();
// //         }
// //         IERC20(options.currency).approve(address(uniswapV2Router02), 0); // Clean up approval
// //     }

// //     function _lockLiquidity(address _pair, uint256 _lpAmount) private {
// //         uint256 unlockTime = block.timestamp + options.lockupDuration;
// //         IERC20(_pair).approve(address(liquidityLocker), _lpAmount);
// //         try liquidityLocker.lock(_pair, _lpAmount, unlockTime, owner()) {}
// //         catch Error(string memory reason) {
// //             revert LPLockFailedReason(reason);
// //         } catch {
// //             revert LPLockFailed();
// //         }
// //         emit LiquidityAdded(_pair, _lpAmount, unlockTime);
// //     }

// //     function _distributeHouseFunds() private {
// //         uint256 houseAmount = (totalRaised * housePercentage) / BASIS_POINTS;
// //         if (houseAmount > 0) {
// //             _safeTransferCurrency(houseAddress, houseAmount);
// //             emit HouseFundsDistributed(houseAddress, houseAmount);
// //         }
// //     }

// //     function _calculateLeftoverTokens(uint256 _tokensSold) private view returns (uint256) {
// //         uint256 unsoldPresaleTokens = tokensClaimable - _tokensSold;
// //         uint256 totalTokensNeededAtDeposit = tokensClaimable + tokensLiquidity;
// //         uint256 excessDeposit = (tokenBalance + tokensLiquidity > totalTokensNeededAtDeposit)
// //             ? (tokenBalance + tokensLiquidity - totalTokensNeededAtDeposit)
// //             : 0;
// //         uint256 totalLeftover = unsoldPresaleTokens + excessDeposit;
// //         return tokenBalance < totalLeftover ? tokenBalance : totalLeftover;
// //     }

// //     function _distributeTokens(address _recipient, uint256 _totalTokens) private {
// //         TokenDistributionParams memory params;
// //         params.totalTokens = _totalTokens;
// //         params.vestingBps = options.vestingPercentage;
// //         params.vestedTokens = (params.vestingBps > 0) ? (params.totalTokens * params.vestingBps) / BASIS_POINTS : 0;
// //         params.immediateTokens = params.totalTokens - params.vestedTokens;

// //         if (params.immediateTokens > 0) {
// //             IERC20(token).safeTransfer(_recipient, params.immediateTokens);
// //         }

// //         if (params.vestedTokens > 0) {
// //             IERC20(token).approve(address(vestingContract), params.vestedTokens);
// //             vestingContract.createVesting(
// //                 address(this), _recipient, address(token), params.vestedTokens, block.timestamp, options.vestingDuration
// //             );
// //         }
// //     }

// //     function _validateCurrencyAndAmount(address _contributor, uint256 _amount) private view {
// //         if (options.currency == address(0)) {
// //             if (msg.value == 0) revert ZeroAmount();
// //         } else {
// //             if (msg.value > 0) revert ETHNotAccepted();
// //             if (_amount == 0) revert ZeroAmount();
// //         }
// //         _validateContribution(_contributor, _amount);
// //     }

// //     function _validateContribution(address _contributor, uint256 _stablecoinAmountIfAny) private view {
// //         uint256 amount = (options.currency == address(0)) ? msg.value : _stablecoinAmountIfAny;
// //         if (totalRaised + amount > options.hardCap) revert HardCapExceeded();

// //         if (amount < options.min) revert BelowMinimumContribution();
// //         if (contributions[_contributor] + amount > options.max) {
// //             revert ExceedsMaximumContribution();
// //         }
// //     }

// //     function calculateTotalTokensNeeded() external view returns (uint256) {
// //         return _tokensForPresale() + _tokensForLiquidity();
// //     }

// //     function isAllowedLiquidityBps(uint256 _bps) public view returns (bool) {
// //         for (uint256 i = 0; i < ALLOWED_LIQUIDITY_BPS.length; i++) {
// //             if (_bps == ALLOWED_LIQUIDITY_BPS[i]) return true;
// //         }
// //         return false;
// //     }

// //     function userTokens(address _contributor) public view returns (uint256) {
// //         uint256 contribution = contributions[_contributor];
// //         if (contribution == 0) return 0;
// //         return (contribution * options.presaleRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //     }

// //     function getContributorCount() external view returns (uint256) {
// //         return contributors.length;
// //     }

// //     function getContributors() external view returns (address[] memory) {
// //         return contributors;
// //     }

// //     function getTotalContributed() external view returns (uint256) {
// //         return totalRaised;
// //     }

// //     function getContribution(address _contributor) external view returns (uint256) {
// //         return contributions[_contributor];
// //     }

// //     function _getCurrencyMultiplier() private view returns (uint256) {
// //         if (options.currency == address(0)) {
// //             return 1 ether;
// //         }
// //         try ERC20(options.currency).decimals() returns (uint8 decimals) {
// //             return 10 ** decimals;
// //         } catch {
// //             revert InvalidCurrencyDecimals();
// //         }
// //     }

// //     function _safeTransferCurrency(address _to, uint256 _amount) private {
// //         if (_amount == 0) return;
// //         if (options.currency == address(0)) {
// //             payable(_to).sendValue(_amount);
// //         } else {
// //             IERC20(options.currency).safeTransfer(_to, _amount);
// //         }
// //     }

// //     function _tokensForPresale() private view returns (uint256) {
// //         return (options.hardCap * options.presaleRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //     }

// //     function _tokensForLiquidity() private view returns (uint256) {
// //         uint256 currencyForLiquidity = (options.hardCap * options.liquidityBps) / BASIS_POINTS;
// //         return (currencyForLiquidity * options.listingRate * 10 ** token.decimals()) / _getCurrencyMultiplier();
// //     }

// //     function _weiForLiquidity() private view returns (uint256) {
// //         return (totalRaised * options.liquidityBps) / BASIS_POINTS;
// //     }

// //     function toggleWhitelist(bool enabled) external {}

// //     function updateWhitelist(address[] calldata addresses, bool add) external override {}

// //     function getPresaleOptions() external view returns (PresaleOptions memory) {
// //         return options;
// //     }

// //     function getOptions() external view override returns (Presale.PresaleOptions memory) {
// //         return options;
// //     }

// //     function initializeDeposit() external onlyFactory whenNotPaused returns (uint256) {
// //         if (state != PresaleState.Pending) revert InvalidState(uint8(state));
// //         if (block.timestamp >= options.start) revert NotInPurchasePeriod();

// //         // Check if a pair already exists for this token and currency.
// //         // This presale system is intended for launching new tokens.
// //         address pairCurrencyCheck = (options.currency == address(0)) ? weth : options.currency;
// //         if (IUniswapV2Factory(factory).getPair(address(token), pairCurrencyCheck) != address(0)) {
// //             revert PairAlreadyExists(address(token), pairCurrencyCheck);
// //         }

// //         uint256 depositedAmount = IERC20(token).balanceOf(address(this));
// //         if (depositedAmount == 0) revert ZeroAmount();
// //         tokensClaimable = _tokensForPresale();
// //         tokensLiquidity = _tokensForLiquidity();
// //         uint256 totalTokensNeeded = tokensClaimable + tokensLiquidity;

// //         if (depositedAmount < totalTokensNeeded) {
// //             revert InsufficientTokenDeposit(depositedAmount, totalTokensNeeded);
// //         }

// //         tokenBalance = depositedAmount;
// //         state = PresaleState.Active;

// //         emit Deposit(msg.sender, depositedAmount, block.timestamp); // msg.sender is the factory
// //         return depositedAmount;
// //     }

// //     function deposit() external override returns (uint256) {}

// //     function setMerkleRoot(bytes32 _merkleRoot) external override {}
// // }


// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// // --- Imports ---
// import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol"; // Assuming Vesting/Locker use this

// // Import necessary contracts and interfaces
// import {Presale} from "./Presale.sol"; // Import Presale to access its struct/enum
// import {LiquidityLocker} from "./LiquidityLocker.sol";
// import {Vesting} from "./Vesting.sol";
// import {IPresale} from "./interfaces/IPresale.sol"; // Import for event/error interfaces if needed

// contract PresaleFactory is Ownable {
//     using SafeERC20 for IERC20;

//     // --- State Variables ---

//     // Addresses of core utility contracts deployed by the factory
//     LiquidityLocker public immutable liquidityLocker;
//     Vesting public immutable vestingContract;

//     // Fee configuration
//     uint256 public creationFee; // Fee in ETH or feeToken
//     address public feeToken; // Address(0) for ETH fee, otherwise ERC20 token address
//     uint256 public constant BASIS_POINTS = 10_000;

//     // House fee configuration (passed to Presale instances)
//     uint256 public housePercentage; // Percentage (BPS) taken from raised funds for the house
//     address public houseAddress; // Address receiving the house fee

//     // Role identifiers (assuming Vesting/Locker use OpenZeppelin AccessControl)
//     bytes32 public constant VESTER_ROLE = keccak256("VESTER_ROLE");
//     bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");

//     address[] public createdPresales; // Track all presale contracts created by this factory
//     mapping(address => Presale.PresaleOptions) public presaleConfigurations; // Store configurations for each presale

//     // --- Events ---

//     event PresaleCreated(
//         address indexed creator, address indexed presaleContract, address indexed token, uint256 start, uint256 end
//     );

//     event PresaleConfiguration(Presale.PresaleOptions indexed options);

//     event FeeConfigurationChanged(uint256 newCreationFee, address newFeeToken);
//     event HouseConfigurationChanged(uint256 newHousePercentage, address newHouseAddress);

//     // --- Errors ---
//     error FeePaymentFailed();
//     error InvalidFeeConfiguration();
//     error InvalidHouseConfiguration();
//     error RoleGrantFailed();
//     error ZeroAddress();
//     error IndexOutOfBounds();
//     error NotAPresaleContract();
//     error InvalidCapSettings();
//     error InvalidCurrencyDecimals();

//     // --- Constructor ---
//     constructor(
//         uint256 _creationFee,
//         address _feeToken,
//         uint256 _housePercentage, // e.g., 100 for 1%
//         address _houseAddress
//     ) Ownable(msg.sender) {
//         // <<< FIX: Removed check involving msg.value >>>
//         // Fee validation happens in createPresale, not here.
//         // if (_feeToken == address(0) && _creationFee > 0 && msg.value != _creationFee) {
//         //     // If fee is in ETH, constructor doesn't receive value, handle in createPresale
//         // }
//         if (_feeToken != address(0) && _creationFee > 0) {
//             // Cannot verify ERC20 fee payment in constructor easily
//         }
//         if (_housePercentage > 500) revert InvalidHouseConfiguration(); // Max 5% house fee
//         if (_houseAddress == address(0) && _housePercentage > 0) revert InvalidHouseConfiguration();

//         creationFee = _creationFee;
//         feeToken = _feeToken;
//         housePercentage = _housePercentage;
//         houseAddress = _houseAddress;

//         // Deploy dependent contracts
//         // The factory automatically becomes the DEFAULT_ADMIN_ROLE for these
//         liquidityLocker = new LiquidityLocker();
//         vestingContract = new Vesting();
//     }

//     // --- External Functions ---

//     /**
//      * @notice Creates a new Presale contract instance.
//      * @param _options The configuration options for the presale.
//      * @param _token The address of the ERC20 token being sold.
//      * @param _weth The address of the Wrapped Ether contract (used for ETH pairs).
//      * @param _uniswapV2Router02 The address of the Uniswap V2 compatible router.
//      * @return presaleAddress The address of the newly created Presale contract.
//      */
//     function createPresale(
//         Presale.PresaleOptions memory _options, // Use struct from Presale.sol
//         address _token,
//         address _weth,
//         address _uniswapV2Router02
//     ) external payable returns (address presaleAddress) {
//         // Keep payable as fee might be ETH
//         // 1. Handle Creation Fee
//         if (creationFee > 0) {
//             if (feeToken == address(0)) {
//                 // ETH Fee
//                 if (msg.value < creationFee) revert FeePaymentFailed();
//                 // Forward excess ETH if any? Or require exact amount. Assuming require exact for now.
//                 if (msg.value > creationFee) {
//                     payable(msg.sender).transfer(msg.value - creationFee); // Return excess
//                 }
//                 // Note: The actual creationFee amount stays with the factory temporarily
//                 // and can be withdrawn by the owner using withdrawFees().
//             } else {
//                 // ERC20 Fee
//                 if (msg.value > 0) revert InvalidFeeConfiguration(); // Should not send ETH if fee is token
//                 IERC20(feeToken).safeTransferFrom(msg.sender, owner(), creationFee); // Send fee directly to owner
//             }
//         } else {
//             if (msg.value > 0) revert InvalidFeeConfiguration(); // Should not send ETH if no fee
//         }

//         // 2. Deploy the Presale Contract
//         Presale newPresale = new Presale(
//             _weth,
//             _token,
//             _uniswapV2Router02,
//             _options,
//             msg.sender, // The creator of the presale via the factory
//             address(liquidityLocker),
//             address(vestingContract),
//             housePercentage,
//             houseAddress,
//             address(this) // Pass the factory address for fee handling
//         );

//         presaleAddress = address(newPresale);

//         // Transfer presale tokens to the presale contract
//         IERC20(_token).safeTransferFrom(msg.sender, presaleAddress, _options.tokenDeposit);
//         newPresale.initializeDeposit();

//         // 3. Grant Roles to the new Presale contract
//         // The factory needs DEFAULT_ADMIN_ROLE on Locker/Vesting (granted by constructor)
//         try vestingContract.grantRole(VESTER_ROLE, presaleAddress) {}
//         catch {
//             revert RoleGrantFailed();
//         }
//         try liquidityLocker.grantRole(LOCKER_ROLE, presaleAddress) {}
//         catch {
//             revert RoleGrantFailed();
//         }
//         createdPresales.push(presaleAddress);
//         // 4. Emit Factory-level event (optional, as Presale constructor also emits)
//         emit PresaleCreated(msg.sender, presaleAddress, _token, _options.start, _options.end);
//         emit PresaleConfiguration(_options);
//         return presaleAddress;
//     }

//     /**
//      * @notice Updates the creation fee configuration. Only callable by the owner.
//      * @param _newCreationFee The new fee amount.
//      * @param _newFeeToken The new fee token address (address(0) for ETH).
//      */
//     function setFeeConfiguration(uint256 _newCreationFee, address _newFeeToken) external onlyOwner {
//         if (_newFeeToken != address(0)) {
//             // Basic check if it looks like a contract
//             uint32 size;
//             assembly {
//                 size := extcodesize(_newFeeToken)
//             }
//             if (size == 0) revert ZeroAddress(); // Use a more specific error if desired
//         }

//         creationFee = _newCreationFee;
//         feeToken = _newFeeToken;
//         emit FeeConfigurationChanged(_newCreationFee, _newFeeToken);
//     }

//     /**
//      * @notice Updates the house fee percentage and address. Only callable by the owner.
//      * @param _newHousePercentage The new house fee percentage (in BPS, e.g., 100 for 1%).
//      * @param _newHouseAddress The new address to receive house fees.
//      */
//     function setHouseConfiguration(uint256 _newHousePercentage, address _newHouseAddress) external onlyOwner {
//         if (_newHousePercentage > 500) revert InvalidHouseConfiguration(); // Max 5% house fee
//         if (_newHouseAddress == address(0) && _newHousePercentage > 0) {
//             revert InvalidHouseConfiguration(); // Cannot set zero address if percentage is non-zero
//         }
//         if (_newHouseAddress != address(0)) {
//             // Basic check if it looks like a contract or EOA, not strictly necessary but good practice
//             // For EOA, extcodesize is 0. For contracts, it's > 0.
//             // This doesn't prevent sending to a non-contract address if intended.
//         }

//         housePercentage = _newHousePercentage;
//         houseAddress = _newHouseAddress;
//         emit HouseConfigurationChanged(_newHousePercentage, _newHouseAddress);
//     }

//     /**
//      * @notice Allows the owner to withdraw collected ETH fees from this factory contract.
//      * @dev ERC20 fees are sent directly to the owner during creation.
//      */
//     function withdrawFees() external onlyOwner {
//         uint256 balance = address(this).balance;
//         require(balance > 0, "No fees to withdraw");
//         (bool success,) = owner().call{value: balance}(""); // Use call for safer transfer
//         require(success, "ETH fee withdrawal failed");
//     }

//     function calculateTotalTokensNeededForPresale(Presale.PresaleOptions memory _options, address _token)
//         external
//         view
//         returns (uint256 totalTokensNeeded)
//     {
//         if (_token == address(0)) revert ZeroAddress();
//         if (_options.hardCap == 0 || _options.presaleRate == 0 || _options.listingRate == 0) {
//             revert InvalidCapSettings();
//         }

//         uint256 currencyMultiplier = _getCurrencyMultiplier(_options.currency);
//         uint256 tokenDecimals = 10 ** ERC20(_token).decimals();

//         // Calculate tokens for presale: (hardCap * presaleRate * 10^tokenDecimals) / currencyMultiplier
//         uint256 tokensForPresale = (_options.hardCap * _options.presaleRate * tokenDecimals) / currencyMultiplier;

//         // Calculate tokens for liquidity: (currencyForLiquidity * listingRate * 10^tokenDecimals) / currencyMultiplier
//         uint256 currencyForLiquidity = (_options.hardCap * _options.liquidityBps) / 10_000;
//         uint256 tokensForLiquidity = (currencyForLiquidity * _options.listingRate * tokenDecimals) / currencyMultiplier;

//         totalTokensNeeded = tokensForPresale + tokensForLiquidity;
//         return totalTokensNeeded;
//     }

//     function _getCurrencyMultiplier(address _currency) private view returns (uint256) {
//         if (_currency == address(0)) {
//             return 1 ether; // ETH uses 10^18
//         }
//         try ERC20(_currency).decimals() returns (uint8 decimals) {
//             return 10 ** decimals;
//         } catch {
//             revert InvalidCurrencyDecimals();
//         }
//     }

//     // --- View Functions ---

//     function getCreationFee() external view returns (uint256) {
//         return creationFee;
//     }

//     function getHousePercentage() external view returns (uint256) {
//         return housePercentage;
//     }

//     function getHouseAddress() external view returns (address) {
//         return houseAddress;
//     }

//     function getPresaleCount() external view returns (uint256) {
//         return createdPresales.length;
//     }

//     function getPresaleAt(uint256 index) external view returns (address) {
//         if (index >= createdPresales.length) revert IndexOutOfBounds(); // Use custom error
//         return createdPresales[index];
//     }

//     function getAllPresales() external view returns (address[] memory) {
//         return createdPresales;
//     }

//     function getPresaleOptionsByAddress(address _presaleAddress)
//         external
//         view
//         returns (Presale.PresaleOptions memory options)
//     {
//         // Basic check: Ensure the address is a contract
//         uint32 size;
//         assembly {
//             size := extcodesize(_presaleAddress)
//         }
//         if (size == 0) revert NotAPresaleContract();

//         // Call the getOptions function on the target Presale contract
//         // This requires Presale.sol to have a public/external view function getOptions()
//         // and IPresale interface to declare it.
//         try IPresale(_presaleAddress).getOptions() returns (Presale.PresaleOptions memory _options) {
//             return _options;
//         } catch {
//             // Handle cases where the call fails (e.g., address is not a Presale contract
//             // or doesn't implement getOptions correctly)
//             revert NotAPresaleContract(); // Or a more specific error
//         }
//     }
// }