import { TokenList } from '@uniswap/token-lists';
import { axios } from 'src/utils';
import * as common from '@protocolink/common';
import { constants } from 'ethers';
import * as core from '@protocolink/core';
import { getHeraRouterAddress, getTokenListUrls, supportedChainIds } from './configs';
import { metisTokens } from 'src/logics/hera-v2/tokens';

export type SwapTokenLogicTokenList = common.Token[];

export type SwapTokenLogicParams = core.TokenToTokenExactInParams<{ slippage?: number }>;

export type SwapTokenLogicFields = core.TokenToTokenExactInFields<{ slippage?: number }>;

export type SwapTokenLogicOptions = Pick<core.GlobalOptions, 'account'>;

@core.LogicDefinitionDecorator()
export class SwapTokenLogic
  extends core.Logic
  implements core.LogicTokenListInterface, core.LogicOracleInterface, core.LogicBuilderInterface
{
  static readonly supportedChainIds = supportedChainIds;
  static readonly apiUrl = 'https://pathfindersdk.hera.finance'; //'https://pathfinderv25.hera.finance';

  async getTokenList() {
    const tokenListUrls = getTokenListUrls(this.chainId);
    const tokenLists: TokenList[] = [];
    await Promise.all(
      tokenListUrls.map(async (tokenListUrl) => {
        try {
          const { data } = await axios.get<TokenList>(tokenListUrl);
          tokenLists.push(data);
        } catch {}
      })
    );

    const tmp: Record<string, boolean> = { [this.nativeToken.address]: true };
    const tokenList: SwapTokenLogicTokenList = [this.nativeToken];
    for (const { tokens } of tokenLists) {
      for (const { chainId, address, decimals, symbol, name } of tokens) {
        if (tmp[address] || chainId !== this.chainId || !name || !symbol || !decimals) continue;
        tokenList.push(new common.Token(chainId, address, decimals, symbol, name));
        tmp[address] = true;
      }
    }

    return tokenList;
  }

  async quote(params: SwapTokenLogicParams) {
    const client = axios.create({ baseURL: SwapTokenLogic.apiUrl });
    const { input, tokenOut } = params;

    const account = constants.AddressZero;
    const resp = await client.get(`/quote`, {
      params: {
        account,
        amount: input.amountWei.toString(),
        tokenInAddress: input.token.elasticAddress,
        tokenInChainId: this.chainId,
        tokenOutAddress: tokenOut.elasticAddress,
        tokenOutChainId: this.chainId,
        type: 'exactIn',
      },
    });

    const { toTokenAmount } = common.classifying(resp.data);
    const output = new common.TokenAmount(tokenOut).setWei(toTokenAmount);
    return { input, output, slippage: params.slippage };
  }

  async build(fields: SwapTokenLogicFields, options: SwapTokenLogicOptions) {
    const client = axios.create({ baseURL: SwapTokenLogic.apiUrl });
    const { input, output, slippage } = fields;
    const { account } = options;

    const agent = await this.calcAgent(account);

    const resp = await client.get(`/swap`, {
      params: {
        account: agent,
        destAccount: agent,
        amount: input.amountWei.toString(),
        tokenInAddress: input.token.elasticAddress,
        tokenOutAddress: output.token.elasticAddress,
        slippage: slippage ?? 0,
        deadline: (Math.floor(Date.now() / 1000) + 1200).toString(),
      },
    });

    let inputs;
    if (input.token.is(metisTokens.METIS)) {
      const inputII = new common.TokenAmount(metisTokens.METISII, input.amount);
      inputs = [core.newLogicInput({ input: inputII })];
    } else {
      inputs = [core.newLogicInput({ input })];
    }
    const { tx } = common.classifying(resp.data);
    // const inputs = [core.newLogicInput({ input })];
    // const inputII = new common.TokenAmount(metisTokens.METISII, input.amount);
    // const inputs = [core.newLogicInput({ input: inputII })];
    // console.log('inputs');
    // console.log(inputs);

    const approveTo = getHeraRouterAddress(this.chainId);
    // console.log(tx.data);
    return core.newLogic({ to: tx.to, data: tx.data, inputs, approveTo });
  }
}
