import * as common from '@protocolink/common';

type ContractNames = 'ProtocolDataProvider' | 'AaveV2FlashLoanCallback';

export interface Config {
  chainId: number;
  contract: Record<ContractNames, string>;
}

export const configs: Config[] = [
  {
    chainId: common.ChainId.mainnet,
    contract: {
      ProtocolDataProvider: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
      AaveV2FlashLoanCallback: '0x27BfAC5fb25C3853C2F48cF0e5B2F89Ea03C0104',
    },
  },
  {
    chainId: common.ChainId.polygon,
    contract: {
      ProtocolDataProvider: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
      AaveV2FlashLoanCallback: '0x27BfAC5fb25C3853C2F48cF0e5B2F89Ea03C0104',
    },
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

export function getContractAddress(chainId: number, name: ContractNames) {
  return configMap[chainId].contract[name];
}
