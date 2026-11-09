import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ['pdfjs-dist', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/export/exam': ['./.office-runtime/*','./node_modules/pdfjs-dist/**/*','./node_modules/@napi-rs/canvas*/**/*'],
    '/api/template/process': ['./node_modules/pdfjs-dist/**/*','./node_modules/@napi-rs/canvas*/**/*'],
  },
};

export default nextConfig;
