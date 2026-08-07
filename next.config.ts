import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Word Kingdom uses fixed files from /public. Serving them directly avoids
  // requiring Cloudflare Images bindings during local development.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
