const fs = require('node:fs');
const path = require('node:path');

function loadCommands(directory) {
  const commands = new Map();

  if (!fs.existsSync(directory)) {
    return commands;
  }

  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const filepath = path.join(directory, file);
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.name || typeof command.execute !== 'function') {
      continue;
    }

    commands.set(command.name, command);
  }

  return commands;
}

function loadSlashCommands(directory) {
  const commands = [];

  if (!fs.existsSync(directory)) {
    return commands;
  }

  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const filepath = path.join(directory, file);
    delete require.cache[require.resolve(filepath)];
    const command = require(filepath);

    if (!command || !command.data || typeof command.execute !== 'function') {
      continue;
    }

    commands.push(command);
  }

  return commands;
}

module.exports = {
  loadTextCommands: loadCommands,
  loadSlashCommands,
};
