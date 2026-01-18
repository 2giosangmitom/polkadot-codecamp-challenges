// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FundBridge is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenBridgeAddress = vm.envAddress("TOKEN_BRIDGE_ADDRESS");
        address usdhAddress = vm.envAddress("USDH_ADDRESS");
        
        // Amount to fund the bridge with (default 10,000 USD.h for fees)
        // You can override with FUND_AMOUNT environment variable
        uint256 fundAmount = vm.envOr("FUND_AMOUNT", uint256(10000 ether));

        vm.startBroadcast(deployerPrivateKey);

        // Check current balance
        uint256 currentBalance = IERC20(usdhAddress).balanceOf(tokenBridgeAddress);
        console.log("Bridge current balance:", currentBalance);
        console.log("Funding bridge with:", fundAmount);

        // Transfer USD.h tokens to the bridge contract
        IERC20(usdhAddress).transfer(tokenBridgeAddress, fundAmount);

        uint256 newBalance = IERC20(usdhAddress).balanceOf(tokenBridgeAddress);
        console.log("Bridge new balance:", newBalance);
        console.log("Successfully funded TokenBridge at:", tokenBridgeAddress);

        vm.stopBroadcast();
    }
}
