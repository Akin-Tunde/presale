// vestingLogger.ts - A non-intrusive logging module for vesting functionality

/**
 * This module provides logging functions for vesting operations without modifying
 * the original UserProfilePage.tsx code. Import this file and call the setup function
 * to enable logging.
 */

import { type Address } from 'viem';

// Original vesting contract functions we want to monitor
const MONITORED_FUNCTIONS = [
  'schedules',
  'remainingVested',
  'release',
  'vestedAmount'
];

// Store original fetch function
let originalFetch: typeof window.fetch;

// Log styling
const styles = {
  title: 'color: #8e44ad; font-weight: bold; font-size: 12px;',
  label: 'color: #3498db; font-weight: bold;',
  value: 'color: #2ecc71;',
  error: 'color: #e74c3c; font-weight: bold;',
  warning: 'color: #f39c12; font-weight: bold;',
  info: 'color: #7f8c8d;'
};

/**
 * Setup vesting logging by intercepting API calls
 */
export function setupVestingLogging() {
  console.log('%c[Vesting Logger] Initializing vesting logging...', styles.title);
  
  // Store original fetch
  originalFetch = window.fetch;
  
  // Override fetch to intercept vesting-related API calls
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    // Only intercept POST requests to API endpoints
    if (
      typeof input === 'string' && 
      (input.includes('/api/readContract') || 
       input.includes('/api/readContracts') || 
       input.includes('/api/writeContract'))
    ) {
      try {
        // Clone the request body to inspect it
        const body = init?.body ? JSON.parse(init.body.toString()) : null;
        
        // Check if this is a vesting-related call
        if (body && isVestingRelated(body)) {
          console.group('%c[Vesting Logger] Vesting API Call Detected', styles.title);
          console.log('%cEndpoint:', styles.label, input);
          console.log('%cRequest Body:', styles.label, body);
          
          // Log specific vesting parameters
          logVestingParams(body);
          
          // Make the original request
          const response = await originalFetch(input, init);
          
          // Clone the response to log it without consuming it
          const clonedResponse = response.clone();
          const responseData = await clonedResponse.json();
          
          console.log('%cResponse:', styles.label, responseData);
          console.groupEnd();
          
          return response;
        }
      } catch (error) {
        console.log('%c[Vesting Logger] Error intercepting request:', styles.error, error);
      }
    }
    
    // Pass through to original fetch for non-vesting calls
    return originalFetch(input, init);
  };
  
  // Also monitor vesting state changes
  monitorVestingStateChanges();

  // Expose simulation function globally for easy console access
  (window as any).simulateVestingLog = simulateVestingLog;
  
  console.log('%c[Vesting Logger] Vesting logging initialized successfully', styles.title);
}

/**
 * Check if an API call is vesting-related
 */
function isVestingRelated(body: any): boolean {
  // Check for direct vesting contract calls
  if (body.functionName && MONITORED_FUNCTIONS.includes(body.functionName)) {
    return true;
  }
  
  // Check for batch calls that might include vesting functions
  if (body.contracts && Array.isArray(body.contracts)) {
    return body.contracts.some((contract: any) => 
      contract.functionName && MONITORED_FUNCTIONS.includes(contract.functionName)
    );
  }
  
  return false;
}

/**
 * Log vesting-specific parameters
 */
function logVestingParams(body: any) {
  // For single contract call
  if (body.functionName && body.args) {
    console.group('%cVesting Parameters:', styles.label);
    
    if (body.functionName === 'schedules' || body.functionName === 'remainingVested' || body.functionName === 'vestedAmount') {
      console.log('%cPresale Address:', styles.label, body.args[0]);
      console.log('%cUser Address:', styles.label, body.args[1]);
    } else if (body.functionName === 'release') {
      console.log('%cPresale Address:', styles.label, body.args[0]);
    }
    
    console.groupEnd();
  }
  
  // For batch contract calls
  if (body.contracts && Array.isArray(body.contracts)) {
    body.contracts.forEach((contract: any, index: number) => {
      if (contract.functionName && MONITORED_FUNCTIONS.includes(contract.functionName)) {
        console.group(`%cVesting Call #${index + 1}:`, styles.label);
        console.log('%cFunction:', styles.value, contract.functionName);
        
        if (contract.args) {
          if (contract.functionName === 'schedules' || contract.functionName === 'remainingVested' || contract.functionName === 'vestedAmount') {
            console.log('%cPresale Address:', styles.label, contract.args[0]);
            console.log('%cUser Address:', styles.label, contract.args[1]);
          } else if (contract.functionName === 'release') {
            console.log('%cPresale Address:', styles.label, contract.args[0]);
          }
        }
        
        console.groupEnd();
      }
    });
  }
}

/**
 * Monitor vesting state changes by intercepting setState calls
 */
function monitorVestingStateChanges() {
  // This is a more advanced technique that would require React DevTools integration
  // For simplicity, we'll just add a note about checking React state in DevTools
  console.log(
    '%c[Vesting Logger] %cTo monitor vesting state changes, use React DevTools to inspect the "vestingSchedules" state in UserProfilePage component',
    styles.title,
    styles.info
  );
}

/**
 * Helper function to log vesting schedule details
 */
export function logVestingSchedule(schedule: any) {
  console.group('%c[Vesting Logger] Vesting Schedule Details', styles.title);
  console.log('%cPresale Address:', styles.label, schedule.presaleAddress);
  console.log('%cToken Address:', styles.label, schedule.tokenAddress);
  console.log('%cToken Symbol:', styles.label, schedule.tokenSymbol);
  console.log('%cTotal Amount:', styles.label, schedule.totalAmount?.toString());
  console.log('%cReleased Amount:', styles.label, schedule.releasedAmount?.toString());
  console.log('%cClaimable Amount:', styles.label, schedule.claimableAmount?.toString());
  console.log('%cProgress:', styles.label, `${schedule.progressPercentage}%`);
  console.log('%cStart Time:', styles.label, new Date(Number(schedule.startTime) * 1000).toLocaleString());
  console.log('%cEnd Time:', styles.label, new Date(Number(schedule.endTime) * 1000).toLocaleString());
  console.groupEnd();
}

/**
 * Helper function to log vesting claim attempts
 */
export function logVestingClaim(presaleAddress: Address) {
  console.group('%c[Vesting Logger] Vesting Claim Attempt', styles.title);
  console.log('%cPresale Address:', styles.label, presaleAddress);
  console.log('%cTimestamp:', styles.label, new Date().toLocaleString());
  console.groupEnd();
}

/**
 * Cleanup function to restore original fetch
 */
export function cleanupVestingLogging() {
  if (originalFetch) {
    window.fetch = originalFetch;
    console.log('%c[Vesting Logger] Vesting logging disabled', styles.title);
  }
  // Remove simulation function if cleanup is called
  if ((window as any).simulateVestingLog) {
    delete (window as any).simulateVestingLog;
  }
}

/**
 * NEW: Simulation function to demonstrate logging output
 */
export function simulateVestingLog(presaleAddress: Address, userAddress: Address, functionName: string = 'schedules') {
  if (!MONITORED_FUNCTIONS.includes(functionName)) {
    console.log(`%c[Vesting Logger Simulation] Function '${functionName}' is not one of the monitored functions.`, styles.warning);
    return;
  }

  // Simulate the API endpoint and request body
  const simulatedEndpoint = '/api/readContract'; // Or writeContract for 'release'
  let simulatedBody: any;
  let simulatedResponse: any;

  if (functionName === 'release') {
    simulatedBody = {
      address: '0xVestingContractAddress', // Replace with actual vesting contract address if known
      abi: '[...]', // ABI snippet would go here
      functionName: 'release',
      args: [presaleAddress]
    };
    simulatedResponse = { data: '0xTransactionHashExample' }; // Simulate a transaction hash
  } else {
    simulatedBody = {
      address: '0xVestingContractAddress', // Replace with actual vesting contract address if known
      abi: '[...]', // ABI snippet would go here
      functionName: functionName,
      args: [presaleAddress, userAddress]
    };
    // Simulate a plausible response structure based on function
    if (functionName === 'schedules') {
      simulatedResponse = { data: { tokenAddress: '0xToken...', totalAmount: '1000000000000000000000', released: '0', start: '1700000000', duration: '31536000', exists: true } };
    } else if (functionName === 'remainingVested' || functionName === 'vestedAmount') {
      simulatedResponse = { data: '500000000000000000000' }; // Simulate some amount
    }
  }

  console.group('%c[Vesting Logger Simulation] Simulated API Call Detected', styles.title);
  console.log('%cEndpoint:', styles.label, simulatedEndpoint);
  console.log('%cRequest Body:', styles.label, simulatedBody);
  
  // Log specific vesting parameters using the existing function
  logVestingParams(simulatedBody);
  
  console.log('%cResponse:', styles.label, simulatedResponse);
  console.groupEnd();
}

// Optional: Expose globally if not done in setupVestingLogging (e.g., if logger isn't initialized)
// if (typeof window !== 'undefined') {
//   (window as any).simulateVestingLog = simulateVestingLog;
// }

