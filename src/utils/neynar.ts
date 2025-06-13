//neynar.ts

export const sendWelcomeNotification = async (
  fid: number
): Promise<boolean> => {
  try {
    const response = await fetch("/api/send-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetFids: [fid],
        category: "welcome",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Notification sent to FID ${fid}:`, data);
    return data.success;
  } catch (error) {
    console.error(`Error sending notification to FID ${fid}:`, error);
    return false;
  }
};
