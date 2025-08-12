import encryptedStorage from 'react-native-encrypted-storage';

async function storeSecureData(key, value) {
    try {
        await encryptedStorage.setItem(key, JSON.stringify(value));
        console.log(`Data stored securely under key: ${key}`);
    } catch (error) {
        console.error(`Error storing data under key ${key}:`, error);
    }
}

async function getSecureData(key) {
    try {
        const value = await encryptedStorage.getItem(key);
        console.log(`Data retrieved securely under key: ${key}`);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error(`Error retrieving data under key ${key}:`, error);
    }
}

async function removeSecureData(key) {
    try {
        await encryptedStorage.removeItem(key);
        console.log(`Data removed securely under key: ${key}`);
    } catch (error) {
        console.error(`Error removing data under key ${key}:`, error);
    }
}

export default {
    storeSecureData,
    getSecureData,
    removeSecureData
};
