import { DEX, pTON } from '@ston-fi/sdk'
import { Decimal } from 'decimal.js'
import { fromDecimalToNano, fromNanoToDecimal } from '../utils'
import { tonCenterClient, stonApiClient, tonApiClient } from './api'
import { Address } from '@ton/core'

const TonAddress = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'
const defaultSlippage = 20


interface StonfiRouterInfo {
  address: string
  majorVersion: number
  minorVersion: number
  ptonMasterAddress: string
  ptonVersion: string
  ptonWalletAddress: string
  routerType: string
  poolCreationEnabled: boolean
}

const getRouterAndProxyTon = (routerInfo: StonfiRouterInfo) => {
  // if router or proxyTon version is not supported, use the latest version which is available in insalled SDK
  type RouterVersion = 'v2_1' | 'v2_2'
  type ProxyTonVersion = 'v2_1'

  const routerVersion = ((): RouterVersion => {
    const defaultVersion = 'v2_2' as RouterVersion
    const available = ['v2_1', 'v2_2'] as RouterVersion[]
    const version = `v${routerInfo.majorVersion}_${routerInfo.minorVersion}` as RouterVersion
    if (available.includes(version)) return version
    return defaultVersion
  })()
  const routerInstance = DEX[routerVersion].Router
  const router = tonCenterClient.open(routerInstance.create(routerInfo.address))

  const proxyTonVersion = ((): ProxyTonVersion => {
    const defaultVersion = 'v2_1' as ProxyTonVersion
    const available = ['v2_1'] as ProxyTonVersion[]
    const [major, minor] = routerInfo.ptonVersion.split('.')
    const version = `v${major}_${minor}` as ProxyTonVersion
    if (available.includes(version)) return version
    return defaultVersion
  })()
  const proxyTon = pTON[proxyTonVersion].create(routerInfo.ptonMasterAddress)

  return {
    routerInstance,
    router,
    proxyTon,
  }
}

const routersInfoCache: Map<string, StonfiRouterInfo> = new Map()
const getRouter = async (stonfiRouterAddress: string) => {
  const maybeRouterInfo = routersInfoCache.get(stonfiRouterAddress)
  if (maybeRouterInfo) return maybeRouterInfo

  const routerRes = await stonApiClient.getRouter(stonfiRouterAddress)

  routersInfoCache.set(stonfiRouterAddress, routerRes)
  return routerRes
}

const getBuyInfo = async ({ tons, jettonAddress, slippage }: { tons: Decimal, jettonAddress: string; slippage: number }) => {
  const payload: Parameters<typeof stonApiClient.simulateSwap>[0] = {
    askAddress: jettonAddress,
    offerAddress: TonAddress,
    offerUnits: fromDecimalToNano(tons).toString(),
    slippageTolerance: String(slippage / 100),
    dexV2: true,
  }

  const res = await stonApiClient.simulateSwap(payload)
  const routerInfoRes = await getRouter(res.routerAddress)

  const minReceive = fromNanoToDecimal(res.minAskUnits)
  const maxReceive = fromNanoToDecimal(res.askUnits)
  const feeUnitsInJettons = fromNanoToDecimal(res.feeUnits)
  const platformFee = feeUnitsInJettons.div(minReceive.plus(feeUnitsInJettons)).times(tons)

  return {
    minReceive,
    maxReceive,
    platformFee,
    additionalInfo: {
      routerInfo: routerInfoRes,
    },
  }
}

const getSellInfo = async ({ jettons, jettonAddress, slippage }: { jettons: Decimal, jettonAddress: string; slippage: number }) => {
  const payload: Parameters<typeof stonApiClient.simulateSwap>[0] = {
    askAddress: TonAddress,
    offerAddress: jettonAddress,
    offerUnits: fromDecimalToNano(jettons).toString(),
    slippageTolerance: String(slippage / 100),
    dexV2: true,
  }

  const res = await stonApiClient.simulateSwap(payload)
  const routerInfoRes = await getRouter(res.routerAddress)

  const minReceive = fromNanoToDecimal(res.minAskUnits)
  const maxReceive = fromNanoToDecimal(res.askUnits)
  const platformFee = fromNanoToDecimal(res.feeUnits)

  return {
    minReceive,
    maxReceive,
    platformFee,
    additionalInfo: {
      routerInfo: routerInfoRes,
    },
  }
}

export const stonfiService = {
  async getBuyJettonTxParams({ tonAmount, jettonAddress, userWalletAddress, slippage = defaultSlippage }: { jettonAddress: string; tonAmount: Decimal; slippage?: number; userWalletAddress: string }) {
    const buyInfo = await getBuyInfo({ tons: tonAmount, jettonAddress, slippage })
    const { router, proxyTon } = getRouterAndProxyTon(buyInfo.additionalInfo.routerInfo)

    const opts: Parameters<typeof router.getSwapTonToJettonTxParams>[0] = {
      userWalletAddress,
      proxyTon,
      offerAmount: fromDecimalToNano(tonAmount),
      askJettonAddress: jettonAddress,
      minAskAmount: fromDecimalToNano(buyInfo.minReceive),
    }

    return await router.getSwapTonToJettonTxParams(opts)
  },

  async getSellJettonTxParams({ jettonAmount, jettonAddress, userWalletAddress, slippage = defaultSlippage }: { jettonAddress: string; jettonAmount: Decimal; slippage?: number; userWalletAddress: string }) {
    const sellInfo = await getSellInfo({ jettons: jettonAmount, jettonAddress, slippage })
    const { router, proxyTon } = getRouterAndProxyTon(sellInfo.additionalInfo.routerInfo)

    const opts: Parameters<typeof router.getSwapJettonToTonTxParams>[0] = {
      userWalletAddress,
      proxyTon,
      offerAmount: fromDecimalToNano(jettonAmount),
      offerJettonAddress: jettonAddress,
      minAskAmount: fromDecimalToNano(sellInfo.minReceive),
    }

    return await router.getSwapJettonToTonTxParams(opts)
  },

  getTransactionStatus: async (hash: string, jettonAddress: string) => {
    const res = await tonApiClient.events.getEvent(hash)

    if (res.inProgress) throw new Error('Transaction in progress')

    const masterCall = res.actions.find(
      (a) =>
        a.type === 'JettonSwap' &&
        (a.JettonSwap?.jettonMasterIn || a.JettonSwap?.jettonMasterOut)?.address.equals(Address.parseFriendly(jettonAddress).address),
    )

    if (!masterCall || masterCall.status !== 'ok' || res.actions.find((act) => act.status !== 'ok')) return false

    return true
  }
}
