#!/usr/bin/env node
const { isAddress, getAddress, formatEther } = require("viem");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

// --- Environment Variables ---
// Ensure these are set in your Vercel/serverless environment
const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY; // Use non-prefixed for backend

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase URL or Anon Key is missing in environment variables."
  );
}
if (!NEYNAR_API_KEY) {
  console.warn(
    "[API] NEYNAR_API_KEY environment variable is not set. Notifications will not be sent."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NEYNAR_API_USER_BULK_BY_ADDRESS_URL =
  "https://api.neynar.com/v2/farcaster/user/bulk-by-address";
const NEYNAR_API_NOTIFICATIONS_URL =
  "https://api.neynar.com/v2/farcaster/frame/notifications";

// Simple in-memory cache for Farcaster profiles (consider a more persistent cache for production)
const profileCache = new Map();

// --- Helper Functions () ---

async function fetchFarcasterProfiles(addresses) {
  if (!NEYNAR_API_KEY) return {}; // Don't attempt if key is missing
  if (!addresses || addresses.length === 0) return {};

  const uniqueAddresses = [
    ...new Set(
      addresses
        .filter((addr) => isAddress(addr))
        .map((addr) => getAddress(addr))
    ),
  ];
  const results = {};
  const CHUNK_SIZE = 50;

  // Check cache first
  uniqueAddresses.forEach((addr) => {
    if (profileCache.has(addr)) results[addr] = profileCache.get(addr);
  });

  const addressesToFetch = uniqueAddresses.filter(
    (addr) => !profileCache.has(addr)
  );

  if (addressesToFetch.length === 0) return results; // Return cached results if all found

  console.log(
    `[API] Fetching profiles for ${addressesToFetch.length} addresses from Neynar...`
  );

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
        console.warn(
          `[API] Neynar API error fetching profiles: ${response.status}`
        );
        // Add placeholders to cache to avoid refetching failed addresses immediately
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
      // Process successful response
      Object.entries(data).forEach(([addr, users]) => {
        if (!isAddress(addr)) return;
        const normalizedAddr = getAddress(addr);
        if (users && users.length > 0) {
          const user = users[0]; // Assuming the first user is the primary one
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
          // Cache miss even after API call
          if (!profileCache.has(normalizedAddr)) {
            profileCache.set(normalizedAddr, {
              fid: null,
              username: null,
              displayName: null,
              pfpUrl: null,
              custodyAddress: normalizedAddr,
            });
          }
        }
      });
    } catch (error) {
      console.error(`[API] Error fetching profiles chunk:`, error);
      // Add placeholders on network error
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
  // Add placeholders for any remaining addresses that weren't in the response or cache
  addressesToFetch.forEach((addr) => {
    if (!results[addr] && !profileCache.has(addr)) {
      profileCache.set(addr, {
        fid: null,
        username: null,
        displayName: null,
        pfpUrl: null,
        custodyAddress: addr,
      });
      results[addr] = profileCache.get(addr);
    }
  });

  return results;
}

function getDisplayName(profile, address) {
  if (!address || !isAddress(address)) return "unknown address";
  const normalizedAddress = getAddress(address);
  const cachedProfile = profile || profileCache.get(normalizedAddress);

  if (cachedProfile && (cachedProfile.displayName || cachedProfile.username)) {
    return cachedProfile.displayName || cachedProfile.username;
  }
  // Fallback to shortened address
  return `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
}

async function sendNeynarNotification(targetFids, notification) {
  if (!NEYNAR_API_KEY) {
    console.warn("[API] Cannot send notification: Neynar API key missing.");
    return { success: false, message: "Neynar API key missing" };
  }
  if (!targetFids || targetFids.length === 0) {
    console.warn("[API] No target FIDs provided for notification.");
    return { success: false, message: "No target FIDs provided" };
  }

  const uniqueFids = [...new Set(targetFids)].filter((fid) => fid != null);
  if (uniqueFids.length === 0) {
    console.warn("[API] No valid, non-null FIDs provided for notification.");
    return { success: false, message: "No valid FIDs provided" };
  }

  const options = {
    method: "POST",
    headers: {
      api_key: NEYNAR_API_KEY, // Correct header key for Neynar v2
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      notifications: [
        {
          type: "custom_cast_mention", // Or another relevant type
          text: notification.body, // Use body for the main text
          mentioned_fids: uniqueFids, // Target users via mentions
          // Optional: Add embeds if needed
          // embeds: notification.target_url ? [{ url: notification.target_url }] : [],
        },
      ],
      // --- Vercel Frame Notification Payload (Alternative) ---
      // target_fids: uniqueFids,
      // notification: {
      //   ...notification,
      //   uuid: uuidv4(), // Generate unique ID for the notification
      // },
    }),
  };

  console.log(`[API] Sending notification to FIDs: ${uniqueFids.join(", ")}`);
  console.log(`[API] Notification body: ${notification.body}`);

  try {
    // Using a generic mention notification type as custom frame notifications might be restricted
    const response = await fetch(
      "https://api.neynar.com/v2/farcaster/cast",
      options
    );
    const data = await response.json();

    if (!response.ok) {
      console.error(
        `[API] Neynar API error sending notification: ${response.status}`,
        data
      );
      throw new Error(
        `Neynar API error: ${response.status} - ${
          data.message || "Unknown error"
        }`
      );
    }
    console.log("[API] Neynar notification response:", data);
    return {
      success: true,
      message: "Notification sent successfully via cast mention",
      data,
    };
  } catch (error) {
    console.error("[API] Error sending Neynar notification:", error);
    return {
      success: false,
      message: `Failed to send notification: ${error.message}`,
    };
  }
}

// --- Main Handler Logic ---
async function handleNotificationLogic(notificationData) {
  console.log("[API] Received notification request:", notificationData);
  try {
    const { category } = notificationData;
    if (!category) throw new Error("Missing notification category");

    // --- Address Fetching ---
    const addressesToFetch = new Set();
    if (
      notificationData.creatorAddress &&
      isAddress(notificationData.creatorAddress)
    ) {
      addressesToFetch.add(getAddress(notificationData.creatorAddress));
    }
    if (
      notificationData.contributorAddress &&
      isAddress(notificationData.contributorAddress)
    ) {
      addressesToFetch.add(getAddress(notificationData.contributorAddress));
    }
    if (
      notificationData.claimerAddress &&
      isAddress(notificationData.claimerAddress)
    ) {
      addressesToFetch.add(getAddress(notificationData.claimerAddress));
    }
    // Add other relevant addresses based on category if needed

    const profiles = await fetchFarcasterProfiles(Array.from(addressesToFetch));
    console.log("[API] Fetched profiles:", profiles);

    // --- Notification Construction ---
    let targetFids = [];
    let notification = {};
    const presaleUrl = notificationData.presaleAddress
      ? // TODO: Replace with actual frontend URL structure
        `${process.env.APP_URL || "http://localhost:5173"}/presale/${
          notificationData.presaleAddress
        }`
      : process.env.APP_URL || "http://localhost:5173";

    const tokenSymbol = notificationData.tokenSymbol || "Token";

    switch (category) {
      case "presale-created":
        if (
          !notificationData.creatorAddress ||
          !isAddress(notificationData.creatorAddress)
        ) {
          throw new Error("Valid creatorAddress required for presale-created");
        }
        const creatorProfile =
          profiles[getAddress(notificationData.creatorAddress)];
        const creatorDisplay = getDisplayName(
          creatorProfile,
          notificationData.creatorAddress
        );
        // Notify the creator themselves, or potentially followers/channel later
        if (creatorProfile?.fid) targetFids = [creatorProfile.fid];
        notification = {
          title: `Presale Created: ${tokenSymbol}! `, // Title might not be used in cast mention
          body: `${creatorDisplay} created a new presale for ${tokenSymbol}! Rate: ${
            notificationData.presaleRate || "N/A"
          }, Hard Cap: ${
            notificationData.hardCap || "N/A"
          }. Check it out: ${presaleUrl}`,
          target_url: presaleUrl,
        };
        break;

      case "presale-joined":
        if (
          !notificationData.contributorAddress ||
          !isAddress(notificationData.contributorAddress)
        ) {
          throw new Error(
            "Valid contributorAddress required for presale-joined"
          );
        }
        if (
          !notificationData.creatorAddress ||
          !isAddress(notificationData.creatorAddress)
        ) {
          console.warn(
            "[API] Creator address missing for presale-joined notification, cannot notify creator."
          );
        }
        const contributorProfile =
          profiles[getAddress(notificationData.contributorAddress)];
        const contributorDisplay = getDisplayName(
          contributorProfile,
          notificationData.contributorAddress
        );
        const creatorForJoinProfile = notificationData.creatorAddress
          ? profiles[getAddress(notificationData.creatorAddress)]
          : null;

        // Notify the contributor and the creator (if their FIDs are found)
        targetFids = [
          ...(contributorProfile?.fid ? [contributorProfile.fid] : []),
          ...(creatorForJoinProfile?.fid ? [creatorForJoinProfile.fid] : []),
        ];
        notification = {
          title: `New Contribution to ${tokenSymbol} Presale! 🙌`, // Title might not be used
          body: `${contributorDisplay} just contributed ${
            notificationData.contributionAmount || "N/A"
          } ${
            notificationData.currencySymbol || "currency"
          } to the ${tokenSymbol} presale! Presale: ${presaleUrl}`,
          target_url: presaleUrl,
        };
        break;

      case "presale-claimed":
        if (
          !notificationData.claimerAddress ||
          !isAddress(notificationData.claimerAddress)
        ) {
          throw new Error("Valid claimerAddress required for presale-claimed");
        }
        if (
          !notificationData.creatorAddress ||
          !isAddress(notificationData.creatorAddress)
        ) {
          console.warn(
            "[API] Creator address missing for presale-claimed notification, cannot notify creator."
          );
        }
        const claimerProfile =
          profiles[getAddress(notificationData.claimerAddress)];
        const claimerDisplay = getDisplayName(
          claimerProfile,
          notificationData.claimerAddress
        );
        const creatorForClaimProfile = notificationData.creatorAddress
          ? profiles[getAddress(notificationData.creatorAddress)]
          : null;

        // Notify the claimer and the creator
        targetFids = [
          ...(claimerProfile?.fid ? [claimerProfile.fid] : []),
          ...(creatorForClaimProfile?.fid ? [creatorForClaimProfile.fid] : []),
        ];
        notification = {
          title: `Tokens Claimed from ${tokenSymbol} Presale! 🏆`, // Title might not be used
          body: `${claimerDisplay} claimed ${
            notificationData.claimedAmount || "their"
          } ${tokenSymbol} tokens from the presale! Presale: ${presaleUrl}`,
          target_url: presaleUrl,
        };
        break;

      // Add cases for 'presale-finalized', 'presale-cancelled' if needed

      default:
        throw new Error(`Unsupported notification category: ${category}`);
    }

    // --- Send Notification --- //
    if (targetFids.length > 0) {
      return await sendNeynarNotification(targetFids, notification);
    } else {
      console.warn(
        `[API] No target FIDs found for category ${category}, notification not sent.`
      );
      return {
        success: true,
        message: "No target FIDs found, notification not sent.",
      }; // Considered success as no error occurred
    }
  } catch (error) {
    console.error(
      `[API] Error processing notification (${
        notificationData.category || "unknown"
      }):`,
      error
    );
    return {
      success: false,
      message: `Failed to process notification: ${error.message}`,
    };
  }
}

// --- Vercel Serverless Function Export --- //
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const notificationData = req.body;
  if (!notificationData || typeof notificationData !== "object") {
    return res.status(400).json({
      success: false,
      message: "Invalid request: Expected JSON body",
    });
  }

  try {
    // Add creator address if available in the payload (needed for some notifications)
    // This assumes the frontend might not always include it, but it's needed for context
    if (notificationData.presaleAddress && !notificationData.creatorAddress) {
      // Attempt to fetch creator from Supabase if missing - adjust table/column names as needed
      console.log(
        `[API] Fetching creator for presale: ${notificationData.presaleAddress}`
      );
      const { data: presaleInfo, error: dbError } = await supabase
        .from("presales") // Adjust table name if different
        .select("creator")
        .eq("presale_address", getAddress(notificationData.presaleAddress)) // Adjust column name if different
        .single();

      if (dbError) {
        console.warn(
          `[API] Supabase error fetching creator: ${dbError.message}`
        );
      } else if (presaleInfo?.creator && isAddress(presaleInfo.creator)) {
        notificationData.creatorAddress = presaleInfo.creator;
        console.log(
          `[API] Found creator address: ${notificationData.creatorAddress}`
        );
      } else {
        console.warn(
          `[API] Creator address not found in DB for presale: ${notificationData.presaleAddress}`
        );
      }
    }

    const result = await handleNotificationLogic(notificationData);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    console.error(`[API] Top-level error processing notification:`, error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
    });
  }
};
