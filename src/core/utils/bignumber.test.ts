import { BigNumber, BigNumberish, utils } from 'ethers';
import { ToBigUnitOptions, calcSlippage, toBigUnit, toSmallUnit } from './bignumber';
import { expect } from 'chai';

describe('Test toSmallUnit', function () {
  const cases = [
    {
      title: '1 ETH',
      amount: '1',
      decimals: 18,
      expected: BigNumber.from(10).pow(18),
    },
    {
      title: '1 USDC',
      amount: '1',
      decimals: 6,
      expected: 1e6,
    },
    {
      title: '1 CHI',
      amount: '1',
      decimals: 1,
      expected: 10,
    },
  ];

  cases.forEach(({ title, amount, decimals, expected }) => {
    it(title, function () {
      expect(toSmallUnit(amount, decimals).eq(expected)).to.be.true;
    });
  });
});

describe('Test toBigUnit', function () {
  const cases: {
    title: string;
    amountWei: BigNumberish;
    decimals: number;
    options?: ToBigUnitOptions;
    expected: string;
  }[] = [
    {
      title: '1 ETH',
      amountWei: BigNumber.from(10).pow(18),
      decimals: 18,
      expected: '1',
    },
    {
      title: '1 USDC',
      amountWei: BigNumber.from(1e6),
      decimals: 6,
      expected: '1',
    },
    {
      title: '1 CHI',
      amountWei: BigNumber.from(10),
      decimals: 1,
      expected: '1',
    },
    {
      title: 'round',
      amountWei: BigNumber.from(2345).mul(BigNumber.from(10).pow(15)),
      decimals: 18,
      options: { displayDecimals: 2, mode: 'round' },
      expected: '2.35',
    },
    {
      title: 'ceil',
      amountWei: BigNumber.from(2341).mul(BigNumber.from(10).pow(15)),
      decimals: 18,
      options: { displayDecimals: 2, mode: 'ceil' },
      expected: '2.35',
    },
    {
      title: 'floor',
      amountWei: BigNumber.from(2345).mul(BigNumber.from(10).pow(15)),
      decimals: 18,
      options: { displayDecimals: 2, mode: 'floor' },
      expected: '2.34',
    },
    {
      title: 'negative',
      amountWei: BigNumber.from(2345).mul(BigNumber.from(10).pow(15)).mul(-1),
      decimals: 18,
      options: { displayDecimals: 3 },
      expected: '-2.345',
    },
    {
      title: 'round 0.99959',
      amountWei: BigNumber.from(99959),
      decimals: 5,
      options: { displayDecimals: 3, mode: 'round' },
      expected: '1',
    },
    {
      title: 'ceil 0.99949',
      amountWei: BigNumber.from(99949),
      decimals: 5,
      options: { displayDecimals: 3, mode: 'ceil' },
      expected: '1',
    },
    {
      title: '96.096',
      amountWei: BigNumber.from('960968427608232789'),
      decimals: 16,
      options: { displayDecimals: 2, mode: 'round' },
      expected: '96.1',
    },
    {
      title: '0.006',
      amountWei: BigNumber.from('68427608232789'),
      decimals: 16,
      options: { displayDecimals: 2, mode: 'round' },
      expected: '0.01',
    },
    {
      title: 'CEL decimals 4',
      amountWei: BigNumber.from('1000000'),
      decimals: 4,
      options: { displayDecimals: 5 },
      expected: '100',
    },
    {
      title: '1000001071195923456',
      amountWei: BigNumber.from('1000001071195923456'),
      decimals: 18,
      options: { displayDecimals: 5 },
      expected: '1',
    },
    {
      title: '1000001071195923456 ceil',
      amountWei: BigNumber.from('1000001071195923456'),
      decimals: 18,
      options: { displayDecimals: 5, mode: 'ceil' },
      expected: '1.00001',
    },
    {
      title: '0.450700378639366919',
      amountWei: BigNumber.from(utils.parseUnits('0.450700378639366919', 18)),
      decimals: 18,
      options: { displayDecimals: 5, mode: 'ceil' },
      expected: '0.45071',
    },
    {
      title: '0.000000962931699371',
      amountWei: BigNumber.from(utils.parseUnits('0.000000962931699371', 18)),
      decimals: 18,
      options: { displayDecimals: 5 },
      expected: '0',
    },
  ];

  cases.forEach(({ title, amountWei, decimals, options, expected }) => {
    it(title, function () {
      expect(toBigUnit(amountWei, decimals, options)).to.eq(expected);
    });
  });
});

describe('Test calcSlippage', function () {
  const cases = [
    { amountWei: 100, slippage: 100, expected: 99 },
    { amountWei: 100, slippage: 1000, expected: 90 },
    { amountWei: 100, slippage: 10000, expected: 0 },
    { amountWei: 123, slippage: 4567, expected: 66 },
    { amountWei: 100, slippage: -100, expected: 101 },
  ];

  cases.forEach(({ amountWei, slippage, expected }, i) => {
    it(`case ${i + 1}`, function () {
      expect(calcSlippage(amountWei, slippage)).to.eq(expected);
    });
  });
});
