/**
 * Development fixtures. Used when MINTDATE_MOCK_MODE is on (or credentials are
 * absent in dev). They exercise every UI state: verified, unknown/watching,
 * conflicting, multi-phase, and "date unknown / vague".
 *
 * Dates are expressed relative to "now" so the dashboard's time buckets
 * (minting now / 24h / 7d) always have something to show.
 */

export interface MockPost {
  x_post_id: string;
  text: string;
  daysFromNow: number; // when the post was made (negative = past)
}

export interface MockAccount {
  username: string;
  name: string;
  description: string;
  x_user_id: string;
  posts: MockPost[];
  /** OpenSea slug used by the mock OpenSea client for verification. */
  openseaSlug?: string;
}

function futureDateText(daysAhead: number, hour = 13, tz = "ET"): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${month} ${day}, ${year} at ${h12} ${ampm} ${tz}`;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    username: "ExampleNFT",
    name: "Example NFT",
    description: "A 3,333 piece generative collection on Ethereum.",
    x_user_id: "mock_1001",
    openseaSlug: "example-nft",
    posts: [
      {
        x_post_id: "mock_p_1001_1",
        daysFromNow: -1,
        text: `Public mint goes live ${futureDateText(2, 13)}. 0.08 ETH · 3,333 supply on Ethereum. Mint here: https://mint.example.xyz — verified on OpenSea: https://opensea.io/collection/example-nft`,
      },
      {
        x_post_id: "mock_p_1001_2",
        daysFromNow: -3,
        text: `Allowlist mint ${futureDateText(2, 11)}. Get on the list now! WL spots limited. https://mint.example.xyz`,
      },
      {
        x_post_id: "mock_p_1001_3",
        daysFromNow: -5,
        text: "gm frens. Art reveal was incredible. Thank you for 10k followers 🫡",
      },
    ],
  },
  {
    username: "FutureMint",
    name: "FutureMint Labs",
    description: "Next-gen onchain art. Monad szn.",
    x_user_id: "mock_1002",
    posts: [
      {
        x_post_id: "mock_p_1002_1",
        daysFromNow: 0,
        text: `🔥 MINT IS LIVE NOW! Free claim for holders. Chain: Monad. Claim: https://futuremint.xyz/claim`,
      },
      {
        x_post_id: "mock_p_1002_2",
        daysFromNow: -2,
        text: `Public sale ${futureDateText(0, new Date().getUTCHours(), "UTC")}. Don't miss it. 5,000 supply.`,
      },
    ],
  },
  {
    username: "NoDateProject",
    name: "Mystery Mint",
    description: "Something is coming. 👀",
    x_user_id: "mock_1003",
    posts: [
      {
        x_post_id: "mock_p_1003_1",
        daysFromNow: -1,
        text: "Mint soon. Stay tuned frens. Allowlist details TBA. 👀",
      },
      {
        x_post_id: "mock_p_1003_2",
        daysFromNow: -4,
        text: "We're building. Big things coming this season.",
      },
    ],
  },
  {
    username: "ConflictNFT",
    name: "Conflict Collective",
    description: "Onchain since day one.",
    x_user_id: "mock_1004",
    openseaSlug: "conflict-collective",
    posts: [
      {
        x_post_id: "mock_p_1004_1",
        daysFromNow: -1,
        text: `Public mint ${futureDateText(5, 12)}! 0.05 ETH. See you onchain. https://opensea.io/collection/conflict-collective`,
      },
    ],
  },
];

export function findMockAccount(username: string): MockAccount | undefined {
  const key = username.toLowerCase();
  return MOCK_ACCOUNTS.find((a) => a.username.toLowerCase() === key);
}
