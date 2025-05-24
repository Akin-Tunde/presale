import React, { useEffect } from "react";
import { useFarcasterProfiles } from "../hooks/useFarcasterProfiles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface FarcasterProfileDisplayProps {
  address: string;
  showBadge?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Component to display Farcaster profile information
 */
export const FarcasterProfileDisplay: React.FC<FarcasterProfileDisplayProps> = ({
  address,
  showBadge = true,
  size = "md",
}) => {
  const { getProfile, getProfilesByAddresses, isLoadingProfiles } = useFarcasterProfiles();
  
  useEffect(() => {
    if (address) {
      console.log("[FarcasterProfileDisplay] Fetching profiles for address:", address);
      getProfilesByAddresses([address]).then(() => {
        const profile = getProfile(address);
        console.log("[FarcasterProfileDisplay] Profile data received:", profile);
      });
    }
  }, [address, getProfilesByAddresses, getProfile]);
  
  const profile = getProfile(address);
  console.log("[FarcasterProfileDisplay] Current profile data:", profile);
  
  // Size classes for avatar
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };
  
  // Get initials for fallback
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.substring(0, 2).toUpperCase();
  };
  
  if (isLoadingProfiles) {
    return (
      <div className="flex items-center gap-2">
        <div className={`${sizeClasses[size]} rounded-full bg-gray-200 animate-pulse`}></div>
        <div className="flex flex-col gap-1">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }
  
  // Ensure we have display text
  const displayText = profile?.displayName || profile?.username || `${address.slice(0, 6)}...${address.slice(-4)}`;
  console.log("[FarcasterProfileDisplay] Display text:", displayText);
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className={`${sizeClasses[size]} border-2 border-[#13494220] shadow-sm`}>
        <AvatarImage
          src={profile?.pfpUrl || undefined}
          alt={`${profile?.displayName || profile?.username || "User"} avatar`}
          className={!profile?.pfpUrl ? "hidden" : "block"}
        />
        <AvatarFallback
          className="bg-[#13494215] text-[#134942] font-bold"
        >
          {getInitials((profile?.displayName || profile?.username || null))}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#134942]">
            {displayText}
          </span>
          
          {showBadge && profile?.username && (
            <Badge 
              className="bg-purple-100 text-purple-800 border-purple-200 text-xs px-1.5 py-0"
            >
              Farcaster
            </Badge>
          )}
        </div>
        
        {profile?.username && (
          <span className="text-xs text-gray-500">
            @{profile.username}
          </span>
        )}
      </div>
    </div>
  );
};
