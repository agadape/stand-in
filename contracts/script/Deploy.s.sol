// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {StandIn} from "../src/StandIn.sol";

/// Usage (from contracts/):
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// Requires DEPLOYER_PRIVATE_KEY in the environment (a funded testnet key).
contract Deploy is Script {
    function run() external returns (StandIn standIn) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        standIn = new StandIn();
        vm.stopBroadcast();
        console.log("StandIn deployed at", address(standIn));
    }
}
