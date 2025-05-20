import { useState, useCallback, useEffect, useRef } from "react";
import { getAddress, isAddress } from "viem";

// Farcaster user profile interface
export interface FarcasterUserProfile {
  fid?: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  custodyAddress: string;
}

// Configuration for Neynar API
const NEYNAR_API_KEY = import.meta.env.VITE_NEYNAR_API_KEY || import.meta.env.NEYNAR_API_KEY;
const NEYNAR_API_USER_BULK_BY_ADDRESS_URL = "https://api.neynar.com/v2/farcaster/user/bulk-by-address";

interface NeynarUserV2 {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string | null;
  custody_address: string;
}

interface NeynarBulkUsersResponse {
  [key: string]: NeynarUserV2[];
}

// Cache to store profiles and avoid redundant API calls
const profileCache = new Map<string, FarcasterUserProfile>( );
const inflightRequests = new Set<string>();

/**
 * Fetches Farcaster profiles from Neynar API
 */
async function fetchFarcasterProfilesFromApi(
  addressesToFetch: string[]
): Promise<Record<string, FarcasterUserProfile>> {
  console.log("[API] Fetching Farcaster profiles for addresses:", addressesToFetch);
  
  if (!NEYNAR_API_KEY) {
    console.warn("[API] Neynar API key missing");
    return {};
  }
  
  if (addressesToFetch.length === 0) {
    return {};
  }

  const uniqueNormalizedAddresses = [
    ...new Set(addressesToFetch.map((addr) => getAddress(addr))),
  ];
  const localResults: Record<string, FarcasterUserProfile> = {};
  const CHUNK_SIZE = 50;

  for (let i = 0; i < uniqueNormalizedAddresses.length; i += CHUNK_SIZE) {
    const chunk = uniqueNormalizedAddresses.slice(i, i + CHUNK_SIZE);
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
          `[API] Neynar API error: ${response.status} ${response.statusText}`
        );
        chunk.forEach((addr) => {
          if (!profileCache.has(addr)) {
            profileCache.set(addr, {
              username: null,
              displayName: null,
              pfpUrl: null,
              custodyAddress: addr,
            });
          }
        });
        continue;
      }

      const data = (await response.json()) as NeynarBulkUsersResponse;
      console.log("[API] Received data from Neynar:", data);

      if (data && typeof data === "object" && Object.keys(data).length > 0) {
        Object.entries(data).forEach(
          ([custodyAddrFromResponse, neynarUsersArray]) => {
            if (!isAddress(custodyAddrFromResponse)) {
              console.warn(
                `[API] Invalid address key in response: ${custodyAddrFromResponse}`
              );
              return;
            }
            const normalizedCustodyAddress = getAddress(
              custodyAddrFromResponse
            );

            if (neynarUsersArray && neynarUsersArray.length > 0) {
              const primaryNeynarUser = neynarUsersArray[0];
              console.log("[API] Processing user data:", primaryNeynarUser);
              const userProfile: FarcasterUserProfile = {
                fid: primaryNeynarUser.fid,
                username: primaryNeynarUser.username,
                displayName: primaryNeynarUser.display_name,
                pfpUrl: primaryNeynarUser.pfp_url,
                custodyAddress: normalizedCustodyAddress,
              };
              localResults[normalizedCustodyAddress] = userProfile;
              profileCache.set(normalizedCustodyAddress, userProfile);
            } else {
              if (!profileCache.has(normalizedCustodyAddress)) {
                profileCache.set(normalizedCustodyAddress, {
                  username: null,
                  displayName: null,
                  pfpUrl: null,
                  custodyAddress: normalizedCustodyAddress,
                });
              }
            }
          }
        );
      }

      chunk.forEach((addr) => {
        if (!localResults[addr] && !profileCache.has(addr)) {
          profileCache.set(addr, {
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
            username: null,
            displayName: null,
            pfpUrl: null,
            custodyAddress: addr,
          });
        }
      });
    }
  }
  
  return localResults;
}

/**
 * React hook to fetch and manage Farcaster profiles
 */
export function useFarcasterProfiles() {
  const [profiles, setProfiles] = useState<Record<string, FarcasterUserProfile>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Fetches profiles for multiple addresses
   */
  const getProfilesByAddresses = useCallback(
    async (
      addressesToFetch: string[]
    ): Promise<Record<string, FarcasterUserProfile>> => {
      if (addressesToFetch.length === 0) {
        return {};
      }

      const uniqueNormalizedAddresses = [
        ...new Set(
          addressesToFetch
            .filter((addr) => isAddress(addr))
            .map((addr) => getAddress(addr))
        ),
      ];
      const addressesToActuallyFetch: string[] = [];
      const newProfilesFromCache: Record<string, FarcasterUserProfile> = {};
      let shouldTriggerLoading = false;

      // Check cache first
      for (const addr of uniqueNormalizedAddresses) {
        if (profileCache.has(addr)) {
          newProfilesFromCache[addr] = profileCache.get(addr)!;
        } else if (!inflightRequests.has(addr)) {
          addressesToActuallyFetch.push(addr);
          inflightRequests.add(addr);
          shouldTriggerLoading = true;
        }
      }

      // Update state with cached profiles
      if (Object.keys(newProfilesFromCache).length > 0 && mountedRef.current) {
        setProfiles((prev) => ({ ...prev, ...newProfilesFromCache }));
      }

      // Fetch profiles not in cache
      if (addressesToActuallyFetch.length > 0) {
        if (shouldTriggerLoading && mountedRef.current) {
          setIsLoading(true);
        }

        try {
          const fetchedApiProfiles = await fetchFarcasterProfilesFromApi(
            addressesToActuallyFetch
          );
          if (mountedRef.current) {
            setProfiles((prev) => ({ ...prev, ...fetchedApiProfiles }));
          }
        } catch (error) {
          console.error("[Hook] Error fetching profiles:", error);
        } finally {
          addressesToActuallyFetch.forEach((addr) => {
            inflightRequests.delete(addr);
          });
          if (mountedRef.current && inflightRequests.size === 0) {
            setIsLoading(false);
          }
        }
      } else if (
        Object.keys(newProfilesFromCache).length === uniqueNormalizedAddresses.length
      ) {
        if (mountedRef.current && isLoading) {
          setIsLoading(false);
        }
      }

      // Prepare final results
      const finalResults: Record<string, FarcasterUserProfile> = {};
      uniqueNormalizedAddresses.forEach((addr) => {
        if (profileCache.has(addr)) {
          finalResults[addr] = profileCache.get(addr)!;
        } else {
          finalResults[addr] = {
            username: null,
            displayName: null,
            pfpUrl: null,
            custodyAddress: addr,
          };
        }
      });
      return finalResults;
    },
    [isLoading]
  );

  /**
   * Gets profile for a single address
   */
  const getProfile = useCallback(
    (addressToFetch: string): FarcasterUserProfile | undefined => {
      if (!addressToFetch || !isAddress(addressToFetch)) return undefined;
      const normalizedAddress = getAddress(addressToFetch);
      return profiles[normalizedAddress] || profileCache.get(normalizedAddress);
    },
    [profiles]
  );

  /**
   * Formats a display name for UI
   */
  const getDisplayName = useCallback(
    (address: string): string => {
      if (!address || !isAddress(address)) return "Unknown";
      
      const profile = getProfile(address);
      
      if (profile?.displayName) return profile.displayName;
      if (profile?.username) return profile.username;
      
      // Fallback to shortened address
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },
    [getProfile]
  );

  return {
    profiles,
    getProfilesByAddresses,
    getProfile,
    getDisplayName,
    isLoadingProfiles: isLoading,
  };
}
