/** @type {import('next').NextConfig} */
const nextConfig = {
  // `@repo/core` ships TypeScript sources rather than a build artifact so that
  // the client and the server share one copy of the scoring rules. Next has to
  // be told to compile it.
  transpilePackages: ["@repo/core"],
};

export default nextConfig;
