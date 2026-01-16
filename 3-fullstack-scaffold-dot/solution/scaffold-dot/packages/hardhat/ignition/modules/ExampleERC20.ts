import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ExampleERC20Module = buildModule("ExampleERC20", (m) => {
  const exampleERC20 = m.contract("ExampleERC20");
  return { exampleERC20 };
});

export default ExampleERC20Module;
