import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as compoundv3 from 'src/logics/compound-v3';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import hre from 'hardhat';
import * as utils from 'test/utils';

describe('Test CompoundV3 SupplyCollateral Logic', function () {
  let chainId: number;
  let user: SignerWithAddress;
  let service: compoundv3.Service;

  before(async function () {
    chainId = await getChainId();
    [, user] = await hre.ethers.getSigners();
    service = new compoundv3.Service(chainId, hre.ethers.provider);
    await claimToken(chainId, user.address, compoundv3.mainnetTokens.WETH, '10');
    await claimToken(chainId, user.address, compoundv3.mainnetTokens.WBTC, '10');
    await claimToken(chainId, user.address, compoundv3.mainnetTokens.cbETH, '10');
    await claimToken(chainId, user.address, compoundv3.mainnetTokens.wstETH, '10');
  });

  snapshotAndRevertEach();

  const testCases = [
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.ETH, '1'),
    },
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.ETH, '1'),
      balanceBps: 5000,
    },
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.WETH, '1'),
    },
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.WETH, '1'),
      balanceBps: 5000,
    },
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.WBTC, '1'),
    },
    {
      marketId: compoundv3.MarketId.USDC,
      input: new common.TokenAmount(compoundv3.mainnetTokens.WBTC, '1'),
      balanceBps: 5000,
    },
    {
      marketId: compoundv3.MarketId.ETH,
      input: new common.TokenAmount(compoundv3.mainnetTokens.cbETH, '1'),
    },
    {
      marketId: compoundv3.MarketId.ETH,
      input: new common.TokenAmount(compoundv3.mainnetTokens.cbETH, '1'),
      balanceBps: 5000,
    },
    {
      marketId: compoundv3.MarketId.ETH,
      input: new common.TokenAmount(compoundv3.mainnetTokens.wstETH, '1'),
    },
    {
      marketId: compoundv3.MarketId.ETH,
      input: new common.TokenAmount(compoundv3.mainnetTokens.wstETH, '1'),
      balanceBps: 5000,
    },
  ];

  testCases.forEach(({ marketId, input, balanceBps }, i) => {
    it(`case ${i + 1}`, async function () {
      // 1. check can supply or not
      const canSupply = await service.canSupply(marketId, input);
      if (!canSupply) return;

      // 2. build funds, tokensReturn
      const tokensReturn = [];
      const funds = new common.TokenAmounts();
      if (balanceBps) {
        funds.add(utils.calcRequiredAmountByBalanceBps(input, balanceBps));
        tokensReturn.push(input.token.elasticAddress);
      } else {
        funds.add(input);
      }

      // 3. build router logics
      const routerLogics: core.IParam.LogicStruct[] = [];
      const compoundV3SupplyCollateralLogic = new compoundv3.SupplyCollateralLogic(chainId, hre.ethers.provider);
      routerLogics.push(
        await compoundV3SupplyCollateralLogic.build({ marketId, input, balanceBps }, { account: user.address })
      );

      // 4. get router permit2 datas
      const permit2Datas = await utils.getRouterPermit2Datas(chainId, user, funds.erc20);

      // 5. send router tx
      const routerKit = new core.RouterKit(chainId);
      const transactionRequest = routerKit.buildExecuteTransactionRequest({
        permit2Datas,
        routerLogics,
        tokensReturn,
        value: funds.native?.amountWei ?? 0,
      });
      await expect(user.sendTransaction(transactionRequest)).to.not.be.reverted;
      await expect(user.address).to.changeBalance(input.token, -input.amount, 1);
      const collateralBalance = await service.getCollateralBalance(marketId, user.address, input.token);
      expect(collateralBalance.amountWei).to.eq(input.amountWei);
    });
  });
});
