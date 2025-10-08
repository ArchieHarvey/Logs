const DEFAULT_CATEGORY_ID = 'general';

const CATEGORY_METADATA = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Commands reserved for the bot owner manager and approved owners.',
  },
  {
    id: 'utility',
    name: 'Utility',
    description: 'Helpful commands that are available to all users.',
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: 'General',
    description: 'Commands that are not part of another specific category.',
  },
];

const CATEGORY_INDEX = new Map(
  CATEGORY_METADATA.map((category, index) => [category.id, { ...category, order: index }]),
);

function formatCategoryName(id) {
  return id
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getCategoryMetadata(id) {
  const resolvedId = ensureCategoryId(id);

  const known = CATEGORY_INDEX.get(resolvedId);
  if (known) {
    return known;
  }

  const name = formatCategoryName(resolvedId) || 'Other';
  return {
    id: resolvedId,
    name,
    description: `Commands in the ${name} category.`,
    order: CATEGORY_METADATA.length,
  };
}

function ensureCategoryId(id) {
  if (typeof id === 'string') {
    const normalized = id.trim().toLowerCase();
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_CATEGORY_ID;
}

function sortCategories(categories) {
  return categories.sort((a, b) => {
    const orderA = a.order ?? CATEGORY_METADATA.length;
    const orderB = b.order ?? CATEGORY_METADATA.length;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name);
  });
}

module.exports = {
  CATEGORY_METADATA,
  DEFAULT_CATEGORY_ID,
  ensureCategoryId,
  getCategoryMetadata,
  sortCategories,
};
