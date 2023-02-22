const { ethers, network } = require("hardhat");
const { moveBlocks } = require("../utils/move-blocks");

const TOKEN_ID = 0;

async function buyItem() {
  const nftMarketplace = await ethers.getContract("NftMarketplace");
  const basicNft = await ethers.getContract("BasicNftTwo");
  //先抓取合約中在架上NFT
  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID);
  //抓出該架上NFT的價格
  const price = listing.price.toString();
  const tx = await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: price });
  await tx.wait(1);
  console.log("Bought NFT!");
  //如果是在hardhat環境的話,則呼叫moveBlocks function產出兩個新區塊,並等待1000 ms
  if (network.config.chainId == "31337") {
    await moveBlocks(2, (sleepAmount = 1000));
  }
}

buyItem()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
