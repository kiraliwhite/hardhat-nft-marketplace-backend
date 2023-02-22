const { ethers, network } = require("hardhat");
const { moveBlocks } = require("../utils/move-blocks");

const PRICE = ethers.utils.parseEther("0.01");

async function mint() {
  //以下contract省略了deployer,預設也會使用第0個account去連接合約,所以不用寫const {deployer} = await getNamedAccounts;
  const basicNft = await ethers.getContract("BasicNftTwo");
  console.log("Minting...");
  const mintTx = await basicNft.mintNft();
  const mintTxReceipt = await mintTx.wait(1);
  const tokenId = mintTxReceipt.events[0].args.tokenId;
  console.log(`Got tokenId: ${tokenId}`);
  console.log(`NFT Address: ${basicNft.address}`);

  if (network.config.chainId == "31337") {
    await moveBlocks(2, (sleepAmount = 1000));
  }
}

mint()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
