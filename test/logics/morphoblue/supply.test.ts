import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import hre from 'hardhat';
import * as morphoblue from 'src/logics/morphoblue';
import omit from 'lodash/omit';
import * as utils from 'test/utils';

describe('mainnet-pb: Test Morphoblue Supply Logic', function () {
  let chainId: number;
  let user: SignerWithAddress;
  let service: morphoblue.Service;

  before(async function () {
    chainId = await getChainId();
    [, user] = await hre.ethers.getSigners();
    service = new morphoblue.Service(chainId, hre.ethers.provider);

    await claimToken(chainId, user.address, morphoblue.mainnetTokens.WETH, '10');
  });

  snapshotAndRevertEach();

  const testCases = [
    {
      marketId: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
      input: new common.TokenAmount(morphoblue.mainnetTokens.WETH, '1'),
    },
    {
      marketId: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
      input: new common.TokenAmount(morphoblue.mainnetTokens.WETH, '1'),
      balanceBps: 5000,
    },
    {
      marketId: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
      input: new common.TokenAmount(morphoblue.mainnetTokens.ETH, '1'),
    },
    {
      marketId: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
      input: new common.TokenAmount(morphoblue.mainnetTokens.ETH, '1'),
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
      const morphoblueSupplyLogic = new morphoblue.SupplyLogic(chainId, hre.ethers.provider);
      routerLogics.push(await morphoblueSupplyLogic.build({ marketId, input, balanceBps }, { account: user.address }));

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
      const supplyBalance = await service.getSupplyBalance(marketId, user.address);
      expect(supplyBalance.amount).eq(input.amount);
      expect(JSON.stringify(omit(supplyBalance.token.toObject(), 'logoUri'))).eq(
        JSON.stringify(omit(input.token.wrapped.toObject(), 'logoUri'))
      );
    });
  });
});
