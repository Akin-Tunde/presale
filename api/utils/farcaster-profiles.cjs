const { getAddress, isAddress } = require("viem");
const { NeynarAPIClient, Configuration } = require("@neynar/nodejs-sdk");

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_EXPERIMENTAL_ENABLED =
  process.env.NEYNAR_EXPERIMENTAL_ENABLED === "true";

let neynarClient = null;

if (!NEYNAR_API_KEY) {
  console.warn(
    "[FarcasterProfilesUtil] NEYNAR_API_KEY is not set. Profile fetching will be disabled."
  );
} else {
  try {
    const configOptions = {
      apiKey: NEYNAR_API_KEY,
    };

    // Conditionally add baseOptions for experimental features if enabled
    if (NEYNAR_EXPERIMENTAL_ENABLED) {
      configOptions.baseOptions = {
        headers: {
          "x-neynar-experimental": true,
        },
      };
    }

    const neynarConfig = new Configuration(configOptions);
    neynarClient = new NeynarAPIClient(neynarConfig);
    console.log(
      "[FarcasterProfilesUtil] Neynar client initialized successfully."
    );
  } catch (error) {
    console.error(
      "[FarcasterProfilesUtil] Failed to initialize Neynar client:",
      error
    );
    // neynarClient remains null, and the functions will handle this.
  }
}

const profileCache = new Map();

/**
 * @typedef {object} FarcasterUserProfile
 * @property {number} [fid]
 * @property {string|null} username
 * @property {string|null} displayName
 * @property {string|null} pfpUrl
 * @property {string} custodyAddress
 */

/**
 * Fetches Farcaster profiles for a list of Ethereum addresses.
 * @param {string[]} addresses - An array of Ethereum addresses.
 * @returns {Promise<Record<string, FarcasterUserProfile>>} A map of addresses to profiles.
 */
async function fetchFarcasterProfilesByAddresses(addresses) {
  const validAddresses = (addresses || []).filter(isAddress).map(getAddress);

  if (!neynarClient || validAddresses.length === 0) {
    const fallbackProfiles = {};
    validAddresses.forEach((addr) => {
      const normalizedAddr = getAddress(addr);
      fallbackProfiles[normalizedAddr] = {
        custodyAddress: normalizedAddr,
        username: null,
        displayName: null,
        pfpUrl: null,
      };
    });
    return fallbackProfiles;
  }

  const profilesToReturn = {};
  const addressesToFetchFromAPI = [];

  // Populate from cache or identify addresses to fetch
  for (const addr of validAddresses) {
    if (profileCache.has(addr)) {
      profilesToReturn[addr] = profileCache.get(addr);
    } else {
      addressesToFetchFromAPI.push(addr);
    }
  }

  // Fetch from Neynar API if there are any addresses not in cache
  if (addressesToFetchFromAPI.length > 0) {
    try {
      const result = await neynarClient.fetchBulkUsersByEthOrSolAddress({
        addresses: addressesToFetchFromAPI,
        // You can also pass viewerFid here if needed, e.g., viewerFid: someFid,
      });

      Object.entries(result).forEach(([address, users]) => {
        const normalizedAddr = getAddress(address);
        if (users && users.length > 0) {
          const user = users[0];
          const profile = {
            fid: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfpUrl: user.pfpUrl,
            custodyAddress: normalizedAddr,
          };
          profilesToReturn[normalizedAddr] = profile;
          profileCache.set(normalizedAddr, profile);
        }
      });
    } catch (error) {
      console.error(
        "[FarcasterProfilesUtil] Error fetching profiles from Neynar:",
        error
      );
      // Ensure fallback profiles are created for addresses that were attempted in the failed API call
      addressesToFetchFromAPI.forEach((addr) => {
        const normalizedAddr = getAddress(addr); // Normalize for consistent keying
        if (!profilesToReturn[normalizedAddr]) {
          profilesToReturn[normalizedAddr] = {
            custodyAddress: normalizedAddr,
            username: null,
            displayName: null,
            pfpUrl: null,
          };
        }
      });
    }
  }

  validAddresses.forEach((addr) => {
    if (!profilesToReturn[addr]) {
      // addr is already normalized from the start of the function
      profilesToReturn[addr] = {
        custodyAddress: addr,
        username: null,
        displayName: null,
        pfpUrl: null,
      };
    }
  });
  return profilesToReturn;
}

module.exports = { fetchFarcasterProfilesByAddresses };
