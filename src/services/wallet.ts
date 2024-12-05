import { mnemonicToPrivateKey } from "@ton/crypto";
import { Address, internal, SenderArguments, SendMode, WalletContractV5R1 } from "@ton/ton";
import { configService } from "./config";
import { tonCenterClient } from "./api";

const getWallet = async () => {
    const mnemonicPhrase = configService.mnemonic;
    if (!mnemonicPhrase) throw new Error('Не указана мнемоническая фраза в окружении');

    const mnemonics = mnemonicPhrase.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonics);

    const workchain = 0;
    return {
        wallet: WalletContractV5R1.create({ workchain, publicKey: keyPair.publicKey }),
        keyPair
    }
}

export const walletService = {
    getAddress: async () => {
        const { wallet } = await getWallet();
        return wallet.address.toString({ bounceable: false })
    },

    sendTransaction: async (params: SenderArguments) => {
        const { wallet, keyPair } = await getWallet();

        const contract = tonCenterClient.open(wallet);
        // await contract.sender(keyPair.secretKey).send(params);

        const seqno = await contract.getSeqno();

        const transfer = await wallet.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [internal(params)],
            sendMode: SendMode.PAY_GAS_SEPARATELY
        });

        await contract.send(transfer);

        return 'transactionHash'
    },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getTransactionHash = async (address: Address, messageHash: string) => {
    // const transactions = await tonCenterClient.getTransactions(address, { limit: 10 });
    // const transaction = transactions.find(tx => {
    //     const inMessageHash = tx.inMessage?.body?.hash().toString('hex');
    //     return inMessageHash === messageHash;
    // });

    // return transaction?.hash.toString();
}