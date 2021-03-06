"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TokenStorage {
    static storeToken(continuationToken, productId) {
        if (TokenStorage.canStore) {
            TokenStorage.sessionStorage.setItem(TokenStorage.getKeyName(productId), continuationToken);
        }
    }
    static getStoredToken(productId) {
        if (!TokenStorage.canStore) {
            return null;
        }
        return TokenStorage.sessionStorage.getItem(TokenStorage.getKeyName(productId));
    }
    static initialize() {
        if (TokenStorage.canStore) {
            const flag = TokenStorage.sessionStorage.getItem(TokenStorage.initializedFlag);
            // Duplicated tab, cleaning up all stored keys
            if (flag) {
                this.clear();
            }
            TokenStorage.sessionStorage.setItem(TokenStorage.initializedFlag, 'true');
            // When leaving page or refreshing
            TokenStorage.window.addEventListener('unload', () => {
                TokenStorage.sessionStorage.removeItem(TokenStorage.initializedFlag);
            });
        }
    }
    static clear() {
        if (TokenStorage.canStore) {
            let keyToDelete = [];
            for (let i = 0; i < TokenStorage.sessionStorage.length; i++) {
                const key = TokenStorage.sessionStorage.key(i);
                if (key.startsWith(TokenStorage.tokenStoragePrefix)) {
                    keyToDelete.push(key);
                }
            }
            keyToDelete.forEach(key => TokenStorage.sessionStorage.removeItem(key));
            TokenStorage.sessionStorage.removeItem(TokenStorage.initializedFlag);
        }
    }
    static getKeyName(productId) {
        return `${TokenStorage.tokenStoragePrefix}${productId}`;
    }
    static get canStore() {
        return TokenStorage.sessionStorage && TokenStorage.window;
    }
}
TokenStorage.initializedFlag = 'twilio_twilsock_token_storage';
TokenStorage.tokenStoragePrefix = 'twilio_continuation_token_';
try {
  TokenStorage.sessionStorage = global['sessionStorage'];
} catch (error) {
  // Session storage disabled with increased Chrome privacy settings.
}
TokenStorage.window = global['window'];
exports.TokenStorage = TokenStorage;
TokenStorage.initialize();
