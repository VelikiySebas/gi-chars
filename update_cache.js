const { EnkaClient } = require("enka-network-api");
const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default

enka.cachedAssetsManager.fetchAllContents(); // returns promise
