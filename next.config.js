/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["images.ctfassets.net"],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": __dirname,
      "@/components": `${__dirname}/components`,
    };
    return config;
  },
};

module.exports = nextConfig;
