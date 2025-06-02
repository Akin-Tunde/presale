#!/usr/bin/env node
const { getAddress, isAddress } = require("viem");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// --- Environment Variables ---
const SUPABASE_URL = process.env.VITE_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL || "https://raize-taupe.vercel.app";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[Frame Handler] Supabase URL or Anon Key missing. Cannot fetch presale details."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helper Function to Fetch Presale Data ---
// TODO: Implement this function to fetch necessary details for the frame
// (e.g., token symbol, image, status, rate, hard cap) based on the presale address.
// You might fetch from Supabase or directly read from the contract if needed.
async function getPresaleFrameData(presaleAddress) {
  console.log(`[Frame Handler] Fetching data for presale: ${presaleAddress}`);
  if (!supabase) {
    return { error: "Supabase client not initialized." };
  }
  try {
    // Example: Fetching from Supabase (adjust table/columns as needed)
    const { data, error } = await supabase
      .from("presales") // Your presales table name
      .select(
        "token_symbol, image_url, presale_rate, hard_cap, currency_symbol, status_text"
      ) // Select fields needed for the frame
      .eq("presale_address", getAddress(presaleAddress)) // Adjust column name if needed
      .single();

    if (error) {
      console.error(
        `[Frame Handler] Supabase error fetching presale ${presaleAddress}:`,
        error
      );
      return { error: `Presale not found or DB error: ${error.message}` };
    }
    if (!data) {
      return { error: "Presale not found." };
    }

    // TODO: Add logic to fetch current status (e.g., active, ended, success, failed)
    // You might need contract reads or use a status field from Supabase
    const currentStatus = data.status_text || "Upcoming"; // Placeholder

    return {
      tokenSymbol: data.token_symbol || "Token",
      imageUrl: data.image_url || `${APP_URL}/default-presale-image.png`, // Provide a default image
      status: currentStatus,
      // Add more data as needed for frame buttons/text
    };
  } catch (err) {
    console.error(
      `[Frame Handler] Exception fetching presale ${presaleAddress}:`,
      err
    );
    return { error: `Server error fetching presale data: ${err.message}` };
  }
}

// --- Vercel Serverless Function Export ---
module.exports = async (req, res) => {
  try {
    console.log(`[Frame Handler] Received request: ${req.url}`);
    // Extract presale address from the URL
    // This depends on how you set up rewrites in vercel.json
    // Assuming rewrite: { "source": "/presale/:address", "destination": "/api/presale-frame-handler" }
    // The address will be in a query parameter, e.g., req.query.address
    const presaleAddress = req.query.address;

    if (!presaleAddress || !isAddress(presaleAddress)) {
      return res.status(400).send("Invalid or missing presale address");
    }

    // Fetch the base index.html file
    // In Vercel, the built frontend files are usually in the parent directory
    const indexPath = path.resolve(
      process.cwd(),
      ".next/server/pages/index.html"
    ); // Adjust path for Vite/Next.js if needed
    let htmlContent;
    try {
      htmlContent = fs.readFileSync(indexPath, "utf8");
    } catch (fsError) {
      // Fallback path for local dev or different build structures
      const fallbackPath = path.resolve(process.cwd(), "dist/index.html"); // Common path for Vite builds
      try {
        htmlContent = fs.readFileSync(fallbackPath, "utf8");
      } catch (fallbackError) {
        console.error(
          "[Frame Handler] Error reading index.html:",
          fsError,
          fallbackError
        );
        return res.status(500).send("Error reading application template");
      }
    }

    // Fetch dynamic data for the frame
    const frameData = await getPresaleFrameData(presaleAddress);

    if (frameData.error) {
      console.warn(
        `[Frame Handler] Data fetch error for ${presaleAddress}: ${frameData.error}`
      );
      // Optionally, serve default frame tags or just the unmodified HTML
      // For simplicity, we might just serve the base HTML on error
      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(htmlContent);
    }

    // --- Construct Meta Tags --- //
    const pageUrl = `${APP_URL}/presale/${presaleAddress}`;
    const postUrl = `${APP_URL}/api/frame-action-handler`; // TODO: Create this endpoint to handle button clicks

    // TODO: Customize these tags based on fetched frameData and desired frame logic
    const metaTags = `
      <meta property="fc:frame" content="vNext" />
      <meta property="fc:frame:image" content="${frameData.imageUrl}" />
      <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
      <meta property="fc:frame:post_url" content="${postUrl}?address=${presaleAddress}" />

      <meta property="fc:frame:button:1" content="View Presale Details" />
      <meta property="fc:frame:button:1:action" content="link" />
      <meta property="fc:frame:button:1:target" content="${pageUrl}" />

      ${
        frameData.status === "Active"
          ? `
      <meta property="fc:frame:button:2" content="Contribute Now" />
      <meta property="fc:frame:button:2:action" content="link" />
      <meta property="fc:frame:button:2:target" content="${pageUrl}" /> 
      `
          : ""
      }
      ${
        frameData.status === "Success"
          ? `
      <meta property="fc:frame:button:2" content="Claim Tokens" />
      <meta property="fc:frame:button:2:action" content="link" />
      <meta property="fc:frame:button:2:target" content="${pageUrl}" /> 
      `
          : ""
      }
      
      <meta property="og:title" content="${frameData.tokenSymbol} Presale" />
      <meta property="og:description" content="Join the ${
        frameData.tokenSymbol
      } presale! Status: ${frameData.status}" />
      <meta property="og:image" content="${frameData.imageUrl}" />
    `;

    // Inject meta tags into the <head> section
    const modifiedHtml = htmlContent.replace("</head>", `${metaTags}</head>`);

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(modifiedHtml);
  } catch (error) {
    console.error("[Frame Handler] General error:", error);
    return res.status(500).send(`Server error: ${error.message}`);
  }
};
