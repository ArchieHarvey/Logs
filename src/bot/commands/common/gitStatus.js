const path = require('node:path');
const simpleGit = require('simple-git');
const { createEmbed } = require('../../util/replies');

async function buildGitStatusEmbed() {
  const git = simpleGit({ baseDir: path.resolve(process.cwd()) });
  const status = await git.status();

  return createEmbed({
    title: 'Repository status',
    description: 'Current git synchronization summary',
    fields: [
      { name: 'Branch', value: status.current || 'Unknown', inline: true },
      { name: 'Tracking', value: status.tracking || 'None', inline: true },
      { name: 'Ahead', value: String(status.ahead || 0), inline: true },
      { name: 'Behind', value: String(status.behind || 0), inline: true },
      { name: 'Changes', value: status.files.length.toString(), inline: true },
    ],
  });
}

module.exports = {
  buildGitStatusEmbed,
};
