const { createEmbed } = require('./replies');

const CATEGORY_LABELS = {
  general: 'General',
  owner: 'Owner-Only',
};

const CATEGORY_ORDER = ['general', 'owner'];

function toArray(commands) {
  if (!commands) {
    return [];
  }

  if (typeof commands.values === 'function') {
    return Array.from(commands.values());
  }

  if (Array.isArray(commands)) {
    return [...commands];
  }

  return [];
}

function normalizeCategory(command) {
  if (command?.category) {
    return String(command.category).toLowerCase();
  }

  if (command?.ownerOnly) {
    return 'owner';
  }

  return 'general';
}

function getCategoryOrder(key) {
  const normalized = key.toLowerCase();
  const index = CATEGORY_ORDER.indexOf(normalized);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function formatCategoryLabel(key) {
  const normalized = key.toLowerCase();
  if (CATEGORY_LABELS[normalized]) {
    return CATEGORY_LABELS[normalized];
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function buildCategorizedList(commands, { getName, formatEntry, emptyFallback }) {
  const items = toArray(commands);

  if (!items.length) {
    return emptyFallback;
  }

  const categories = new Map();

  for (const command of items) {
    const key = normalizeCategory(command);
    if (!categories.has(key)) {
      categories.set(key, []);
    }
    categories.get(key).push(command);
  }

  const sections = Array.from(categories.entries())
    .sort((a, b) => {
      const orderDelta = getCategoryOrder(a[0]) - getCategoryOrder(b[0]);
      if (orderDelta !== 0) {
        return orderDelta;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([key, bucket]) => {
      bucket.sort((left, right) => getName(left).localeCompare(getName(right)));
      const entries = bucket.map(formatEntry).join('
');
      return `**${formatCategoryLabel(key)} Commands**
${entries}`;
    });

  return sections.join('

');
}

function buildHelpEmbed({ prefix = '!', textCommands, slashCommands }) {
  const textValue = buildCategorizedList(textCommands, {
    getName: (command) => command.name,
    formatEntry: (command) => `• \`${prefix}${command.name}\` - ${command.description || 'No description provided.'}`,
    emptyFallback: 'No text commands are currently available.',
  });

  const slashValue = buildCategorizedList(slashCommands, {
    getName: (command) => command.data?.name ?? command.name,
    formatEntry: (command) => {
      const name = command.data?.name ?? command.name;
      const description = command.data?.description ?? command.description;
      return `• \`/${name}\` - ${description || 'No description provided.'}`;
    },
    emptyFallback: 'No slash commands are currently available.',
  });

  return createEmbed({
    title: 'Help menu',
    description: 'Commands are grouped by scope. Owner-only actions appear in their own section.',
    fields: [
      { name: 'Text commands', value: textValue },
      { name: 'Slash commands', value: slashValue },
    ],
  });
}

module.exports = {
  buildHelpEmbed,
};
