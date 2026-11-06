import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: { '/api/export/exam': ['./.office-runtime/*'] },
};

export default nextConfig;
