import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FarcasterProfileDisplay } from "./FarcasterProfileDisplay";
import { useFarcasterProfiles } from "../hooks/useFarcasterProfiles";
import { toast } from "sonner";

interface UserProfileFarcasterSectionProps {
  userAddress: string;
}

export const UserProfileFarcasterSection: React.FC<UserProfileFarcasterSectionProps> = ({
  userAddress,
}) => {
  const { address } = useAccount();
  const { getProfile, getProfilesByAddresses } = useFarcasterProfiles();
  const [isLoading, setIsLoading] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  
  // Check if the profile is already linked
  useEffect(() => {
    if (userAddress) {
      console.log("[UserProfileFarcasterSection] Fetching profile for address:", userAddress);
      setIsLoading(true);
      
      getProfilesByAddresses([userAddress]).then(() => {
        const profile = getProfile(userAddress);
        console.log("[UserProfileFarcasterSection] Retrieved profile:", profile);
        
        setIsLinked(!!profile?.fid);
        setIsLoading(false);
      }).catch(error => {
        console.error("[UserProfileFarcasterSection] Error fetching profile:", error);
        setIsLoading(false);
      });
    }
  }, [userAddress, getProfile, getProfilesByAddresses]);
  
  // Function to handle linking Farcaster profile
  const handleLinkFarcaster = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would involve:
      // 1. Signing a message with the user's wallet to prove ownership
      // 2. Verifying the signature on the backend
      // 3. Storing the association between wallet address and Farcaster FID
      
      // For demo purposes, we'll simulate a successful linking
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success("Farcaster profile linked successfully!");
      setIsLinked(true);
    } catch (error) {
      console.error("Error linking Farcaster profile:", error);
      toast.error("Failed to link Farcaster profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Only the owner of the profile can link/unlink
  const isOwner = address === userAddress;
  
  return (
    <Card className="border-2 border-[#13494220] rounded-xl overflow-hidden shadow-sm">
      <CardHeader className="bg-[#13494208] pb-4">
        <CardTitle className="text-lg font-bold text-[#134942]">
          Farcaster Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {isLinked ? (
          <div className="space-y-4">
            <FarcasterProfileDisplay address={userAddress} size="lg" />
            
            {isOwner && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    toast.info("Farcaster profile unlinked");
                    setIsLinked(false);
                  }}
                >
                  Unlink Farcaster Profile
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {isOwner 
                ? "Link your Farcaster profile to enhance your presence in the presale community."
                : "This user hasn't linked their Farcaster profile yet."}
            </p>
            
            {isOwner && (
              <div className="pt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="bg-[#134942] hover:bg-[#0d322d] text-white"
                  onClick={handleLinkFarcaster}
                  disabled={isLoading}
                >
                  {isLoading ? "Linking..." : "Link Farcaster Profile"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
