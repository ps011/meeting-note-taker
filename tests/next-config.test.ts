import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const requireConfig = createRequire(import.meta.url)
const configPath = requireConfig.resolve('../next.config.js')
const originalGitHubActions = process.env.GITHUB_ACTIONS

function loadConfig() {
  delete requireConfig.cache[configPath]
  return requireConfig(configPath) as { basePath?: string }
}

afterEach(() => {
  if (originalGitHubActions === undefined) {
    delete process.env.GITHUB_ACTIONS
  } else {
    process.env.GITHUB_ACTIONS = originalGitHubActions
  }
  delete requireConfig.cache[configPath]
})

describe('next config basePath', () => {
  it('does not set a basePath outside GitHub Actions so / serves the app locally', () => {
    delete process.env.GITHUB_ACTIONS

    expect(loadConfig().basePath).toBeUndefined()
  })

  it('sets the GitHub Pages basePath in GitHub Actions builds', () => {
    process.env.GITHUB_ACTIONS = 'true'

    expect(loadConfig().basePath).toBe('/meeting-note-taker')
  })
})
