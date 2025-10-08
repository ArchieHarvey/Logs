const fs = require('node:fs');
const path = require('node:path');

function walkCommandFiles(baseDirectory) {
  const resolvedBaseDirectory = path.resolve(baseDirectory);
  const files = [];

  if (!fs.existsSync(resolvedBaseDirectory)) {
    return files;
  }

  const entries = fs.readdirSync(resolvedBaseDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(resolvedBaseDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkCommandFiles(entryPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function resolveCategory(baseDirectory, filepath) {
  const basePath = path.resolve(baseDirectory);
  const relativePath = path.relative(basePath, path.dirname(filepath));

  if (!relativePath || relativePath === '.') {
    return undefined;
  }

  const [category] = relativePath.split(path.sep);
  return category || undefined;
}

function loadCommands(directory) {
  const commands = new Map();

  const baseDirectory = path.resolve(directory);

  if (!fs.existsSync(baseDirectory)) {
    return commands;
  }
  const files = walkCommandFiles(baseDirectory);

  for (const filepath of files) {
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.name || typeof command.execute !== 'function') {
      continue;
    }

    command.category = command.category ?? resolveCategory(baseDirectory, filepath);
    commands.set(command.name, command);
  }

  return commands;
}

function loadSlashCommands(directory) {
  const commands = [];

  const baseDirectory = path.resolve(directory);

  if (!fs.existsSync(baseDirectory)) {
    return commands;
  }
  const files = walkCommandFiles(baseDirectory);

  for (const filepath of files) {
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.data || typeof command.execute !== 'function') {
      continue;
    }

    command.category = command.category ?? resolveCategory(baseDirectory, filepath);
    commands.push(command);
  }

  return commands;
}

module.exports = {
  loadTextCommands: loadCommands,
  loadSlashCommands,
};
