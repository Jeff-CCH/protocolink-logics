import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { claimToken, getChainId, snapshotAndRevertEach } from '@composable-router/test-helpers';
import * as common from '@composable-router/common';
import * as core from '@composable-router/core';
import { expect } from 'chai';
import * as helpers from './helpers';
import hre from 'hardhat';
import * as hrehelpers from '@nomicfoundation/hardhat-network-helpers';
import * as protocols from 'src/protocols';

describe('Test CompoundV3 Claim Logic', function () {
  let chainId: number;
  let users: SignerWithAddress[];
  let compoundV3Service: protocols.compoundv3.Service;

  before(async function () {
    chainId = await getChainId();
    const [, user1, user2] = await hre.ethers.getSigners();
    users = [user1, user2];
    compoundV3Service = new protocols.compoundv3.Service(chainId, hre.ethers.provider);
    await claimToken(chainId, user1.address, protocols.compoundv3.mainnetTokens.WETH, '100');
    await claimToken(chainId, user1.address, protocols.compoundv3.mainnetTokens.USDC, '1000');
  });

  snapshotAndRevertEach();

  const testCases = [
    {
      ownerIndex: 0,
      claimerIndex: 0,
      marketId: protocols.compoundv3.MarketId.USDC,
      supply: new common.TokenAmount(protocols.compoundv3.mainnetTokens.WETH, '1'),
      borrow: new common.TokenAmount(protocols.compoundv3.mainnetTokens.USDC, '100'),
    },
    {
      ownerIndex: 0,
      claimerIndex: 1,
      marketId: protocols.compoundv3.MarketId.USDC,
      supply: new common.TokenAmount(protocols.compoundv3.mainnetTokens.WETH, '1'),
      borrow: new common.TokenAmount(protocols.compoundv3.mainnetTokens.USDC, '100'),
    },
    {
      ownerIndex: 0,
      claimerIndex: 0,
      marketId: protocols.compoundv3.MarketId.ETH,
      supply: new common.TokenAmount(protocols.compoundv3.mainnetTokens.WETH, '10'),
    },
    {
      ownerIndex: 0,
      claimerIndex: 1,
      marketId: protocols.compoundv3.MarketId.ETH,
      supply: new common.TokenAmount(protocols.compoundv3.mainnetTokens.WETH, '10'),
    },
  ];

  testCases.forEach(({ ownerIndex, claimerIndex, marketId, supply, borrow }, i) => {
    it(`case ${i + 1}`, async function () {
      const owner = users[ownerIndex];
      const claimer = users[claimerIndex];

      // 1. supply or borrow first
      await helpers.supply(chainId, owner, marketId, supply);
      if (borrow) {
        await helpers.borrow(chainId, owner, marketId, borrow); // USDC market supply apr 0%, borrow apr 3.69%
      }

      // 2. get rewards amount after 1000 blocks
      await hrehelpers.mine(1000);
      const compoundV3ClaimLogic = new protocols.compoundv3.ClaimLogic(chainId, hre.ethers.provider);
      const { output } = await compoundV3ClaimLogic.quote({ marketId, owner: owner.address });
      expect(output.amountWei).to.be.gt(0);

      // 2. allow userAgent help user to claim
      const tokensReturn = [];
      if (claimer.address === owner.address) {
        await helpers.allow(chainId, claimer, marketId);
        const userAgent = core.calcAccountAgent(chainId, claimer.address);
        const isAllowed = await compoundV3Service.isAllowed(marketId, claimer.address, userAgent);
        expect(isAllowed).to.be.true;
        tokensReturn.push(output.token.elasticAddress);
      }

      // 4. build router logics
      const routerLogics: core.IParam.LogicStruct[] = [];
      routerLogics.push(
        await compoundV3ClaimLogic.getLogic({ marketId, owner: owner.address, output }, { account: claimer.address })
      );

      // 5. send router tx
      const transactionRequest = core.newRouterExecuteTransactionRequest({ chainId, routerLogics, tokensReturn });
      await expect(claimer.sendTransaction(transactionRequest)).to.not.be.reverted;
      await expect(owner.address).to.changeBalance(output.token, output.amount, 1);
    });
  });
});