const { getAddress, isAddress } = require("viem");
const { NeynarAPIClient } = require("@neynar/nodejs-sdk");

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

if (!NEYNAR_API_KEY) {
  console.warn(
    "[FarcasterProfilesUtil] NEYNAR_API_KEY is not set. Profile fetching will be disabled."
  );
}

const neynarClient = NEYNAR_API_KEY
  ? new NeynarAPIClient(NEYNAR_API_KEY)
  : null;

const profileCache = new Map(); // Simple in-memory cache for the lifetime of the function invocation

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
  if (!neynarClient) {
    console.warn("[FarcasterProfilesUtil] Neynar client not initialized.");
    const fallbackProfiles = {};
    addresses.forEach((addr) => {
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

  const validAddresses = addresses.filter(isAddress).map(getAddress);
  const profilesToReturn = {};
  const addressesToFetchFromAPI = [];

  for (const addr of validAddresses) {
    if (profileCache.has(addr)) {
      profilesToReturn[addr] = profileCache.get(addr);
    } else {
      addressesToFetchFromAPI.push(addr);
    }
  }

  if (addressesToFetchFromAPI.length > 0) {
    try {
      const result = await neynarClient.fetchBulkUsersByEthereumAddress(
        addressesToFetchFromAPI
      );

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
    }
  }
  return profilesToReturn;
}

module.exports = { fetchFarcasterProfilesByAddresses };
