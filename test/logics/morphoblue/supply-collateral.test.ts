import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import hre from 'hardhat';
import * as morphoblue from 'src/logics/morphoblue';
import * as utils from 'test/utils';

describe('goerli: Test Morphoblue SupplyCollateral Logic', function () {
  let chainId: number;
  let user: SignerWithAddress;
  let service: morphoblue.Service;

  before(async function () {
    chainId = await getChainId();
    [, user] = await hre.ethers.getSigners();
    service = new morphoblue.Service(chainId, hre.ethers.provider);

    await claimToken(
      chainId,
      user.address,
      morphoblue.goerliTokens.DAI,
      '5000',
      '0x112EC3b862AB061609Ef01D308109a6691Ee6a2d'
    );

    await claimToken(
      chainId,
      user.address,
      morphoblue.goerliTokens.WETH,
      '10',
      '0x88124Ef4A9EC47e691F254F2E8e348fd1e341e9B'
    );
  });

  snapshotAndRevertEach();

  const testCases = [
    {
      marketId: '0x3098a46de09dd8d9a8c6fa1ab7b3f943b6f13e5ea72a4e475d9e48f222bfd5a0',
      input: new common.TokenAmount(morphoblue.goerliTokens.DAI, '1000'),
    },
    {
      marketId: '0x3098a46de09dd8d9a8c6fa1ab7b3f943b6f13e5ea72a4e475d9e48f222bfd5a0',
      input: new common.TokenAmount(morphoblue.goerliTokens.DAI, '1000'),
      balanceBps: 5000,
    },
    {
      marketId: '0x98ee9f294c961a5dbb9073c0fd2c2a6a66468f911e49baa935c0eab364499dbd',
      input: new common.TokenAmount(morphoblue.goerliTokens.WETH, '1'),
    },
    {
      marketId: '0x98ee9f294c961a5dbb9073c0fd2c2a6a66468f911e49baa935c0eab364499dbd',
      input: new common.TokenAmount(morphoblue.goerliTokens.WETH, '1'),
      balanceBps: 5000,
    },
    {
      marketId: '0x98ee9f294c961a5dbb9073c0fd2c2a6a66468f911e49baa935c0eab364499dbd',
      input: new common.TokenAmount(morphoblue.goerliTokens.ETH, '1'),
    },
    {
      marketId: '0x98ee9f294c961a5dbb9073c0fd2c2a6a66468f911e49baa935c0eab364499dbd',
      input: new common.TokenAmount(morphoblue.goerliTokens.ETH, '1'),
      balanceBps: 5000,
    },
  ];

  testCases.forEach(({ marketId, input, balanceBps }, i) => {
    it(`case ${i + 1}`, async function () {
      // 1. build funds, tokensReturn
      const tokensReturn = [];
      const funds = new common.TokenAmounts();
      if (balanceBps) {
        funds.add(utils.calcRequiredAmountByBalanceBps(input, balanceBps));
        tokensReturn.push(input.token.elasticAddress);
      } else {
        funds.add(input);
      }

      // 2. build router logics
      const routerLogics: core.DataType.LogicStruct[] = [];
      const morphoblueSupplyCollateralLogic = new morphoblue.SupplyCollateralLogic(chainId, hre.ethers.provider);
      routerLogics.push(
        await morphoblueSupplyCollateralLogic.build({ marketId, input, balanceBps }, { account: user.address })
      );

      // 3. get router permit2 datas
      const permit2Datas = await utils.getRouterPermit2Datas(chainId, user, funds.erc20);

      // 4. send router tx
      const routerKit = new core.RouterKit(chainId);
      const transactionRequest = routerKit.buildExecuteTransactionRequest({
        permit2Datas,
        routerLogics,
        tokensReturn,
        value: funds.native?.amountWei ?? 0,
      });

      await expect(user.sendTransaction(transactionRequest)).to.not.be.reverted;
      await expect(user.address).to.changeBalance(input.token, -input.amount);
      const collateralBalance = await service.getCollateralBalance(marketId, user.address);
      expect(collateralBalance).to.be.deep.eq(new common.TokenAmount(input.token.wrapped, input.amount));
    });
  });
});
