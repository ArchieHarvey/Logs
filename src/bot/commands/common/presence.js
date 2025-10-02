const { ActivityType } = require('discord.js');

const PRESENCE_COLLECTION = 'botPresence';
const PRESENCE_DOCUMENT_ID = 'current';

const PRESENCE_STATUSES = [
  { name: 'Online', value: 'online' },
  { name: 'Idle', value: 'idle' },
  { name: 'Do Not Disturb', value: 'dnd' },
  { name: 'Invisible', value: 'invisible' },
];

const ACTIVITY_TYPES = [
  { name: 'Playing', value: 'playing', type: ActivityType.Playing },
  { name: 'Listening', value: 'listening', type: ActivityType.Listening },
  { name: 'Watching', value: 'watching', type: ActivityType.Watching },
  { name: 'Competing', value: 'competing', type: ActivityType.Competing },
];

const activityTypeMap = ACTIVITY_TYPES.reduce((map, option) => {
  map.set(option.value, option.type);
  return map;
}, new Map());

function normalizePresence(input = {}) {
  const status = PRESENCE_STATUSES.some((option) => option.value === input.status)
    ? input.status
    : 'online';

  let activityType = ACTIVITY_TYPES.some((option) => option.value === input.activityType)
    ? input.activityType
    : null;

  const activityText = typeof input.activityText === 'string' ? input.activityText : '';

  if (activityText && !activityType) {
    activityType = 'playing';
  }

  return { status, activityType, activityText };
}

function buildPresenceDescription(presence) {
  const { status, activityType, activityText } = normalizePresence(presence);
  const lines = [`Status: **${status}**`];

  if (activityText) {
    const activityLabel = activityType ?? 'playing';
    lines.push(`Activity: **${activityLabel} ${activityText}**`);
  } else {
    lines.push('Activity: _(none)_');
  }

  return lines.join('\n');
}

function getPresenceFromClient(client) {
  const status = client?.user?.presence?.status ?? 'online';
  const activity = client?.user?.presence?.activities?.[0];

  let activityType = null;
  let activityText = '';

  if (activity) {
    activityText = activity.name ?? '';

    if (activityText) {
      const matchedType = ACTIVITY_TYPES.find((option) => option.type === activity.type);
      activityType = matchedType ? matchedType.value : 'playing';
    }
  }

  return normalizePresence({ status, activityType, activityText });
}

async function applyPresence(client, presence) {
  const normalized = normalizePresence(presence);
  const activities = [];

  if (normalized.activityText) {
    const type = activityTypeMap.get(normalized.activityType) ?? ActivityType.Playing;
    activities.push({ name: normalized.activityText, type });
  }

  await client.user?.setPresence({
    status: normalized.status,
    activities,
  });

  return normalized;
}

async function savePresence(mongoService, presence) {
  if (!mongoService?.isConfigured?.()) {
    throw new Error('MongoDB is not configured.');
  }

  const client = await mongoService.ensureConnection();
  if (!client) {
    throw new Error('MongoDB connection is not available.');
  }

  const normalized = normalizePresence(presence);
  const collection = client.db().collection(PRESENCE_COLLECTION);

  await collection.updateOne(
    { _id: PRESENCE_DOCUMENT_ID },
    {
      $set: {
        status: normalized.status,
        activityType: normalized.activityType,
        activityText: normalized.activityText,
      },
      $currentDate: { updatedAt: true },
    },
    { upsert: true },
  );

  return normalized;
}

async function fetchStoredPresence(mongoService) {
  if (!mongoService?.isConfigured?.()) {
    return null;
  }

  const client = await mongoService.ensureConnection();
  if (!client) {
    return null;
  }

  const document = await client
    .db()
    .collection(PRESENCE_COLLECTION)
    .findOne({ _id: PRESENCE_DOCUMENT_ID });

  if (!document) {
    return null;
  }

  return normalizePresence(document);
}

module.exports = {
  PRESENCE_STATUSES,
  ACTIVITY_TYPES,
  activityTypeMap,
  normalizePresence,
  buildPresenceDescription,
  getPresenceFromClient,
  applyPresence,
  savePresence,
  fetchStoredPresence,
};
