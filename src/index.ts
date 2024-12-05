import bodyParser from 'body-parser';
import express from 'express';
import { walletService } from './services/wallet';
import { stonfiService } from './services/stonfi';
import {Decimal} from 'decimal.js';
import { loggerService } from './services/logger';
import { executeUntilOk } from './utils';

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));

function asyncHandler(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) {
  return function (req: express.Request, res: express.Response, next: express.NextFunction) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      loggerService.error(err);
      res.status(500).send({ error: err.message || 'Произошла ошибка' });
    });
  };
}

app.post('/buy', asyncHandler(async (req, res) => {
  const body = req.body as { jettonAddress: string; tonAmount: number; slippage?: number; }
  const userWalletAddress = await walletService.getAddress()

  loggerService.log(`Buy request. Jetton address: ${body.jettonAddress}, TON amount: ${body.tonAmount}, slippage: ${body.slippage}`)

  const buyTxParams = await stonfiService.getBuyJettonTxParams({
    jettonAddress: body.jettonAddress,
    tonAmount: new Decimal(body.tonAmount),
    userWalletAddress,
    slippage: body.slippage
  })

  const hash = await walletService.sendTransaction(buyTxParams)
  const isSuccess = await executeUntilOk(() => stonfiService.getTransactionStatus(hash, body.jettonAddress))

  if (isSuccess) {
    loggerService.log(`Buy success. Tx hash: ${hash}`)
    res.send('Buy success');
  } else {
    loggerService.error(`Buy failed. Tx hash: ${hash}`)
    res.send('Buy failed');
  }
}))

app.post('/sell', asyncHandler(async (req, res) => {
  const body = req.body as { jettonAddress: string; jettonAmount: number; slippage?: number }
  const userWalletAddress = await walletService.getAddress()

  const sellTxParams = await stonfiService.getSellJettonTxParams({
    jettonAddress: body.jettonAddress,
    jettonAmount: new Decimal(body.jettonAmount),
    userWalletAddress,
    slippage: body.slippage
  })

  const hash = await walletService.sendTransaction(sellTxParams)
  const isSuccess = await executeUntilOk(() => stonfiService.getTransactionStatus(hash, body.jettonAddress))
  
  if (isSuccess) {
    res.send('Sell success');
    loggerService.log(`Sell success. Tx hash: ${hash}`)
  } else {
    res.send('Sell failed');
    loggerService.error(`Sell failed. Tx hash: ${hash}`)
  }
}))

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// curl -X POST http://localhost:3000/buy \
//   -H "Content-Type: application/x-www-form-urlencoded" \
//   -d "jettonAddress=EQBMIIYlgAI5HtWc2GTNWh5bDKY0GwHW6i3CqGxORqLDXNuE" \
//   -d "tonAmount=1"
