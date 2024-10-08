import * as common from '@protocolink/common';

export interface ReserveTokens {
  asset: common.Token;
  aToken: common.Token;
  stableDebtToken: common.Token;
  variableDebtToken: common.Token;
  isSupplyEnabled: boolean;
  isBorrowEnabled: boolean;
}

export enum InterestRateMode {
  none = 0,
  stable = 1,
  variable = 2,
}
