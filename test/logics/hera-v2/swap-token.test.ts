import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import * as herav2 from 'src/logics/hera-v2';
import hre from 'hardhat';
import { metisTokens } from 'src/logics/hera-v2/tokens';
import * as utils from 'test/utils';

describe('metis: Test HeraV2 SwapToken Logic', function () {
  let chainId: number;
  let user: SignerWithAddress;

  before(async function () {
    chainId = await getChainId();
    [, user] = await hre.ethers.getSigners();
    await claimToken(chainId, user.address, metisTokens.METIS, '2000', '0x7314Ef2CA509490f65F52CC8FC9E0675C66390b8');
    await claimToken(chainId, user.address, metisTokens.WETH, '100', '0xc5779AB95fc7C8B04c96f3431736F2455b0E6A1A');
    await claimToken(chainId, user.address, metisTokens.USDC, '3000', '0x885C8AEC5867571582545F894A5906971dB9bf27');
  });

  snapshotAndRevertEach();

  const testCases = [
    // {
    //   params: {
    //     input: new common.TokenAmount(metisTokens.METIS, '100'),
    //     tokenOut: metisTokens.USDC,
    //     slippage: 1,
    //   },
    // },
    // {
    //   params: {
    //     input: new common.TokenAmount(metisTokens.WETH, '1'),
    //     tokenOut: metisTokens.USDC,
    //     slippage: 1,
    //   },
    // },
    // {
    //   params: {
    //     input: new common.TokenAmount(metisTokens.USDC, '1'),
    //     tokenOut: metisTokens.WETH,
    //     slippage: 1,
    //   },
    // },
    {
      params: {
        input: new common.TokenAmount(metisTokens.USDC, '100'),
        tokenOut: metisTokens.WETH,
        slippage: 1,
      },
    },
    // {
    //   params: {
    //     input: new common.TokenAmount(metisTokens.USDC, '100'),
    //     tokenOut: metisTokens.DAI,
    //     slippage: 1,
    //   },
    // },
    // TODO: USDC to metis: slippage problem
    // {
    //   params: {
    //     input: new common.TokenAmount(metisTokens.USDC, '100'),
    //     tokenOut: metisTokens.METIS,
    //     slippage: 1,
    //   },
    // },
  ];

  testCases.forEach(({ params }, i) => {
    it(`case ${i + 1}`, async function () {
      // 1. get output
      const heraV2SwapTokenLogic = new herav2.SwapTokenLogic(chainId);
      const quotation = await heraV2SwapTokenLogic.quote(params);
      const { input, output } = quotation;

      // console.log(quotation);

      // 2. build funds, tokensReturn
      const funds = new common.TokenAmounts(input);
      const tokensReturn = [output.token.elasticAddress];

      // 3. build router logics
      const routerLogics: core.DataType.LogicStruct[] = [];
      routerLogics.push(await heraV2SwapTokenLogic.build(quotation, { account: user.address }));

      // 4. get router permit2 datas
      const permit2Datas = await utils.getRouterPermit2Datas(chainId, user, funds.erc20);

      // 5. send router tx
      // console.log(quotation.input.amountWei);
      const value = params.input.token.is(metisTokens.METIS) ? quotation.input.amountWei : funds.native?.amountWei ?? 0;
      console.log(value);
      const routerKit = new core.RouterKit(chainId);
      const transactionRequest = routerKit.buildExecuteTransactionRequest({
        permit2Datas,
        routerLogics,
        tokensReturn,
        value, //quotation.input.amountWei, //funds.native?.amountWei ?? 0, //quotation.input.amountWei, //funds.native?.amountWei ?? 0, //quotation.input.amountWei,
      });
      // console.log(transactionRequest);
      // return;
      await expect(user.sendTransaction(transactionRequest)).to.not.be.reverted;
      await expect(user.address).to.changeBalance(input.token, -input.amount);
      await expect(user.address).to.changeBalance(output.token, output.amount, quotation.slippage);
    });
  });
});
