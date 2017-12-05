class Account {
    /**
     * @param {Account} o
     * @returns {Account}
     */
    static copy(o) {
        if (!o) return o;
        return new BasicAccount(Balance.copy(o._balance));
    }

    /**
     * @param {Account.Type} type
     * @param {Balance} balance
     */
    constructor(type, balance) {
        if (!NumberUtils.isUint8(type)) throw new Error('Malformed type');
        if (!balance || !(balance instanceof Balance)) throw new Error('Malformed balance');

        /** @type {Account.Type} */
        this._type = type;
        /** @type {Balance} */
        this._balance = balance;
    }

    /**
     * Create Account object from binary form.
     * @param {SerialBuffer} buf Buffer to read from.
     * @return {Account} Newly created Account object.
     */
    static unserialize(buf) {
        const type = /** @type {Account.Type} */ buf.readUint8();
        buf.readPos--;

        if (!Account.TYPE_MAP.has(type)) {
            throw new Error('Unknown account type');
        }

        return Account.TYPE_MAP.get(type).unserialize(buf);
    }

    /**
     * Serialize this Account object into binary form.
     * @param {?SerialBuffer} buf Buffer to write to.
     * @return {SerialBuffer} Buffer from `buf` or newly generated one.
     */
    serialize(buf) {
        buf = buf || new SerialBuffer(this.serializedSize);
        buf.writeUint8(Account.Type.BASIC);
        this._balance.serialize(buf);
        return buf;
    }

    /**
     * @return {number}
     */
    get serializedSize() {
        return /*type*/ 1
            + this._balance.serializedSize;
    }

    /**
     * Check if two Accounts are the same.
     * @param {Account} o Object to compare with.
     * @return {boolean} Set if both objects describe the same data.
     */
    equals(o) {
        return o instanceof Account
            && this._type === o._type
            && this._balance.equals(o.balance);
    }

    toString() {
        return `Account{type=${this._type}, balance=${this._balance.toString()}`;
    }

    /**
     * @return {Balance} Account balance
     */
    get balance() {
        return this._balance;
    }

    /** @type {Account.Type} */
    get type() {
        return this._type;
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    verifyOutgoingTransactionValidity(transaction) { throw new Error('Not yet implemented.'); }

    /**
     * @param {Array.<Transaction>} transactions
     * @param {number} blockHeight
     * @param {boolean} silent
     * @return {Promise.<boolean>}
     */
    verifyOutgoingTransactionSet(transactions, blockHeight, silent = false) {
        if (transactions.length === 0) return Promise.resolve(true);
        const tx = transactions[0];
        if (this._balance.nonce !== tx.nonce) {
            if (!silent) Log.w(Account, 'Rejected transaction - insufficient funds', tx);
            return Promise.resolve(false);
        }
        if (this._balance.value < tx.value + tx.fee) {
            if (!silent) Log.w(Account, 'Rejected transaction - invalid nonce', tx);
            return Promise.resolve(false);
        }
        return this.withOutgoingTransaction(tx, blockHeight).verifyOutgoingTransactionSet(transactions.slice(1), blockHeight);
    }

    /**
     * @param {Transaction} transaction
     * @return {Promise.<boolean>}
     */
    verifyIncomingTransactionValidity(transaction) { throw new Error('Not yet implemented.'); }

    /**
     * @param {Balance} balance
     * @return {Account|*}
     */
    withBalance(balance) { throw new Error('Not yet implemented.'); }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account|*}
     */
    withOutgoingTransaction(transaction, blockHeight, revert = false) {
        let newBalance;
        if (!revert) {
            const newValue = this._balance.value - transaction.value - transaction.fee;
            if (newValue < 0) {
                throw new Error('Balance Error!');
            }
            if (transaction.nonce !== this._balance.nonce) {
                throw new Error('Nonce Error!');
            }
            newBalance = new Balance(newValue, this._balance.nonce + 1);
        } else {
            if (transaction.nonce !== this._balance.nonce - 1) {
                throw new Error('Nonce Error!');
            }
            newBalance = new Balance(this._balance.value + transaction.value + transaction.fee, this._balance.nonce - 1);
        }
        return this.withBalance(newBalance);
    }

    /**
     * @param {Transaction} transaction
     * @param {number} blockHeight
     * @param {boolean} [revert]
     * @return {Account}
     */
    withIncomingTransaction(transaction, blockHeight, revert = false) {
        let newBalance;
        if (!revert) {
            newBalance = new Balance(this._balance.value + transaction.value, this._balance.nonce);
        } else {
            const newValue = this._balance.value - transaction.value;
            if (newValue < 0) {
                throw new Error('Balance Error!');
            }
            newBalance = new Balance(newValue, this._balance.nonce);
        }
        return this.withBalance(newBalance);
    }
}

/**
 * Enum for Account types.
 * @enum {number}
 */
Account.Type = {
    BASIC: 0
};
/**
 * @type {Map.<Account.Type, {INITIAL: Account, unserialize: function(SerialBuffer):Account}>}
 */
Account.TYPE_MAP = new Map();

Class.register(Account);
