import { LogicTestCase } from 'test/types';
import { WrappedNativeTokenLogic, WrappedNativeTokenLogicFields } from './logic.wrapped-native-token';
import * as common from '@protocolink/common';
import { constants, utils } from 'ethers';
import * as core from '@protocolink/core';
import { expect } from 'chai';

describe('Utility WrappedNativeTokenLogic', function () {
  context('Test getTokenList', async function () {
    WrappedNativeTokenLogic.supportedChainIds.forEach((chainId) => {
      it(`network: ${common.toNetworkId(chainId)}`, async function () {
        const logic = new WrappedNativeTokenLogic(chainId);
        const tokenList = logic.getTokenList();
        expect(tokenList).to.have.lengthOf.above(0);
      });
    });
  });

  context('Test build', function () {
    const chainId = common.ChainId.mainnet;
    const logic = new WrappedNativeTokenLogic(chainId);
    const iface = common.WETH__factory.createInterface();

    const testCases: LogicTestCase<WrappedNativeTokenLogicFields>[] = [
      {
        fields: {
          input: new common.TokenAmount(common.mainnetTokens.ETH, '1'),
          output: new common.TokenAmount(common.mainnetTokens.WETH, '1'),
        },
      },
      {
        fields: {
          input: new common.TokenAmount(common.mainnetTokens.WETH, '1'),
          output: new common.TokenAmount(common.mainnetTokens.ETH, '1'),
        },
      },
      {
        fields: {
          input: new common.TokenAmount(common.mainnetTokens.ETH, '1'),
          output: new common.TokenAmount(common.mainnetTokens.WETH, '1'),
          balanceBps: 5000,
        },
      },
      {
        fields: {
          input: new common.TokenAmount(common.mainnetTokens.WETH, '1'),
          output: new common.TokenAmount(common.mainnetTokens.ETH, '1'),
          balanceBps: 5000,
        },
      },
    ];

    testCases.forEach(({ fields }) => {
      it(`${fields.input.token.symbol} to ${fields.output.token.symbol}${
        fields.balanceBps ? ' with balanceBps' : ''
      }`, async function () {
        const routerLogic = await logic.build(fields);
        const sig = routerLogic.data.substring(0, 10);
        const { input, balanceBps } = fields;

        expect(routerLogic.to).to.eq(common.mainnetTokens.WETH.address);
        expect(utils.isBytesLike(routerLogic.data)).to.be.true;
        if (input.token.isNative) {
          expect(sig).to.eq(iface.getSighash('deposit'));
          expect(routerLogic.inputs[0].token).to.eq(common.ELASTIC_ADDRESS);
        } else {
          expect(sig).to.eq(iface.getSighash('withdraw'));
        }
        if (balanceBps) {
          expect(routerLogic.inputs[0].balanceBps).to.eq(balanceBps);
          expect(routerLogic.inputs[0].amountOrOffset).to.eq(input.token.isNative ? core.OFFSET_NOT_USED : 0);
        } else {
          expect(routerLogic.inputs[0].balanceBps).to.eq(core.BPS_NOT_USED);
          expect(routerLogic.inputs[0].amountOrOffset).to.eq(input.amountWei);
        }
        expect(routerLogic.approveTo).to.eq(constants.AddressZero);
        expect(routerLogic.callback).to.eq(constants.AddressZero);
      });
    });
  });
});
