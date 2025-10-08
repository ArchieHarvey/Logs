const { createEmbed } = require('./replies');
const { ensureCategoryId, getCategoryMetadata, sortCategories } = require('./commandCategories');

const HELP_MENU_CUSTOM_ID = 'help-menu';
const HELP_MENU_OVERVIEW_VALUE = 'help:overview';
const HELP_MENU_PLACEHOLDER = 'Select a command category';

function toArray(collection) {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  if (typeof collection.values === 'function') {
    return Array.from(collection.values());
  }

  return [];
}

function formatCommandList(commands, formatter, emptyFallback) {
  if (!commands || commands.length === 0) {
    return emptyFallback;
  }

  return commands.map(formatter).join('\n');
}

function getSlashCommandName(command) {
  return command?.data?.name ?? command?.name ?? '';
}

function normalizeCategoryRecord(categoryId, existing) {
  if (existing) {
    return existing;
  }

  const metadata = { ...getCategoryMetadata(categoryId) };
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    order: metadata.order,
    textCommands: [],
    slashCommands: [],
  };
}

function buildCategoryMap(textCommands, slashCommands) {
  const categories = new Map();

  for (const command of toArray(textCommands)) {
    if (!command?.name || typeof command.execute !== 'function') {
      continue;
    }

    const categoryId = ensureCategoryId(command.category);
    const record = normalizeCategoryRecord(categoryId, categories.get(categoryId));
    record.textCommands.push(command);
    categories.set(categoryId, record);
  }

  for (const command of toArray(slashCommands)) {
    const name = getSlashCommandName(command);
    if (!name || typeof command.execute !== 'function') {
      continue;
    }

    const categoryId = ensureCategoryId(command.category);
    const record = normalizeCategoryRecord(categoryId, categories.get(categoryId));
    record.slashCommands.push(command);
    categories.set(categoryId, record);
  }

  return categories;
}

function sortCommandsByName(commands, accessor) {
  return commands.sort((a, b) => accessor(a).localeCompare(accessor(b)));
}

function buildOverviewField(category) {
  const counts = [];

  if (category.textCommands.length) {
    counts.push(`Text: **${category.textCommands.length}**`);
  }

  if (category.slashCommands.length) {
    counts.push(`Slash: **${category.slashCommands.length}**`);
  }

  const summary = counts.length > 0 ? counts.join(' • ') : 'No commands in this category yet.';
  const parts = [category.description, summary];

  return {
    name: category.name,
    value: parts.filter(Boolean).join('\n'),
  };
}

function formatTextCommand(command, prefix) {
  const description = command.description || 'No description provided.';
  return `\`${prefix}${command.name}\` - ${description}`;
}

function formatSlashCommand(command) {
  const name = getSlashCommandName(command);
  const description = command?.data?.description ?? command?.description ?? 'No description provided.';
  return `\`/${name}\` - ${description}`;
}

function buildCategoryEmbed(category, { prefix }) {
  sortCommandsByName(category.textCommands, (command) => command.name);
  sortCommandsByName(category.slashCommands, (command) => getSlashCommandName(command));

  const textValue = formatCommandList(
    category.textCommands,
    (command) => formatTextCommand(command, prefix),
    'No text commands in this category yet.',
  );

  const slashValue = formatCommandList(
    category.slashCommands,
    (command) => formatSlashCommand(command),
    'No slash commands in this category yet.',
  );

  return createEmbed({
    title: `${category.name} commands`,
    description: category.description,
    fields: [
      { name: 'Text commands', value: textValue },
      { name: 'Slash commands', value: slashValue },
    ],
  });
}

function buildHelpMenu({ prefix = '!', textCommands, slashCommands }) {
  const categoryMap = buildCategoryMap(textCommands, slashCommands);
  const categories = sortCategories(Array.from(categoryMap.values()));

  const overviewEmbed = createEmbed({
    title: 'Help menu',
    description: categories.length
      ? 'Select a category from the menu below to view detailed help.'
      : 'No commands are currently available.',
    fields: categories.length ? categories.map((category) => buildOverviewField(category)) : undefined,
  });

  const embedsByValue = new Map([[HELP_MENU_OVERVIEW_VALUE, overviewEmbed]]);
  const options = categories.length
    ? [
        {
          value: HELP_MENU_OVERVIEW_VALUE,
          label: 'Overview',
          description: 'Summary of all command categories.',
          default: true,
        },
      ]
    : [];

  for (const category of categories) {
    embedsByValue.set(category.id, buildCategoryEmbed(category, { prefix }));

    options.push({
      value: category.id,
      label: category.name,
      description: category.description.slice(0, 100),
    });
  }

  return {
    customId: HELP_MENU_CUSTOM_ID,
    overviewValue: HELP_MENU_OVERVIEW_VALUE,
    placeholder: HELP_MENU_PLACEHOLDER,
    options,
    embedsByValue,
    categories,
  };
}

module.exports = {
  HELP_MENU_CUSTOM_ID,
  HELP_MENU_OVERVIEW_VALUE,
  HELP_MENU_PLACEHOLDER,
  buildHelpMenu,
};
