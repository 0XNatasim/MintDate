/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "abs.twimg.com" },
      { protocol: "https", hostname: "i.seadn.io" },
      { protocol: "https", hostname: "**.seadn.io" },
    ],
  },
};

export default nextConfig;
