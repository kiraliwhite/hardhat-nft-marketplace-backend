const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("nftMarketplace unit test", async () => {
      let nftMarketplace,
        basicNft,
        deployer,
        player,
        playerConnectNftMarketplace,
        basicNftPrice,
        lowPrice,
        basicNftTokenId,
        pay;

      basicNftPrice = ethers.utils.parseEther("0.01");
      pay = ethers.utils.parseEther("0.01");
      lowPrice = 0;
      basicNftTokenId = 0;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(["all"]);
        nftMarketplace = await ethers.getContract("NftMarketplace", deployer);
        basicNft = await ethers.getContract("BasicNft", deployer);

        player = (await getNamedAccounts()).player;
        playerConnectNftMarketplace = await ethers.getContract("NftMarketplace", player);
        // 另一種寫法 先用getSigners 抓取帳號,再用connect的方式,這種帳號性質跟getContract的連線方式稍有不同,以下的測試要做對應的調整
        // 例如在寫地址的時候會是player.address,而不是player, 因為這不同於getNamedAccount的命名
        // const accounts = await ethers.getSigners();
        // player = accounts[1];
        // playerConnectNftMarketplace = await nftMarketplace.connect(player);

        //先鑄造NFT才有辦法上架
        const txResponse = await basicNft.mintNft();
        await txResponse.wait(1);
      });

      describe("listItem", () => {
        //當NFT價格小於0時,預期上架NFT會失敗
        it("expected reverts when NFT price less than 0", async () => {
          await expect(
            nftMarketplace.listItem(basicNft.address, basicNftTokenId, lowPrice)
          ).to.be.revertedWith("NftMarketPlace__PriceMustBeAboveZero");
        });

        //當NFT沒有授權給marketplace時,上架NFT會失敗
        it("expected reverts when NFT not approved", async () => {
          //呼叫listItem function預期會失敗,因為該NFT沒有授權到nftMarketplace
          await expect(
            nftMarketplace.listItem(basicNft.address, basicNftTokenId, basicNftPrice)
          ).to.be.revertedWith("NftMarketPlace__NotApprovedForMarketplace");
        });

        //當NFT有授權時
        it("NFT approved", async () => {
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const ApprovedAddress = await basicNft.getApproved(basicNftTokenId);
          //approved過後的地址,應該與nftMarketplace地址相同,代表NFT授權給nftMarketplace
          assert.equal(nftMarketplace.address, ApprovedAddress);

          //如果不是NFT的擁有者,上架NFT預期會失敗
          await expect(
            playerConnectNftMarketplace.listItem(basicNft.address, basicNftTokenId, basicNftPrice)
          ).to.be.revertedWith("NftMarketPlace__NotOwner");

          //NFT擁有者呼叫listItem,將NFT上架
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          const txReceipt = await txResponse.wait(1);
          //上架後預期,賣家為deployer,賣出的NFT tokenId = 0,價格為0.01 eth, 賣出的NFT地址為basicNft
          assert.equal(txReceipt.events[0].args.seller, deployer);
          assert.equal(txReceipt.events[0].args.tokenId.toString(), basicNftTokenId);
          assert.equal(txReceipt.events[0].args.price.toString(), basicNftPrice);
          assert.equal(txReceipt.events[0].args.nftAddress, basicNft.address);

          //如果NFT已經上架過了,再次上架會失敗
          await expect(
            nftMarketplace.listItem(basicNft.address, basicNftTokenId, basicNftPrice)
          ).to.be.revertedWith("NftMarketPlace__AlreadyListed");
        });
      });

      describe("buyItem", () => {
        //若購買的NFT不在架上,則購買NFT預期會失敗
        it("expected reverts when Nft not listed", async () => {
          await expect(
            nftMarketplace.buyItem(basicNft.address, basicNftTokenId)
          ).to.be.revertedWith("NftMarketPlace__NotListed");
        });

        //若付的錢不夠,則購買NFT會失敗
        it("expected reverts when you don't pay enough", async () => {
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          await txResponse.wait(1);
          const lowpay = ethers.utils.parseEther("0.001");
          await expect(
            nftMarketplace.buyItem(basicNft.address, basicNftTokenId, { value: lowpay })
          ).to.be.revertedWith("NftMarketPlace__PriceNotMet");
        });

        it("buy success", async () => {
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          await txResponse.wait(1);
          //使用player購買NFT,預期成功觸發事件
          await expect(
            playerConnectNftMarketplace.buyItem(basicNft.address, basicNftTokenId, { value: pay })
          ).to.emit(nftMarketplace, "ItemBought");

          //getListing會回傳一個陣列包含著price和seller,
          const listedItem = await nftMarketplace.getListing(basicNft.address, basicNftTokenId);
          //預期價格為0,因為已經不在架上被買走了,沒有價格
          assert.equal(listedItem[0].toString(), "0");

          //NFT的擁有者變為player
          const newOwner = await basicNft.ownerOf(basicNftTokenId);
          assert(newOwner == player);

          //預期player的NFT數目為1,因為買了一個
          const ownersNftAmount = await basicNft.balanceOf(player);
          assert.equal(ownersNftAmount.toString(), "1");

          //預期賣家得到的錢,會是買家出價購買NFT的錢
          const sellerProceeds = await nftMarketplace.getProceeds(deployer);
          assert.equal(sellerProceeds.toString(), pay);
        });
      });

      describe("cancelItem", () => {
        beforeEach(async () => {
          //先將NFT approve和上架
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          await txResponse.wait(1);
        });

        //預期NFT會下架
        it("expected the NFT will be unlist", async () => {
          await expect(nftMarketplace.cancelListing(basicNft.address, basicNftTokenId)).to.emit(
            nftMarketplace,
            "ItemCanceled"
          );

          //getListing會回傳一個陣列包含著price和seller,
          const listedItem = await nftMarketplace.getListing(basicNft.address, basicNftTokenId);
          //預期價格為0,因為已經不在架上被下架了,沒有價格
          assert.equal(listedItem[0].toString(), "0");
        });
      });

      describe("updateListing", () => {
        let newPrice;

        beforeEach(async () => {
          //先將NFT上架
          newPrice = ethers.utils.parseEther("0.02");
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          await txResponse.wait(1);
        });

        //預期NFT價格會更新
        it("expected the NFT price will be update", async () => {
          await expect(
            nftMarketplace.updateListing(basicNft.address, basicNftTokenId, newPrice)
          ).to.emit(nftMarketplace, "ItemListed");
          //使用getListing抓取目前在架上的NFT,取得新價格,預期新價格等於更新的價格
          const newNftPrice = await nftMarketplace.getListing(basicNft.address, basicNftTokenId);
          assert.equal(newNftPrice[0].toString(), newPrice);
        });
      });

      describe("withdraw", () => {
        //如果沒有proceeds,則預期withdraw會失敗
        it("expected reverts when no anyone buy the NFT", async () => {
          await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
            "NftMarketPlace__NoProceeds"
          );
        });

        it("if the NFT has been buy, withdraw will success", async () => {
          //先將NFT上架
          const approved = await basicNft.approve(nftMarketplace.address, basicNftTokenId);
          await approved.wait(1);
          const txResponse = await nftMarketplace.listItem(
            basicNft.address,
            basicNftTokenId,
            basicNftPrice
          );
          await txResponse.wait(1);

          //有人購買了NFT
          const buyTx = await playerConnectNftMarketplace.buyItem(
            basicNft.address,
            basicNftTokenId,
            { value: pay }
          );
          await buyTx.wait(1);

          //賣家初始錢包餘額,因為getNamedAccount,是一串帳戶地址,這個本身沒有getBalance的function,因此使用ethers.getSingers抓取第0個帳號
          //也就是deployer,這種類型的帳號才會有getBalance的function, 如果寫成這樣 const sellerBalanceBefore = await deployer.getBalance(); 會失敗
          const accounts = await ethers.getSigners();
          const sellerBalanceBefore = await accounts[0].getBalance();

          //賣家收到的錢=買家花費購買NFT的錢
          const sellerProceeds = await nftMarketplace.getProceeds(deployer);
          assert.equal(sellerProceeds.toString(), pay);

          //賣家從NFT marketplace裡領錢出來
          const withdrawTx = await nftMarketplace.withdrawProceeds();
          const withdrawReceipt = await withdrawTx.wait(1);
          //從領錢的交易中抓取花費了多少Gas,和基礎的gasPrice
          const { gasUsed, effectiveGasPrice } = withdrawReceipt;
          //總共花費的GasCost = gasUsed * effectiveGasPrice
          const gasCost = gasUsed.mul(effectiveGasPrice);

          //抓取領錢後賣家錢包的餘額
          const sellerBalanceAfter = await accounts[0].getBalance();

          //賣家領錢之前的餘額 + NFT賣出賺的錢 = 賣家領錢後的餘額 + 領錢所花費的Gas
          assert(
            sellerBalanceBefore.add(sellerProceeds).toString() ==
              sellerBalanceAfter.add(gasCost).toString()
          );
        });
      });
    });
