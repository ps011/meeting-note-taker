/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/meeting-note-taker',
  trailingSlash: true,
  images: { unoptimized: true },
}
module.exports = nextConfig
