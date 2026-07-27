import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "sot-lms.vercel.app" }],
        destination: "https://schooloftransformation.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
