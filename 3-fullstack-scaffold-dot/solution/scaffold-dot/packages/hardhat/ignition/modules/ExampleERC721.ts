import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ExampleERC721Module = buildModule("ExampleERC721", (m) => {
  const exampleERC721 = m.contract("ExampleERC721");
  return { exampleERC721 };
});

export default ExampleERC721Module;
