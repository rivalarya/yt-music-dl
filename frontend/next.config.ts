/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    // Deezer CDN covers
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdns-images.dzcdn.net",
      },
      {
        protocol: "https",
        hostname: "e-cdns-images.dzcdn.net",
      },
    ],
    // Static export requires unoptimized
    unoptimized: true,
  },
  // Wails serves from root, no base path needed
  trailingSlash: true,
};

module.exports = nextConfig;