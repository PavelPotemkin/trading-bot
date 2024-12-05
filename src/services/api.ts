import { TonClient } from "@ton/ton";
import { configService } from "./config";

import { TonApiClient } from '@ton-api/client'
import { StonApiClient } from "@ston-fi/api";

export const tonCenterClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: configService.tonCenterApiKey
});

export const stonApiClient = new StonApiClient()

export const tonApiClient = new TonApiClient({
    baseUrl: 'https://tonapi.io',
    apiKey: configService.tonApiKey,
})

