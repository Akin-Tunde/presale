import React from "react";
import { useFarcasterUser } from "../hooks/useFarcasterUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface FarcasterProfileSDKDisplayProps {
  address: string;
  showBadge?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Component to display Farcaster profile information using Frame SDK approach
 */
export const FarcasterProfileSDKDisplay: React.FC<FarcasterProfileSDKDisplayProps> = ({
  address,
  showBadge = true,
  size = "md",
}) => {
  const { farcasterUser, loading } = useFarcasterUser(address);
  
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
  
  if (loading) {
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
  const displayText = farcasterUser?.name || (typeof address === 'string' && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown Address');
 
  
  return (
    <div className="flex items-center gap-2">
      <Avatar className={`${sizeClasses[size]} border-2 border-[#13494220] shadow-sm`}>
        <AvatarImage
          src={farcasterUser?.pfpUrl || undefined}
          alt={`${farcasterUser?.name || "User"} avatar`}
          className={!farcasterUser?.pfpUrl ? "hidden" : "block"}
        />
        <AvatarFallback
          className="bg-[#13494215] text-[#134942] font-bold"
        >
          {getInitials(farcasterUser?.name || null)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[#134942]">
            {displayText}
          </span>
          
          {showBadge && farcasterUser?.fid && (
            <Badge 
              className="bg-purple-100 text-purple-800 border-purple-200 text-xs px-1.5 py-0"
            >
              Farcaster
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};
