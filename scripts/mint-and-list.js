const { ethers, network } = require("hardhat");
const { moveBlocks, sleep } = require("../utils/move-blocks");

const PRICE = ethers.utils.parseEther("0.01");

async function mintAndList() {
  //以下contract省略了deployer,預設也會使用第0個account去連接合約,所以不用寫const {deployer} = await getNamedAccounts;
  const nftMarketplace = await ethers.getContract("NftMarketplace");
  const basicNft = await ethers.getContract("BasicNftTwo");
  console.log("Minting...");
  const mintTx = await basicNft.mintNft();
  const mintTxReceipt = await mintTx.wait(1);
  //因為mintNft function有觸發event,其中的index有包含tokenId,所以可以直接從這裡抓取
  const tokenId = mintTxReceipt.events[0].args.tokenId;
  console.log("Approving Nft...");

  const approvalTx = await basicNft.approve(nftMarketplace.address, tokenId);
  await approvalTx.wait(1);
  console.log("Listing Nft...");

  const listTx = await nftMarketplace.listItem(basicNft.address, tokenId, PRICE);
  await listTx.wait(1);
  console.log("Listed!");

  //如果在hardhat區塊鏈,則在上面步驟上架NFT之後,自動在產出兩個區塊,且等待時間為1秒,
  //這用於在Moralis server監聽hardhat區塊鏈時,的區塊確認
  if (network.config.chainId == "31337") {
    await moveBlocks(2, (sleepAmount = 1000));
  }
}

mintAndList()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
