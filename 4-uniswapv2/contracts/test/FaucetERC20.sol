//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../UniswapV2ERC20.sol";

// Simple faucet token for demos/testing. Anyone can mint a bounded amount per call.
contract FaucetERC20 is UniswapV2ERC20 {
    uint256 public constant MINT_AMOUNT = 1000 * 10 ** 18;

    function faucet() external {
        _mint(msg.sender, MINT_AMOUNT);
    }
}
