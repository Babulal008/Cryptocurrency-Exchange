/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // This enables static export
  trailingSlash: true, // Optional but useful for clean URLs
};

module.exports = nextConfig;
