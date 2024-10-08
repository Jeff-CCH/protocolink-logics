import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { approve } from '@protocolink/test-helpers';
import * as common from '@protocolink/common';
import * as core from '@protocolink/core';
import { expect } from 'chai';
import hre from 'hardhat';
import * as iolend from 'src/logics/iolend';

export async function deposit(chainId: number, user: SignerWithAddress, assetAmount: common.TokenAmount) {
  assetAmount = new common.TokenAmount(assetAmount.token.wrapped, assetAmount.amount);

  const service = new iolend.Service(chainId, hre.ethers.provider);
  const lendingPoolAddress = await service.getLendingPoolAddress();
  await approve(user, lendingPoolAddress, assetAmount);
  await expect(
    iolend.LendingPool__factory.connect(lendingPoolAddress, user).deposit(
      assetAmount.token.address,
      assetAmount.amountWei,
      user.address,
      0
    )
  ).to.not.be.reverted;
}

export async function approveDelegation(
  chainId: number,
  user: SignerWithAddress,
  assetAmount: common.TokenAmount,
  interestRateMode: iolend.InterestRateMode
) {
  const routerKit = new core.RouterKit(chainId);
  const agent = await routerKit.calcAgent(user.address);

  const service = new iolend.Service(chainId, hre.ethers.provider);
  const isDelegationApproved = await service.isDelegationApproved(user.address, agent, assetAmount, interestRateMode);
  if (!isDelegationApproved) {
    const tx = await service.buildApproveDelegationTransactionRequest(agent, assetAmount, interestRateMode);
    await expect(user.sendTransaction(tx)).to.not.be.reverted;
  }
}

export async function borrow(
  chainId: number,
  user: SignerWithAddress,
  assetAmount: common.TokenAmount,
  interestRateMode: iolend.InterestRateMode
) {
  if (assetAmount.token.isNative) {
    const wrappedToken = assetAmount.token.wrapped;
    await expect(common.WETH__factory.connect(wrappedToken.address, user).deposit({ value: assetAmount.amountWei })).to
      .not.be.reverted;
    assetAmount = new common.TokenAmount(wrappedToken, assetAmount.amount);
  }

  const service = new iolend.Service(chainId, hre.ethers.provider);
  const lendingPoolAddress = await service.getLendingPoolAddress();
  await approve(user, lendingPoolAddress, assetAmount);
  await expect(
    iolend.LendingPool__factory.connect(lendingPoolAddress, user).borrow(
      assetAmount.token.address,
      assetAmount.amountWei,
      interestRateMode,
      0,
      user.address
    )
  ).to.not.be.reverted;
}
