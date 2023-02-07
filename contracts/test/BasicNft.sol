// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

pragma solidity ^0.8.7;

contract BasicNft is ERC721 {
  string public constant TOKEN_URI =
    "ipfs://bafybeig37ioir76s7mg5oobetncojcm3c3hxasyd4rvid4jqhy4gkaheg4";
  uint private s_tokeCounter; //設定一個變數 讓其自動計數tokenId

  //傳入ERC721.sol的constuctor的name跟symbol
  constructor() ERC721("Dogie", "DOG") {
    //初始化時給s_tokeCounter為0
    s_tokeCounter = 0;
  }

  function mintNft() public returns (uint) {
    //呼叫ERC-721的 safeMint function,tokenId是全域變數
    _safeMint(msg.sender, s_tokeCounter);
    s_tokeCounter = s_tokeCounter + 1; //每次mint過後 就將tokenId +1
    return s_tokeCounter;
  }

  function getTokenCounter() public view returns (uint) {
    return s_tokeCounter;
  }

  //覆蓋掉原生ERC-721的tokenURI function,輸入參數tokenID因為用不到所以註解
  function tokenURI(uint /* tokenId */) public view override returns (string memory) {
    return TOKEN_URI;
  }
}
