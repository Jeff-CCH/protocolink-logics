import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import * as helpers from './helpers';
import hre from 'hardhat';
import * as iolend from 'src/logics/iolend';
import * as utils from 'test/utils';

describe('iota-pb: Test Iolend Repay Logic', () => {
  let chainId: number;
  let users: SignerWithAddress[];

  before(async () => {
    chainId = await getChainId();
    const [, user1, user2] = await hre.ethers.getSigners();
    users = [user1, user2];
    await claimToken(
      chainId,
      user1.address,
      common.iotaTokens.USDT,
      '5000',
      '0x7fA6e7C26Fac91541306B0240f930599F6e1D041'
    );
    await claimToken(
      chainId,
      user1.address,
      common.iotaTokens.wIOTA,
      '5000',
      '0x260817581206317e2665080a2e66854e922269d0'
    );
    await claimToken(
      chainId,
      user2.address,
      common.iotaTokens.USDT,
      '5000',
      '0x7fA6e7C26Fac91541306B0240f930599F6e1D041'
    );
    await claimToken(
      chainId,
      user2.address,
      common.iotaTokens.wIOTA,
      '5000',
      '0x260817581206317e2665080a2e66854e922269d0'
    );
  });

  snapshotAndRevertEach();

  const testCases = [
    {
      userIndex: 0,
      deposit: new common.TokenAmount(common.iotaTokens.USDT, '5000'),
      borrow: new common.TokenAmount(common.iotaTokens.IOTA, '100'),
      interestRateMode: iolend.InterestRateMode.variable,
    },
    {
      userIndex: 0,
      deposit: new common.TokenAmount(common.iotaTokens.USDT, '5000'),
      borrow: new common.TokenAmount(common.iotaTokens.wIOTA, '100'),
      interestRateMode: iolend.InterestRateMode.variable,
    },
    {
      userIndex: 1,
      deposit: new common.TokenAmount(common.iotaTokens.wIOTA, '1000'),
      borrow: new common.TokenAmount(common.iotaTokens.USDT, '1'),
      interestRateMode: iolend.InterestRateMode.variable,
    },
    {
      // done
      userIndex: 0,
      deposit: new common.TokenAmount(common.iotaTokens.USDT, '5000'),
      borrow: new common.TokenAmount(common.iotaTokens.IOTA, '100'),
      interestRateMode: iolend.InterestRateMode.variable,
      balanceBps: 5000,
    },
    {
      userIndex: 0,
      deposit: new common.TokenAmount(common.iotaTokens.USDT, '5000'),
      borrow: new common.TokenAmount(common.iotaTokens.wIOTA, '100'),
      interestRateMode: iolend.InterestRateMode.variable,
      balanceBps: 5000,
    },
    {
      userIndex: 1,
      deposit: new common.TokenAmount(common.iotaTokens.wIOTA, '1000'),
      borrow: new common.TokenAmount(common.iotaTokens.USDT, '1'),
      interestRateMode: iolend.InterestRateMode.variable,
      balanceBps: 5000,
    },
  ];

  testCases.forEach(({ userIndex, deposit, borrow, interestRateMode, balanceBps }, i) => {
    it(`case ${i + 1}`, async () => {
      // 1. deposit and borrow first
      const user = users[userIndex];
      await helpers.deposit(chainId, user, deposit);
      await helpers.borrow(chainId, user, borrow, interestRateMode);

      // 2. get user debt
      const iolendRepayLogic = new iolend.RepayLogic(chainId, hre.ethers.provider);
      let quotation = await iolendRepayLogic.quote({
        borrower: user.address,
        tokenIn: borrow.token,
        interestRateMode,
      });
      const { input } = quotation;

      // 3. build funds and tokensReturn
      const funds = new common.TokenAmounts();
      if (balanceBps) {
        funds.add(utils.calcRequiredAmountByBalanceBps(input, balanceBps));
      } else {
        funds.add(input);
      }
      const tokensReturn = [input.token.elasticAddress];

      // 4. build router logics
      const routerLogics: core.DataType.LogicStruct[] = [];
      routerLogics.push(await iolendRepayLogic.build({ input, interestRateMode, borrower: user.address, balanceBps }));

      // 5. get router permit2 datas
      const permit2Datas = await utils.getRouterPermit2Datas(chainId, user, funds.erc20);

      // 6. send router tx
      const routerKit = new core.RouterKit(chainId);
      const transactionRequest = routerKit.buildExecuteTransactionRequest({
        permit2Datas,
        routerLogics,
        tokensReturn,
        value: funds.native?.amountWei ?? 0,
      });
      await expect(user.sendTransaction(transactionRequest)).to.not.be.reverted;
      await expect(user.address).to.changeBalance(input.token, -input.amount, 200);

      // 7. check user's debt should be zero
      quotation = await iolendRepayLogic.quote({ borrower: user.address, tokenIn: borrow.token, interestRateMode });
      expect(quotation.input.amountWei).to.eq(0);
    });
  });
});
