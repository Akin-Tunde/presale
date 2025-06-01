// Type definitions for the /api/send-notification endpoint

/**
 * Describes the expected JSON body for POST requests to /api/send-notification.
 * Ensure the frontend sends a payload matching this structure.
 */
export interface NotificationPayload {
  /** The type of event triggering the notification. */
  category: 'presale-created' | 'presale-joined' | 'presale-claimed' | string; // Allow other potential future categories

  /** The address of the presale contract. */
  presaleAddress: `0x${string}`;

  /** The transaction hash associated with the event. */
  transactionHash: `0x${string}`;

  /** The symbol of the token involved in the presale (e.g., "MYTKN"). */
  tokenSymbol?: string;

  // --- Category-specific fields (conditionally required based on category) ---

  /** The address of the user who created the presale (required for 'presale-created'). */
  creatorAddress?: `0x${string}`;

  /** The address of the user who contributed (required for 'presale-joined'). */
  contributorAddress?: `0x${string}`;

  /** The address of the user who claimed tokens (required for 'presale-claimed'). */
  claimerAddress?: `0x${string}`;

  /** The amount contributed (used in 'presale-joined' notification text). */
  contributionAmount?: string | number;

  /** The symbol of the currency used for contribution (e.g., "ETH", "USDC"). */
  currencySymbol?: string;

  /** The amount of tokens claimed (used in 'presale-claimed' notification text). */
  claimedAmount?: string | number;

  /** The presale rate (optional, used in 'presale-created' notification text). */
  presaleRate?: string | number;

  /** The hard cap of the presale (optional, used in 'presale-created' notification text). */
  hardCap?: string | number;

  // Add any other relevant fields the frontend might send for context
}

/**
 * Describes the potential JSON response structure from the /api/send-notification endpoint.
 */
export interface NotificationResponse {
  /** Indicates whether the notification was processed successfully by the backend. */
  success: boolean;

  /** A message describing the outcome (e.g., "Notification sent successfully", "Failed to process notification: ..."). */
  message: string;

  /** Optional field for additional data returned by the backend (e.g., Neynar API response). */
  data?: any;
}

// Note: This file describes the API interface (request/response shapes).
// It doesn't represent a directly importable function unless the backend
// is refactored into a callable TypeScript module.

