#!/usr/bin/env node
const {
  getAddress,
  isAddress,
  createPublicClient,
  http,
  formatUnits,
} = require("viem");
const { sepolia } = require("viem/chains");
const fs = require("fs");
const path = require("path");
const satori = require("satori").default;
const sharp = require("sharp");
const { put: vercelBlobPut } = require("@vercel/blob");

const {
  fetchFarcasterProfilesByAddresses,
} = require("./utils/farcaster-profiles.cjs");
const { getPresaleImageHtml } = require("./utils/satori-templates.cjs");

// --- Environment Variables ---
const CHAIN_RPC_URL = process.env.VITE_SEPOLIA_RPC_URL;
const PRESALE_FACTORY_ADDRESS = process.env.VITE_PRESALE_FACTORY_ADDRESS;
const APP_URL = process.env.APP_URL || "https://raize-taupe.vercel.app";
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const DEFAULT_FALLBACK_IMAGE_URL = `${APP_URL}/logo.png`;

// --- ABI Imports (ensure paths are correct) ---
let PRESALE_ABI_MODULE;
let ERC20_ABI_MODULE;
let PRESALE_FACTORY_ABI_MODULE;

async function ensureModulesLoaded() {
  if (!PRESALE_ABI_MODULE)
    PRESALE_ABI_MODULE = await import("../src/abis/cjs/PresaleABI.cjs");
  if (!ERC20_ABI_MODULE)
    ERC20_ABI_MODULE = await import("../src/abis/cjs/Erc20ABI.cjs");
  if (!PRESALE_FACTORY_ABI_MODULE)
    PRESALE_FACTORY_ABI_MODULE = await import(
      "../src/abis/cjs/PresaleFactoryABI.cjs"
    );
}

let publicClient;
function getServerConfig() {
  if (!CHAIN_RPC_URL || !PRESALE_FACTORY_ADDRESS || !BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Missing required environment variables for image generation."
    );
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(CHAIN_RPC_URL),
    });
  }
  return { publicClient };
}

async function getFontData(fontPath) {
  const resolvedFontPath = path.resolve(
    process.cwd(),
    fontPath.startsWith("/") ? fontPath.substring(1) : fontPath
  );
  if (fs.existsSync(resolvedFontPath)) {
    return fs.readFileSync(resolvedFontPath);
  }
  // Fallback for trying to fetch if it's a URL (less ideal for serverless cold starts)
  try {
    const response = await fetch(
      fontPath.startsWith("http") ? fontPath : `${APP_URL}/${fontPath}`
    );
    if (!response.ok)
      throw new Error(`Failed to fetch font: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    console.error(`Failed to load font ${fontPath}: ${e.message}`);
    // Fallback to a system font or handle error
    return null; // Satori might use a default system font if data is null/undefined
  }
}

module.exports = async (req, res) => {
  try {
    await ensureModulesLoaded();
    const { publicClient: client } = getServerConfig();

    // Robustly access ABI arrays, accounting for potential 'default' export
    const presaleAbiModuleResolved =
      PRESALE_ABI_MODULE.default || PRESALE_ABI_MODULE;
    const erc20AbiModuleResolved = ERC20_ABI_MODULE.default || ERC20_ABI_MODULE;
    const presaleFactoryAbiModuleResolved =
      PRESALE_FACTORY_ABI_MODULE.default || PRESALE_FACTORY_ABI_MODULE;

    const { PRESALE_ABI } = presaleAbiModuleResolved;
    const { ERC20_MINIMAL_ABI } = erc20AbiModuleResolved;
    const { PRESALE_FACTORY_ABI } = presaleFactoryAbiModuleResolved;

    if (!PRESALE_ABI || !ERC20_MINIMAL_ABI || !PRESALE_FACTORY_ABI) {
      console.error(
        "[GenerateImage] Critical: One or more ABIs failed to load correctly.",
        { PRESALE_ABI_MODULE, ERC20_ABI_MODULE, PRESALE_FACTORY_ABI_MODULE }
      );
      throw new Error(
        "ABI loading failed for image generation. Check module exports and paths."
      );
    }

    const presaleAddress = req.query.address;
    if (!presaleAddress || !isAddress(presaleAddress)) {
      return res.status(400).json({
        error: "Invalid or missing presale address",
        imageUrl: DEFAULT_FALLBACK_IMAGE_URL,
      });
    }

    // --- Fetch Presale Data (Simplified from frame-handler, adapt as needed) ---
    const presaleOptions = await client.readContract({
      address: getAddress(PRESALE_FACTORY_ADDRESS),
      abi: PRESALE_FACTORY_ABI,
      functionName: "getPresaleOptionsByAddress",
      args: [getAddress(presaleAddress)],
    });

    const creatorAddress = await client.readContract({
      address: getAddress(presaleAddress),
      abi: PRESALE_ABI,
      functionName: "owner",
    });
    const tokenAddress = await client.readContract({
      address: getAddress(presaleAddress),
      abi: PRESALE_ABI,
      functionName: "token",
    });
    const totalRaised = await client.readContract({
      address: getAddress(presaleAddress),
      abi: PRESALE_ABI,
      functionName: "totalRaised",
    });

    const {
      currency: currencyAddress,
      hardCap,
      presaleRate: rate,
    } = presaleOptions;

    const tokenSymbol = await client.readContract({
      address: tokenAddress,
      abi: ERC20_MINIMAL_ABI,
      functionName: "symbol",
    });
    const tokenDecimals = await client.readContract({
      address: tokenAddress,
      abi: ERC20_MINIMAL_ABI,
      functionName: "decimals",
    });

    let currencySymbol = "ETH";
    let currencyDecimals = 18;
    if (currencyAddress !== "0x0000000000000000000000000000000000000000") {
      currencySymbol = await client.readContract({
        address: currencyAddress,
        abi: ERC20_MINIMAL_ABI,
        functionName: "symbol",
      });
      currencyDecimals = await client.readContract({
        address: currencyAddress,
        abi: ERC20_MINIMAL_ABI,
        functionName: "decimals",
      });
    }

    const progressPercent =
      (Number(formatUnits(totalRaised, currencyDecimals)) /
        Number(formatUnits(hardCap, currencyDecimals))) *
      100;

    // --- Fetch Farcaster Profiles ---
    const creatorProfileData = await fetchFarcasterProfilesByAddresses([
      creatorAddress,
    ]);
    const creatorProfile = creatorProfileData[getAddress(creatorAddress)] || {
      username: null,
      pfpUrl: null,
    };

    const contributorAddresses = await client.readContract({
      address: getAddress(presaleAddress),
      abi: PRESALE_ABI,
      functionName: "getContributors",
    });
    const selectedContributorAddresses = contributorAddresses.slice(0, 3); // First 3 for now
    const contributorProfilesData = await fetchFarcasterProfilesByAddresses(
      selectedContributorAddresses
    );
    const contributorsForImage = selectedContributorAddresses.map(
      (addr) =>
        contributorProfilesData[getAddress(addr)] || {
          username: "anon",
          pfpUrl: null,
          custodyAddress: addr,
        }
    );

    // --- Prepare Data for Satori ---
    const imageData = {
      creatorUsername: creatorProfile.username,
      creatorPfpUrl: creatorProfile.pfpUrl,
      tokenSymbol,
      progressPercent: Math.min(100, progressPercent), // Cap at 100%
      totalRaisedFormatted: parseFloat(
        formatUnits(totalRaised, currencyDecimals)
      ).toFixed(2),
      hardCapFormatted: parseFloat(
        formatUnits(hardCap, currencyDecimals)
      ).toFixed(2),
      currencySymbol,
      contributors: contributorsForImage,
    };

    const html = getPresaleImageHtml(imageData);

    // --- Load Fonts for Satori ---
    // Ensure these fonts are in your /public/fonts directory or adjust paths
    const interRegularFont = await getFontData("fonts/Inter-Regular.ttf");
    const interBoldFont = await getFontData("fonts/Inter-Bold.ttf");

    if (!interRegularFont || !interBoldFont) {
      console.error("Required fonts could not be loaded.");
      return res.status(500).json({
        error: "Font loading failed",
        imageUrl: DEFAULT_FALLBACK_IMAGE_URL,
      });
    }

    // --- Generate SVG with Satori ---
    const svg = await satori(
      // If 'html' is an HTML string, use dangerouslySetInnerHTML
      // to ensure Satori parses and renders it as HTML elements.
      {
        type: "div",
        props: {
          style: { display: "flex", width: "100%", height: "100%" }, // Ensure the root div takes full space
          dangerouslySetInnerHTML: { __html: html },
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Inter",
            data: interRegularFont,
            weight: 400,
            style: "normal",
          },
          { name: "Inter", data: interBoldFont, weight: 700, style: "normal" },
          // Add Poppins if used in template
        ],
      }
    );

    // --- Convert SVG to PNG with Sharp ---
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    // --- Upload to Vercel Blob ---
    const blobFilename = `presale-images/${presaleAddress}-${Date.now()}.png`;
    const blob = await vercelBlobPut(blobFilename, pngBuffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false, // We added a timestamp
      cacheControlMaxAge: 60 * 60 * 24 * 7, // Cache for 7 days
    });

    console.log(
      `[GenerateImage] Successfully generated and uploaded image: ${blob.url}`
    );
    return res.status(200).json({ imageUrl: blob.url });
  } catch (error) {
    console.error("[GenerateImage] Error:", error);
    return res.status(500).json({
      error: `Image generation failed: ${error.message}`,
      imageUrl: DEFAULT_FALLBACK_IMAGE_URL,
    });
  }
};

// Helper to parse the HTML string into a Satori-compatible element structure
// This is a very basic parser. For complex HTML, a proper library might be needed.
// However, Satori's satori-html package does this automatically if you pass HTML string directly.
// For this example, we'll assume satori is called with the object structure.
// If using satori-html, you can pass the HTML string directly to it.

// The `satori` function expects a React-like element structure, not a raw HTML string.
// The simplest way to use raw HTML is with `satori-html` or by manually constructing the object.
// For this example, I'm wrapping the HTML string in a basic object structure that Satori expects.
// The `html` variable in the satori call should be:
// { type: 'div', props: { dangerouslySetInnerHTML: { __html: htmlStringFromTemplate }, style: { display: 'flex', width: '100%', height: '100%' } } }
// Or, more robustly, parse the HTML into Satori's expected VNode structure.
// For simplicity in this example, I'll adjust the satori call to reflect it expects an element.
// The `getPresaleImageHtml` should return the content for the *main* div, and satori wraps it.
