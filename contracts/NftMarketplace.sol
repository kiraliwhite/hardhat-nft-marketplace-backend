// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketPlace__PriceMustBeAboveZero();
error NftMarketPlace__NotApprovedForMarketplace();
error NftMarketPlace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketPlace__NotOwner();
error NftMarketPlace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketPlace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketPlace__NoProceeds();
error NftMarketPlace__TransferFailed();

//防止重入攻擊,所以繼承ReentrancyGuard
contract NftMarketplace is ReentrancyGuard {
  //這個struct物件用於mapping
  struct Listing {
    uint256 price;
    address seller;
  }

  //此event會在NFT上架後觸發,列出以下資訊
  event ItemListed(
    address indexed seller,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  //此event會在上架的NFT被購買之後觸發
  event ItemBought(
    address indexed buyer,
    address indexed nftAddress,
    uint256 indexed tokenId,
    uint256 price
  );

  //此event會在已上架的NFT被取消之後觸發
  event ItemCanceled(address indexed seller, address indexed nftAddress, uint256 indexed tokenId);

  // 這個mapping的用意是,販售NFT時,需要mapping的資訊,每一個上架販賣的NFT的這些屬性,都要做關聯
  // 例如: 合約地址0xaa123, 77, 0.1eth, kira 這些資訊的mapping即 kira擁有者販售合約地址0xaa123的第77號 NFT,價格為0.1 eth
  //     nft合約地址          tokenId   Listing(販售價格,販賣NFT的擁有者)
  mapping(address => mapping(uint256 => Listing)) private s_listings;
  //這個mapping用於,當上架的NFT被買家買走之後, 賣家會獲得多少錢
  //      賣家地址    賺多少錢
  mapping(address => uint256) private s_proceeds;

  //建立一個modifier,用於檢查NFT是否已經上架過了
  modifier notListed(
    address _nftAddress,
    uint256 _tokenId,
    address _owner
  ) {
    //這是一個struct物件listing,是由mapping組成,若此物件mapping中的price價格大於0,意味著此NFT已經上架過了
    Listing memory listing = s_listings[_nftAddress][_tokenId];
    if (listing.price > 0) {
      revert NftMarketPlace__AlreadyListed(_nftAddress, _tokenId);
    }
    _;
  }

  //此modifier用於檢查,當用戶購買NFT時,該NFT是已經上架的狀態(價格必須大於0)
  modifier isListed(address _nftAddress, uint256 _tokenId) {
    Listing memory listing = s_listings[_nftAddress][_tokenId];
    if (listing.price <= 0) {
      revert NftMarketPlace__NotListed(_nftAddress, _tokenId);
    }
    _;
  }

  //此modifier用於檢查該用戶是否為NFT的擁有者
  modifier isOwner(
    address _nftAddress,
    uint256 _tokenId,
    address _spender
  ) {
    //使用ERC721合約的interface,因為要用其中的ownerOf function,來檢查NFT的擁有者
    IERC721 nft = IERC721(_nftAddress);
    //傳入tokenId,列出該NFT的擁有者
    address owner = nft.ownerOf(_tokenId);
    //若該用戶不是NFT的所有者,則revert
    if (_spender != owner) {
      revert NftMarketPlace__NotOwner();
    }
    _;
  }

  //這個function用於在網頁上上架販售的NFT,因此需要nftAddress,販售的tokenId,和上架的價格
  //使用modifier來檢查上架NFT的價格是否大於0,若大於0,則代表該NFT已經上架過了
  //使用modifier來檢查NFT的擁有者,確保上架的NFT是屬於該用戶的
  function listItem(
    address _nftAddress,
    uint256 _tokenId,
    uint256 _price
  )
    external
    notListed(_nftAddress, _tokenId, msg.sender)
    isOwner(_nftAddress, _tokenId, msg.sender)
  {
    //price必須大於0
    if (_price <= 0) {
      revert NftMarketPlace__PriceMustBeAboveZero();
    }
    //因為要使用ERC721的getApproved function,所以使用interface+合約地址
    IERC721 nft = IERC721(_nftAddress);

    //若該NFT沒有授權給此marketplace,則revert
    if (nft.getApproved(_tokenId) != address(this)) {
      revert NftMarketPlace__NotApprovedForMarketplace();
    }
    //當使用者上架要販售的NFT時,資訊會寫在mapping內,例如: s_listings[0xaa123][77] = Listing(0.1,kira);
    s_listings[_nftAddress][_tokenId] = Listing(_price, msg.sender);
    //NFT上架時,觸發event
    emit ItemListed(msg.sender, _nftAddress, _tokenId, _price);
  }

  //此function用在用戶購買NFT,
  //modifier用於檢查該NFT是已經上架的狀態才可以購買
  function buyItem(
    address _nftAddress,
    uint256 _tokenId
  ) external payable nonReentrant isListed(_nftAddress, _tokenId) {
    //先抓取準備要購買的NFT的mapping資訊
    Listing memory listedItem = s_listings[_nftAddress][_tokenId];
    //如果用戶付的錢小於該上架的NFT售價,則revert,因為錢不夠不能買
    if (msg.value < listedItem.price) {
      revert NftMarketPlace__PriceNotMet(_nftAddress, _tokenId, listedItem.price);
    }
    //當上架的NFT被購買時,使用mapping紀錄賣家會獲得多少錢
    s_proceeds[listedItem.seller] += msg.value;
    //因為上架的NFT已經被買走了,所以要刪除mapping,去掉原有的seller和price,這時候如果在呼叫listItem function就不會看到此NFT,因為沒有價格
    delete (s_listings[_nftAddress][_tokenId]);
    //使用ERC721 interface,將該NFT轉移,        from,        to       ,  tokenId
    IERC721(_nftAddress).safeTransferFrom(listedItem.seller, msg.sender, _tokenId);
    emit ItemBought(msg.sender, _nftAddress, _tokenId, listedItem.price);
  }

  //此function的用意是,將賣家上架的NFT取消,觸發此function的人必須是該NFT的擁有者,且該NFT是處於上架的狀態
  function cancelListing(
    address _nftAddress,
    uint256 _tokenId
  ) external isOwner(_nftAddress, _tokenId, msg.sender) isListed(_nftAddress, _tokenId) {
    //使用delete去掉mapping,就不會有seller和price,這時候如果在呼叫listItem function就不會看到此NFT,因為沒有價格
    delete (s_listings[_nftAddress][_tokenId]);
    emit ItemCanceled(msg.sender, _nftAddress, _tokenId);
  }

  //此function的用意是,賣家上架NFT之後,需要更新價格時,呼叫此function,賣家必須是NFT的擁有者,且該NFT已上架
  function updateListing(
    address _nftAddress,
    uint256 _tokenId,
    uint256 _newPrice
  ) external isOwner(_nftAddress, _tokenId, msg.sender) isListed(_nftAddress, _tokenId) {
    s_listings[_nftAddress][_tokenId].price = _newPrice;
    //直接觸發ItemListed即可,因為更新價格後也算是上架
    emit ItemListed(msg.sender, _nftAddress, _tokenId, _newPrice);
  }

  //此function的用意是,當賣家上架的NFT賣出之後,賣家可以呼叫此function領錢
  function withdrawProceeds() external nonReentrant {
    //若賣家上架的NFT已被購買,則在buyItem的function內,會更新賣家能夠獲得多少錢
    uint256 proceeds = s_proceeds[msg.sender];
    if (proceeds <= 0) {
      revert NftMarketPlace__NoProceeds();
    }
    //要領錢之前,先將proceeds歸0避免重入攻擊
    s_proceeds[msg.sender] = 0;
    (bool success, ) = payable(msg.sender).call{value: proceeds}("");
    if (!success) {
      revert NftMarketPlace__TransferFailed();
    }
  }

  //列出目前已上架的NFT,因為有mapping的價格,代表已上架
  function getListing(
    address _nftAddress,
    uint256 _tokenId
  ) external view returns (Listing memory) {
    return s_listings[_nftAddress][_tokenId];
  }

  //列出已賣出NFT的賣家目前能夠領多少錢
  function getProceeds(address _seller) external view returns (uint256) {
    return s_proceeds[_seller];
  }
}
