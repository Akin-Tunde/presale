import { sdk } from "@farcaster/frame-sdk";
import { sendWelcomeNotification } from "./neynar";
import { createClient } from "@supabase/supabase-js";
import { isAddress } from "viem";

export interface AuthUser {
  fid: number;
  username?: string;
  hasAddedApp?: boolean;
  hasEnabledNotifications?: boolean;
}

let currentUser: AuthUser | null = null;
const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL!,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY!
);

async function saveFrameUser(fid: number, address: string) {
  if (!isAddress(address)) {
    console.warn("Invalid address provided:", address);
    return;
  }
  try {
    const { error } = await supabase
      .from("frame_users")
      .upsert({ fid, address }, { onConflict: "fid" });

    if (error) {
      console.error("Supabase error saving frame user:", error);
    } else {
      console.log("Frame user saved to Supabase:", fid, address);
    }
  } catch (error) {
    console.error("Error saving frame user to Supabase:", error);
  }
}

export async function promptAddFrameAndNotifications(
  userAddress: string
): Promise<{
  added: boolean;
}> {
  try {
    console.log("Fetching context...");
    const context = await sdk.context;
    const isAlreadyAdded = context?.client?.added || false;
    if (isAlreadyAdded) {
      console.log("App already added");
      return { added: true };
    }

    console.log("Adding frame...");
    await sdk.actions.addFrame();
    const updatedContext = await sdk.context;
    const isAdded = updatedContext?.client?.added || false;

    if (isAdded && updatedContext?.user?.fid) {
      console.log(
        "Saving user and sending notification to FID:",
        updatedContext.user.fid
      );
      if (userAddress) {
        await saveFrameUser(updatedContext.user.fid, userAddress);
      }
      await sendWelcomeNotification(updatedContext.user.fid);
    } else {
      console.log("No FID or app not added");
    }

    if (currentUser) {
      currentUser.hasAddedApp = isAdded;
      currentUser.hasEnabledNotifications =
        !!updatedContext?.client?.notificationDetails;
    }

    return { added: isAdded };
  } catch (error) {
    console.error("Error in promptAddFrameAndNotifications:", error);
    return { added: false };
  }
}

export async function signIn(userAddress: string): Promise<AuthUser | null> {
  try {
    console.log("Signing in...");
    const nonce = Math.random().toString(36).substring(2, 15);
    await sdk.actions.signIn({ nonce });
    const context = await sdk.context;

    if (!context || !context.user || !context.user.fid) {
      console.error("Missing user data");
      return null;
    }

    const authUser: AuthUser = {
      fid: context.user.fid,
      username: context.user.username || "unknown",
      hasAddedApp: context.client?.added || false,
      hasEnabledNotifications: !!context.client?.notificationDetails,
    };

    // Only save user if they haven't added the frame yet
    if (userAddress && !authUser.hasAddedApp) {
      await saveFrameUser(authUser.fid, userAddress);
    }

    currentUser = authUser;
    console.log("Auth user:", authUser);
    return authUser;
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}
