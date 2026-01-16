// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Script.sol";
import "../src/TokenBridge.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract BridgeUSDh is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenBridgeAddress = vm.envAddress("TOKEN_BRIDGE_ADDRESS");
        address usdhAddress = vm.envAddress("USDH_ADDRESS");
        address recipient = vm.envOr(
            "RECIPIENT_ADDRESS",
            vm.addr(deployerPrivateKey)
        );
        uint256 amount = vm.envOr("AMOUNT", uint256(1));

        // Default to Paseo chain ID if not provided
        string memory destChainId = vm.envOr(
            "DEST_CHAIN_ID",
            string("420420422")
        );
        bytes memory destChain = bytes(destChainId);

        vm.startBroadcast(deployerPrivateKey);

        // Approve TokenBridge to spend USDh
        IERC20(usdhAddress).approve(tokenBridgeAddress, amount);

        console.log("Approved TokenBridge to spend USDh");

        // Bridge USDh
        TokenBridge(tokenBridgeAddress).bridgeTokens(
            usdhAddress,
            "USDh",
            amount,
            recipient,
            destChain
        );

        console.log("Bridged", amount, "USDh to chain", destChainId);
        console.log("Recipient:", recipient);

        vm.stopBroadcast();
    }
}
