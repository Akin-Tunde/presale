# Errors to add

1.  pair already exist: PairAlreadyExists(address,address)
2.  insufficient token for presale : ERC20InsufficientBalance(address,uint256,uint256)
3.  ERC20InsufficientAllowance(address,uint256,uint256)
    4.user cancel request

    conditons fromthe contract i want us to effectand respective erro to toast on the frontend
    if (state != PresaleState.Pending) revert InvalidState(uint8(state));
    if (block.timestamp >= options.start) revert NotInPurchasePeriod();

         // Check if a pair already exists for this token and currency.
         // This presale system is intended for launching new tokens.
         address pairCurrencyCheck = (options.currency == address(0)) ? weth : options.currency;
         if (IUniswapV2Factory(factory).getPair(address(token), pairCurrencyCheck) != address(0)) {
             revert PairAlreadyExists(address(token), pairCurrencyCheck);
         }

         uint256 depositedAmount = IERC20(token).balanceOf(address(this));
         if (depositedAmount == 0) revert ZeroAmount();
         tokensClaimable = _tokensForPresale();
         tokensLiquidity = _tokensForLiquidity();
         uint256 totalTokensNeeded = tokensClaimable + tokensLiquidity;

         if (depositedAmount < totalTokensNeeded) {
             revert InsufficientTokenDeposit(depositedAmount, totalTokensNeeded);
         }

         tokenBalance = depositedAmount;
         state = PresaleState.Active;

         emit Deposit(msg.sender, depositedAmount, block.timestamp); // msg.sender is the factory
         return depositedAmount;

             if (_weth == address(0) || _token == address(0) || _uniswapV2Router02 == address(0)) {
            revert InvalidInitialization();
        }
        if (_liquidityLocker == address(0) || _vestingContract == address(0)) {
            revert InvalidInitialization();
        }
        if (_options.leftoverTokenOption > 2) {
            revert InvalidLeftoverTokenOption();
        }
        if (_housePercentage > 500) revert InvalidHouseConfiguration();
        if (_houseAddress == address(0) && _housePercentage > 0) {
            revert InvalidHouseConfiguration();
        }

        if (_options.hardCap == 0 || _options.softCap == 0 || _options.softCap > _options.hardCap) {
            revert InvalidCapSettings();
        }
        if (_options.max == 0 || _options.min == 0 || _options.min > _options.max || _options.max > _options.hardCap) {
            revert InvalidContributionLimits();
        }
        if (_options.presaleRate == 0 || _options.listingRate == 0 || _options.listingRate >= _options.presaleRate) {
            revert InvalidRates();
        }
        if (_options.start < block.timestamp || _options.end <= _options.start) {
            revert InvalidTimestamps();
        }
        if (
            _options.vestingPercentage > BASIS_POINTS
                || (_options.vestingPercentage > 0 && _options.vestingDuration == 0)
        ) revert InvalidVestingPercentage();

        if (_options.whitelistType == WhitelistType.Merkle && _options.merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot(); // Need a root if type is Merkle
        }
        if (_options.whitelistType == WhitelistType.NFT && _options.nftContractAddress == address(0)) {
            revert InvalidNftContractAddress(); // Need NFT contract if type is NFT
        }
        if (!isAllowedLiquidityBps(_options.liquidityBps)) {
            // <<< ADDED VALIDATION
            revert InvalidLiquidityBps();
        }

# thinhf to cange

1. i have to approve twite before the buton turns to create presale also wven when i approve i still get presale created... toasts

2. //0x250Bb18dc15C261E13d125B2C1d4846A3BF9b800
