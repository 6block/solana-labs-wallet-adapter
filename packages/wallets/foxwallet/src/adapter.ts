import type { WalletName } from '@solana/wallet-adapter-base';
import {
    BaseMessageSignerWalletAdapter,
    scopePollingDetectionStrategy,
    WalletAccountError,
    WalletDisconnectionError,
    WalletNotConnectedError,
    WalletNotReadyError,
    WalletPublicKeyError,
    WalletReadyState,
    WalletSignTransactionError,
} from '@solana/wallet-adapter-base';
import type { Transaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

interface FoxWalletWallet {
    isFoxWallet?: boolean;
    isConnected: boolean;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getAccount(): Promise<string>;
    signTransaction(transaction: Transaction): Promise<Transaction>;
    signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
    signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
}

interface FoxWalletWindow extends Window {
    foxwallet?: {
        solana?: FoxWalletWallet;
    };
}

declare const window: FoxWalletWindow;

export interface FoxWalletWalletAdapterConfig {}

export const FoxWalletWalletName = 'FoxWallet' as WalletName<'FoxWallet'>;

export class FoxWalletWalletAdapter extends BaseMessageSignerWalletAdapter {
    name = FoxWalletWalletName;
    url = 'https://foxwallet.com';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTAwIiBoZWlnaHQ9IjkwMCIgdmlld0JveD0iMCAwIDkwMCA5MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI5MDAiIGhlaWdodD0iOTAwIiByeD0iNDUwIiBmaWxsPSJibGFjayIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTU3Ny4yNDkgMjE1Ljk3NUM1MzkuOTU2IDE5Ni4yMzIgNTExLjY0NiAxNjEuNTQ5IDUwMC40NjggMTE5Ljg2OEM0OTcuMDIxIDEzMi42MTMgNDk1LjI0NSAxNDUuOTg0IDQ5NS4yNDUgMTU5Ljc3NEM0OTUuMjQ1IDE3MC41MzMgNDk2LjM5NCAxODAuOTggNDk4LjQ4MyAxOTEuMTEzQzQ5OC40ODMgMTkxLjExMyA0OTguNDgzIDE5MS4xMTMgNDk4LjQ4MyAxOTEuMjE3QzQ5OC40ODMgMTkxLjMyMiA0OTguNTg4IDE5MS41MzEgNDk4LjU4OCAxOTEuNjM1QzUwMS40MDggMjA1LjIxNiA1MDYuMDA1IDIxOC4wNjUgNTEyLjE2OCAyMjkuOTc0QzQ5OS4wMDYgMjIwLjI1OCA0ODcuMzA2IDIwOC42NjMgNDc3LjQ4NiAxOTUuNjA1QzQ2NC4zMjMgMjk3LjY2NyA1MDEuNDA4IDQwMy45MDcgNTY5LjIwNiA0NzMuODk4QzY1Ny42ODcgNTc2LjkgNTc2LjEgNzUxLjY2OSA0MzguMjA3IDc0Ny4wNzNDMjQzLjA2OCA3NDguNzQ0IDIwOS42MzkgNDYxLjM2MiAzOTYuODM5IDQxNi4yMzRMMzk2LjczNSA0MTUuNzExQzQ0Ni42NjkgMzk5LjUxOSA0NzAuMDY5IDM2Ny4wMzEgNDc0LjE0MyAzMjQuODI3QzQwMi4wNjMgMzgzLjIyMyAyODguMTk2IDMxMC44MjkgMzExLjgwNSAyMjAuMTU0QzQxLjI0MjUgMzUzLjM0NiAxNDEuNzM3IDc4NS40MTEgNDQ4LjQ0NSA3ODAuMDgzQzU4Mi4wNTUgNzgwLjA4MyA2OTUuMDg1IDY5MS43MDYgNzMyLjE3IDU3MC4yMTRDNzc2LjQ2MyA0MjguNTYxIDcwNC44IDI3Ny42MDkgNTc3LjI0OSAyMTUuOTc1WiIgZmlsbD0iIzEyRkU3NCIvPgo8L3N2Zz4K';
    readonly supportedTransactionVersions = null;

    private _connecting: boolean;
    private _wallet: FoxWalletWallet | null;
    private _publicKey: PublicKey | null;
    private _readyState: WalletReadyState =
        typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.NotDetected;

    constructor(config: FoxWalletWalletAdapterConfig = {}) {
        super();
        this._connecting = false;
        this._wallet = null;
        this._publicKey = null;

        if (this._readyState !== WalletReadyState.Unsupported) {
            scopePollingDetectionStrategy(() => {
                if (window.foxwallet?.solana?.isFoxWallet) {
                    this._readyState = WalletReadyState.Installed;
                    this.emit('readyStateChange', this._readyState);
                    return true;
                }
                return false;
            });
        }
    }

    get publicKey() {
        return this._publicKey;
    }

    get connecting() {
        return this._connecting;
    }

    get connected() {
        return !!this._wallet?.isConnected;
    }

    get readyState() {
        return this._readyState;
    }

    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) return;
            if (this._readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();

            this._connecting = true;

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const wallet = window.foxwallet!.solana!;

            let account: string;
            try {
                account = await wallet.getAccount();
            } catch (error: any) {
                throw new WalletAccountError(error?.message, error);
            }

            let publicKey: PublicKey;
            try {
                publicKey = new PublicKey(account);
            } catch (error: any) {
                throw new WalletPublicKeyError(error?.message, error);
            }

            this._wallet = wallet;
            this._publicKey = publicKey;

            this.emit('connect', publicKey);
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        const wallet = this._wallet;
        if (wallet) {
            this._wallet = null;
            this._publicKey = null;

            try {
                await wallet.disconnect();
            } catch (error: any) {
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }

        this.emit('disconnect');
    }

    async signTransaction<T extends Transaction>(transaction: T): Promise<T> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                return ((await wallet.signTransaction(transaction)) as T) || transaction;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signAllTransactions<T extends Transaction>(transactions: T[]): Promise<T[]> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                return ((await wallet.signAllTransactions(transactions)) as T[]) || transactions;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                const { signature } = await wallet.signMessage(message);
                return signature;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }
}
