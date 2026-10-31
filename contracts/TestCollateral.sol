// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Worthless test collateral. Anyone may mint it; it is not a stablecoin or aUSD.
contract TestCollateral is ERC20 {
    constructor() ERC20("Second Order Units", "SOU") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address beneficiary, uint256 amount) external {
        require(amount <= 1_000_000 * 1e6, "Test mint cap");
        _mint(beneficiary, amount);
    }
}
