// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ExampleERC721 is ERC721, Ownable {
    uint256 public nextTokenId;

    constructor() ERC721("Example NFT", "ENFT") {}

    function mint(address to) external onlyOwner {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(to, tokenId);
    }
}
