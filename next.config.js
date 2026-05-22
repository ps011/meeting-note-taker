/** @type {import('next').NextConfig} */
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true'

const nextConfig = {
  output: 'export',
  ...(isGitHubPagesBuild ? { basePath: '/meeting-note-taker' } : {}),
  trailingSlash: true,
  images: { unoptimized: true },
}
module.exports = nextConfig
