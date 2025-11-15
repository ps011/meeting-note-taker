#!/usr/bin/env node

/**
 * Script to automatically update CHANGELOG.md with commits since the last release
 * Categorizes commits based on conventional commit format
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

// Get the last tag
function getLastTag() {
  try {
    const tags = execSync('git tag --sort=-creatordate', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((tag) => tag.match(/^v?\d+\.\d+\.\d+$/));
    return tags[0] || null;
  } catch (error) {
    return null;
  }
}

// Get commits since last tag
function getCommitsSinceTag(tag) {
  try {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    const commits = execSync(
      `git log ${range} --pretty=format:"%h|%s|%an|%ad" --date=short --no-merges`,
      { encoding: 'utf8' }
    ).trim();

    if (!commits) return [];

    return commits.split('\n').map((line) => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date };
    });
  } catch (error) {
    return [];
  }
}

// Categorize commits based on conventional commit format
function categorizeCommits(commits) {
  const categories = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
    Security: [],
    Other: [],
  };

  commits.forEach((commit) => {
    const { subject } = commit;
    const match = subject.match(
      /^(feat|fix|perf|refactor|docs|style|test|chore|revert|security)(\(.+\))?: (.+)/i
    );

    if (match) {
      const type = match[1].toLowerCase();
      const message = match[3];

      if (type === 'feat' || type === 'feature') {
        categories.Added.push({ ...commit, message });
      } else if (type === 'fix' || type === 'bugfix') {
        categories.Fixed.push({ ...commit, message });
      } else if (type === 'security') {
        categories.Security.push({ ...commit, message });
      } else if (type === 'perf' || type === 'refactor') {
        categories.Changed.push({ ...commit, message });
      } else if (type === 'remove' || type === 'removed') {
        categories.Removed.push({ ...commit, message });
      } else {
        categories.Other.push({ ...commit, message });
      }
    } else {
      // Try to infer category from subject
      const lowerSubject = subject.toLowerCase();
      if (
        lowerSubject.includes('add') ||
        lowerSubject.includes('new') ||
        lowerSubject.includes('implement')
      ) {
        categories.Added.push({ ...commit, message: subject });
      } else if (
        lowerSubject.includes('fix') ||
        lowerSubject.includes('bug') ||
        lowerSubject.includes('error')
      ) {
        categories.Fixed.push({ ...commit, message: subject });
      } else if (
        lowerSubject.includes('remove') ||
        lowerSubject.includes('delete')
      ) {
        categories.Removed.push({ ...commit, message: subject });
      } else if (
        lowerSubject.includes('update') ||
        lowerSubject.includes('change') ||
        lowerSubject.includes('improve')
      ) {
        categories.Changed.push({ ...commit, message: subject });
      } else {
        categories.Other.push({ ...commit, message: subject });
      }
    }
  });

  return categories;
}

// Format changelog entry
function formatChangelogEntry(version, date, categories) {
  let entry = `## [${version}] - ${date}\n\n`;

  const hasChanges = Object.values(categories).some(
    (items) => items.length > 0
  );

  if (!hasChanges) {
    entry += '### Changed\n';
    entry += '- No significant changes\n\n';
    return entry;
  }

  if (categories.Added.length > 0) {
    entry += '### Added\n';
    categories.Added.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  if (categories.Changed.length > 0) {
    entry += '### Changed\n';
    categories.Changed.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  if (categories.Fixed.length > 0) {
    entry += '### Fixed\n';
    categories.Fixed.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  if (categories.Removed.length > 0) {
    entry += '### Removed\n';
    categories.Removed.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  if (categories.Security.length > 0) {
    entry += '### Security\n';
    categories.Security.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  if (categories.Other.length > 0) {
    entry += '### Other\n';
    categories.Other.forEach((item) => {
      entry += `- ${item.message}\n`;
    });
    entry += '\n';
  }

  return entry;
}

// Update changelog
function updateChangelog(version, date) {
  const lastTag = getLastTag();
  const commits = getCommitsSinceTag(lastTag);
  const categories = categorizeCommits(commits);
  const newEntry = formatChangelogEntry(version, date, categories);

  let changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');

  // Insert new entry after the header (after line 6 or after "## [")
  const headerEnd = changelog.indexOf('## [');
  if (headerEnd === -1) {
    // If no existing entries, add after the header text
    const headerText = changelog.match(/^# Changelog[\s\S]*?^##/m);
    if (headerText) {
      const insertPos = changelog.indexOf('##');
      changelog =
        changelog.slice(0, insertPos) + newEntry + changelog.slice(insertPos);
    } else {
      changelog = changelog.trim() + '\n\n' + newEntry;
    }
  } else {
    // Insert after the header, before the first existing entry
    changelog =
      changelog.slice(0, headerEnd) + newEntry + changelog.slice(headerEnd);
  }

  fs.writeFileSync(CHANGELOG_PATH, changelog, 'utf8');
  console.log(`✅ Updated CHANGELOG.md with version ${version}`);
  console.log(
    `   Found ${commits.length} commit(s) since ${lastTag || 'beginning'}`
  );
}

// Main execution
const version = process.argv[2];
const date = process.argv[3] || new Date().toISOString().split('T')[0];

if (!version) {
  console.error('Usage: node update-changelog.js <version> [date]');
  process.exit(1);
}

updateChangelog(version, date);
