import { toast } from "sonner";

export interface NotificationPayload {
  fid?: number;
  title: string;
  body: string;
  targetUrl: string;
  imageUrl?: string;
  category: "presale-created" | "presale-ended";
  presaleAddress?: string;
  tokenSymbol?: string;
  creatorAddress?: string;
  contributorAddresses?: string[];
}

/**
 * Sends a notification request to the backend API
 * @param payload Notification data to be sent
 */
export async function sendPresaleNotification(
  payload: NotificationPayload
): Promise<void> {
  console.log(
    `[Notification Service] Requesting to send notification via backend:`,
    {
      category: payload.category,
      title: payload.title,
      body: payload.body,
      targetUrl: payload.targetUrl,
    }
  );

  const backendApiUrl = "/api/send-notification";

  try {
    const response = await fetch(backendApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // Attempt to parse response body regardless of status
    let responseBody;
    try {
      responseBody = await response.json();
    } catch (e) {
      // If JSON parsing fails, maybe it's plain text or empty
      responseBody = {
        message: (await response.text()) || response.statusText,
      };
    }

    if (!response.ok) {
      const errorMessage = `Failed to send notification. Status: ${
        response.status
      }. Details: ${responseBody.message || JSON.stringify(responseBody)}`;
      console.error("[Notification Service]", errorMessage, responseBody);

      // Show a toast for backend errors
      toast.error(`Notification failed. Status: ${response.status}`);
      return;
    }

    // If response is OK (status 200-299)
    console.log(
      "[Notification Service] Backend response to notification request:",
      JSON.stringify(responseBody, null, 2)
    );

    // Show success toast
    toast.success(`Notification sent successfully`);
  } catch (error) {
    console.error(
      "[Notification Service] Client-side error making request to backend:",
      error
    );
    // Show a toast for network/client-side errors
    toast.error(`Failed to send notification request.`);
  }
}

/**
 * Sends a notification when a new presale is created
 */
export async function notifyPresaleCreated(
  presaleAddress: string,
  tokenSymbol: string,
  creatorAddress: string,
  totalSupply: string,
  endDate: string
): Promise<void> {
  const appUrl = "https://raize-taupe.vercel.app";
  const targetUrl = `${appUrl}/presale/${presaleAddress}`;

  const payload: NotificationPayload = {
    category: "presale-created",
    title: "New Presale Available!",
    body: `A new presale for ${tokenSymbol} has been created. Total supply: ${totalSupply}, ends on ${endDate}.`,
    targetUrl,
    presaleAddress,
    tokenSymbol,
    creatorAddress,
  };

  await sendPresaleNotification(payload);
}

/**
 * Sends a notification when a presale ends
 */
export async function notifyPresaleEnded(
  presaleAddress: string,
  tokenSymbol: string,
  contributorAddresses: string[]
): Promise<void> {
  const appUrl = "https://raize-taupe.vercel.app";
  const targetUrl = `${appUrl}/presale/${presaleAddress}`;

  const payload: NotificationPayload = {
    category: "presale-ended",
    title: "Presale Ended",
    body: `The presale for ${tokenSymbol} has ended.`,
    targetUrl,
    presaleAddress,
    tokenSymbol,
    contributorAddresses,
  };

  await sendPresaleNotification(payload);
}
