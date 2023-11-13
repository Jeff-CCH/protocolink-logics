import * as common from '@protocolink/common';

export interface Config {
  chainId: number;
  RouterAddress: string;
  tokenListUrls: string[];
}

export const configs: Config[] = [
  {
    chainId: common.ChainId.metis,
    RouterAddress: '0x0000000000924fb1969e719edeD2feD54AFB183A',
    tokenListUrls: ['https://raw.githubusercontent.com/heraaggregator/token-lists/main/heramain-v2.tokenlist.json'],
  },
];

export const [supportedChainIds, configMap] = configs.reduce(
  (accumulator, config) => {
    accumulator[0].push(config.chainId);
    accumulator[1][config.chainId] = config;
    return accumulator;
  },
  [[], {}] as [number[], Record<number, Config>]
);

export function getTokenListUrls(chainId: number) {
  return configMap[chainId].tokenListUrls;
}

export function getHeraRouterAddress(chainId: number) {
  return configMap[chainId].RouterAddress;
}
