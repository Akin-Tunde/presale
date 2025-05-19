// Serverless function for handling presale notifications
const { isAddress, getAddress } = require("viem");
const { v4: uuidv4 } = require("uuid");

// Neynar API configuration
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_API_USER_BULK_BY_ADDRESS_URL = "https://api.neynar.com/v2/farcaster/user/bulk-by-address";
const NEYNAR_API_NOTIFICATIONS_URL = "https://api.neynar.com/v2/farcaster/frame/notifications";

// Cache for Farcaster profiles
const profileCache = new Map();

/**
 * Fetches Farcaster profiles for a list of Ethereum addresses
 */
async function fetchFarcasterProfiles(addresses) {
  if (!NEYNAR_API_KEY) {
    console.warn("[API] Neynar API key missing");
    return {};
  }
  if (!addresses || addresses.length === 0) {
    return {};
  }

  const uniqueAddresses = [...new Set(addresses.map((addr) => getAddress(addr)))];
  const results = {};
  const CHUNK_SIZE = 50;

  uniqueAddresses.forEach((addr) => {
    if (profileCache.has(addr)) {
      results[addr] = profileCache.get(addr);
    }
  });

  const addressesToFetch = uniqueAddresses.filter((addr) => !profileCache.has(addr));
  for (let i = 0; i < addressesToFetch.length; i += CHUNK_SIZE) {
    const chunk = addressesToFetch.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    const addressesParam = chunk.join(",");
    const requestUrl = `${NEYNAR_API_USER_BULK_BY_ADDRESS_URL}?addresses=${addressesParam}`;

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: { api_key: NEYNAR_API_KEY, accept: "application/json" },
      });

      if (!response.ok) {
        console.warn(`[API] Neynar API error: ${response.status} ${response.statusText}`);
        chunk.forEach((addr) => {
          if (!profileCache.has(addr)) {
            profileCache.set(addr, {
              fid: null,
              username: null,
              displayName: null,
              pfpUrl: null,
              custodyAddress: addr,
            });
          }
        });
        continue;
      }

      const data = await response.json();
      Object.entries(data).forEach(([addr, users]) => {
        if (!isAddress(addr)) return;
        const normalizedAddr = getAddress(addr);
        if (users && users.length > 0) {
          const user = users[0];
          const profile = {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            pfpUrl: user.pfp_url,
            custodyAddress: normalizedAddr,
          };
          profileCache.set(normalizedAddr, profile);
          results[normalizedAddr] = profile;
        } else {
          profileCache.set(normalizedAddr, {
            fid: null,
            username: null,
            displayName: null,
            pfpUrl: null,
            custodyAddress: normalizedAddr,
          });
        }
      });

      chunk.forEach((addr) => {
        if (!results[addr] && !profileCache.has(addr)) {
          profileCache.set(addr, {
            fid: null,
            username: null,
            displayName: null,
            pfpUrl: null,
            custodyAddress: addr,
          });
        }
      });
    } catch (error) {
      console.error(`[API] Error fetching profiles for ${addressesParam}:`, error);
      chunk.forEach((addr) => {
        if (!profileCache.has(addr)) {
          profileCache.set(addr, {
            fid: null,
            username: null,
            displayName: null,
            pfpUrl: null,
            custodyAddress: addr,
          });
        }
      });
    }
  }

  return results;
}

/**
 * Gets a display name for a user, falling back to address if needed
 */
function getDisplayName(profile, address) {
  if (profile && (profile.displayName || profile.username)) {
    return profile.displayName || profile.username;
  }
  if (typeof address === "string" && address.length >= 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return "an unknown address";
}

/**
 * Sends a notification via Neynar API
 */
async function sendNeynarNotification(targetFids, notification, filters = {}) {
  if (!NEYNAR_API_KEY) {
    throw new Error("Neynar API key missing");
  }
  if (!targetFids || targetFids.length === 0) {
    console.warn("[API] No target FIDs provided; skipping notification");
    return { success: false, message: "No target FIDs provided" };
  }

  const options = {
    method: "POST",
    headers: {
      "x-api-key": NEYNAR_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_fids: targetFids,
      notification: {
        ...notification,
        uuid: uuidv4(),
      },
      filters,
    }),
  };

  try {
    const response = await fetch(NEYNAR_API_NOTIFICATIONS_URL, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status} ${data.message || "Unknown error"}`);
    }
    console.log(`[API] Notification sent:`, data);
    return { success: true, message: "Notification sent successfully", data };
  } catch (error) {
    console.error("[API] Error sending Neynar notification:", error);
    return {
      success: false,
      message: `Failed to send notification: ${error.message}`,
    };
  }
}

/**
 * Handles notification logic based on category
 */
async function handleNotificationLogic(notificationData) {
  try {
    // Collect all addresses to fetch profiles for
    const addressesToFetch = [];
    
    if (notificationData.creatorAddress && isAddress(notificationData.creatorAddress)) {
      addressesToFetch.push(getAddress(notificationData.creatorAddress));
    }
    
    if (notificationData.contributorAddresses && Array.isArray(notificationData.contributorAddresses)) {
      notificationData.contributorAddresses
        .filter((addr) => isAddress(addr))
        .forEach((addr) => addressesToFetch.push(getAddress(addr)));
    }

    // Fetch profiles for all relevant addresses
    const profiles = await fetchFarcasterProfiles(addressesToFetch);
    
    // Get all FIDs from the system for broadcast notifications
    const allFids = Object.values(profiles)
      .filter(profile => profile.fid)
      .map(profile => profile.fid);

    let targetFids = [];
    let notification = {};
    let filters = {};
    
    // Base URL for presale details
    const presaleUrl = notificationData.presaleAddress
      ? `https://raize-5.netlify.app/presale/${notificationData.presaleAddress}`
      : "https://raize-5.netlify.app";

    switch (notificationData.category) {
      case "presale-created":
        // For presale creation, notify all users
        targetFids = allFids;
        
        // Get creator profile if available
        const creatorProfile = notificationData.creatorAddress ? 
          profiles[getAddress(notificationData.creatorAddress)] : null;
        
        const creatorDisplay = creatorProfile ? 
          (creatorProfile.displayName || creatorProfile.username) : 
          (notificationData.creatorAddress ? 
            `${notificationData.creatorAddress.slice(0, 6)}...${notificationData.creatorAddress.slice(-4)}` : 
            "Someone");
        
        notification = {
          title: "New Presale Available!",
          body: `${creatorDisplay} has created a new presale for ${notificationData.tokenSymbol || "a token"}. Check it out!`,
          target_url: presaleUrl,
        };
        break;

      case "presale-ended":
        // For presale ending, notify contributors
        if (notificationData.contributorAddresses && Array.isArray(notificationData.contributorAddresses)) {
          // Get FIDs for all contributors
          targetFids = notificationData.contributorAddresses
            .filter(addr => isAddress(addr))
            .map(addr => {
              const profile = profiles[getAddress(addr)];
              return profile?.fid;
            })
            .filter(fid => fid);
        }
        
        notification = {
          title: "Presale Ended",
          body: `The presale for ${notificationData.tokenSymbol || "a token"} has ended. Check your contribution status.`,
          target_url: presaleUrl,
        };
        break;

      default:
        throw new Error(`Unsupported notification category: ${notificationData.category}`);
    }

    return await sendNeynarNotification(targetFids, notification, filters);
  } catch (error) {
    console.error(`Error sending ${notificationData.category} notification:`, error);
    return {
      success: false,
      message: `Failed to send notification: ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * Vercel API route handler
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const notificationData = req.body;

  if (!notificationData || typeof notificationData !== "object" || !notificationData.category) {
    return res.status(400).json({
      success: false,
      message: "Invalid request body: Expected a JSON object with a 'category' property.",
    });
  }

  try {
    const result = await handleNotificationLogic(notificationData);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error(`[API Handler] Unhandled error processing ${notificationData.category} notification:`, error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message || "An unknown error occurred."}`,
    });
  }
};
