import dotenv from 'dotenv';
dotenv.config();

export const configService = {
    tonApiKey: process.env.TON_API_TOKEN?.trim(),
    tonCenterApiKey: process.env.TON_CENTER_API_TOKEN?.trim(),
    mnemonic: process.env.MNEMONIC?.trim(),
}