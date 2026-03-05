import type { NextConfig } from "next";
import { execSync } from "child_process";

let commitHash =
  // Railway provides the full SHA at build time
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Not in a git repo (e.g., Railway build without .git) — keep Railway SHA or "dev"
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: commitHash,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
};

export default nextConfig;
