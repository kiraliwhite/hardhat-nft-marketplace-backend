const { network } = require("hardhat");

//等待millisecond,使用Promise,setTimeout結束後會返回
function sleep(timeInMs) {
  return new Promise((resolve) => setTimeout(resolve, timeInMs));
}

//輸入參數amount指的是要鑄造幾個區塊,sleepAmount則是,在鑄造區塊後要等待幾秒,預設為0,也可以設定成10分鐘,類似於真的區塊鏈
async function moveBlocks(amount, sleepAmount = 0) {
  console.log("Moving blocks...");
  //使用for迴圈,如果amount大於1就會進行多次的evm_mine,用於鑄造新區塊
  for (let i = 0; i < amount; i++) {
    await network.provider.request({
      method: "evm_mine",
      params: [],
    });
    //如果輸入餐數有sleepAmount,則會等待特定秒數之後,才會再次產出新區塊
    if (sleepAmount) {
      console.log(`Sleeping for ${sleepAmount}`);
      await sleep(sleepAmount);
    }
  }
}

module.exports = {
  moveBlocks,
  sleep,
};
