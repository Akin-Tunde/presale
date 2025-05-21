import { useState, useEffect } from "react";
import { useFarcasterProfiles } from "./useFarcasterProfiles";
import { sdk } from "@farcaster/frame-sdk";

/**
 * Hook to get Farcaster user profile using Frame SDK approach
 * Similar to the implementation in MyDropsPage from FireBallDrop
 */
export function useFarcasterUser(address?: string) {
  const [farcasterUser, setFarcasterUser] = useState<{
    name: string | null;
    pfpUrl: string | null;
    fid?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Also use the API-based approach as fallback
  const { getProfile, getProfilesByAddresses } = useFarcasterProfiles();
  
  useEffect(() => {
    const fetchFarcasterUser = async () => {
      setLoading(true);
      try {
        // First try Frame SDK if in mini-app context
        try {
          const isMiniApp = await sdk.isInMiniApp();
          if (isMiniApp) {
            const context = await sdk.context;
            if (context && context.user) {
              const user = context.user;
              const nameToDisplay = user.displayName || user.username || "User";
              console.log("[SDK] Found Farcaster user via SDK:", nameToDisplay);
              setFarcasterUser({
                name: nameToDisplay,
                pfpUrl: user.pfpUrl || null,
                fid: user.fid
              });
              setLoading(false);
              return;
            }
          }
        } catch (sdkError) {
          console.warn("[SDK] Error accessing Farcaster SDK:", sdkError);
          // Continue to API fallback
        }
        
        // Fall back to API-based approach if address is provided
        if (address) {
          console.log("[SDK] Falling back to API for address:", address);
          await getProfilesByAddresses([address]);
          const apiProfile = getProfile(address);
          
          if (apiProfile) {
            console.log("[SDK] Found profile via API:", apiProfile);
            setFarcasterUser({
              name: apiProfile.displayName || apiProfile.username || null,
              pfpUrl: apiProfile.pfpUrl,
              fid: apiProfile.fid
            });
          } else {
            console.log("[SDK] No profile found via API for address:", address);
            setFarcasterUser(null);
          }
        }
      } catch (err) {
        console.error("[SDK] Error fetching Farcaster profile:", err);
        setFarcasterUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFarcasterUser();
  }, [address, getProfile, getProfilesByAddresses]);
  
  return { farcasterUser, loading };
}
