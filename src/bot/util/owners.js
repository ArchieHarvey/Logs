const config = require('../../config');

const COLLECTION_NAME = 'owners';

const initialOwnerIds = Array.isArray(config.ownerIds) ? [...new Set(config.ownerIds)] : [];
const ownerManagerId = config.ownerManagerId || '';

if (ownerManagerId && !initialOwnerIds.includes(ownerManagerId)) {
  initialOwnerIds.push(ownerManagerId);
}

const ownerIdSet = new Set(initialOwnerIds);

function normalizeUserId(userId) {
  if (typeof userId === 'string') {
    return userId.trim();
  }

  if (userId === null || userId === undefined) {
    return '';
  }

  return String(userId).trim();
}

async function getOwnersCollection(mongoService) {
  if (!mongoService?.isConfigured?.()) {
    throw new Error('MongoDB is not configured.');
  }

  const client = await mongoService.ensureConnection();
  if (!client) {
    throw new Error('MongoDB client is not available.');
  }

  return client.db().collection(COLLECTION_NAME);
}

function isOwner(userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    return false;
  }

  return ownerIdSet.has(normalized);
}

function isOwnerManager(userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized || !ownerManagerId) {
    return false;
  }

  return normalized === ownerManagerId;
}

function getOwnerIds() {
  return Array.from(ownerIdSet.values());
}

function formatOwnerList(ownerIds) {
  if (!Array.isArray(ownerIds) || ownerIds.length === 0) {
    return 'No owners are currently configured.';
  }

  const sorted = [...new Set(ownerIds)].sort((a, b) => a.localeCompare(b));

  return sorted
    .map((id) => {
      const isManager = ownerManagerId && id === ownerManagerId;
      return `• ${id}${isManager ? ' *(manager)*' : ''}`;
    })
    .join('\n');
}

function parseUserIdInput(input) {
  if (!input) {
    return '';
  }

  const trimmed = input.trim();
  const mentionMatch = trimmed.match(/^<@!?([0-9]{3,})>$/);

  if (mentionMatch) {
    return mentionMatch[1];
  }

  if (/^[0-9]{3,}$/.test(trimmed)) {
    return trimmed;
  }

  return '';
}

async function syncOwnersFromDatabase(mongoService) {
  const collection = await getOwnersCollection(mongoService);
  let documents = await collection.find({}).toArray();

  if (!documents.length && ownerIdSet.size > 0) {
    const seedIds = Array.from(ownerIdSet.values());
    const operations = seedIds.map((id) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $setOnInsert: {
            _id: id,
            addedAt: new Date(),
            addedBy: ownerManagerId || 'config',
          },
        },
        upsert: true,
      },
    }));

    if (operations.length) {
      await collection.bulkWrite(operations, { ordered: false });
      documents = await collection.find({}).toArray();
    }
  }

  const nextOwnerIds = new Set();

  for (const document of documents) {
    const normalized = normalizeUserId(document?._id);
    if (normalized) {
      nextOwnerIds.add(normalized);
    }
  }

  if (ownerManagerId) {
    nextOwnerIds.add(ownerManagerId);
  }

  ownerIdSet.clear();
  for (const id of nextOwnerIds) {
    ownerIdSet.add(id);
  }

  return getOwnerIds();
}

async function addOwner(mongoService, userId, { addedBy } = {}) {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    throw new Error('A user ID is required to add an owner.');
  }

  if (ownerIdSet.has(normalized)) {
    return { alreadyOwner: true, ownerIds: getOwnerIds() };
  }

  const collection = await getOwnersCollection(mongoService);
  await collection.updateOne(
    { _id: normalized },
    {
      $setOnInsert: {
        _id: normalized,
        addedAt: new Date(),
        ...(addedBy ? { addedBy } : {}),
      },
    },
    { upsert: true },
  );

  ownerIdSet.add(normalized);

  return { alreadyOwner: false, ownerIds: getOwnerIds() };
}

async function removeOwner(mongoService, userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    throw new Error('A user ID is required to remove an owner.');
  }

  if (normalized === ownerManagerId) {
    return { isManager: true, ownerIds: getOwnerIds() };
  }

  if (!ownerIdSet.has(normalized)) {
    return { notOwner: true, ownerIds: getOwnerIds() };
  }

  const collection = await getOwnersCollection(mongoService);
  await collection.deleteOne({ _id: normalized });

  ownerIdSet.delete(normalized);

  return { removed: true, ownerIds: getOwnerIds() };
}

module.exports = {
  ownerIdSet,
  ownerManagerId,
  isOwner,
  isOwnerManager,
  getOwnerIds,
  formatOwnerList,
  parseUserIdInput,
  syncOwnersFromDatabase,
  addOwner,
  removeOwner,
};
