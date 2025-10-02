const { randomUUID } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { createEmbed } = require('../../util/replies');

const POWER_ACTIONS = {
  RESTART: 'restart',
  SHUTDOWN: 'shutdown',
};

const CUSTOM_ID_PREFIX = 'power';

const SESSION_DURATION_MS = 60 * 1000;
const COOLDOWN_AFTER_APPROVED_MS = 5 * 60 * 1000;
const COOLDOWN_AFTER_CANCELLED_MS = 60 * 1000;
const COOLDOWN_AFTER_EXPIRED_MS = 90 * 1000;

const sessions = new Map();
const actionSessions = new Map();
const cooldowns = new Map();
const history = new Map();

function toSeconds(ms) {
  return Math.floor(ms / 1000);
}

function formatRelative(ms) {
  return `<t:${toSeconds(ms)}:R>`;
}

function formatAbsolute(ms) {
  return `<t:${toSeconds(ms)}:f>`;
}

function getActionDisplay(action) {
  return action === POWER_ACTIONS.SHUTDOWN ? 'Shutdown' : 'Restart';
}

function getActionColor(action) {
  return action === POWER_ACTIONS.SHUTDOWN ? 0xed4245 : 0x5865f2;
}

function getResultColor(state) {
  switch (state) {
    case 'approved':
      return 0x3ba55d;
    case 'cancelled':
      return 0xffa500;
    case 'expired':
    default:
      return 0xfee75c;
  }
}

function createCustomId(action, decision, sessionId) {
  return `${CUSTOM_ID_PREFIX}:${action}:${decision}:${sessionId}`;
}

function parseCustomId(customId) {
  if (!customId?.startsWith(`${CUSTOM_ID_PREFIX}:`)) {
    return null;
  }

  const [, action, decision, sessionId] = customId.split(':');

  if (!action || !decision || !sessionId) {
    return null;
  }

  if (!Object.values(POWER_ACTIONS).includes(action)) {
    return null;
  }

  if (!['confirm', 'cancel'].includes(decision)) {
    return null;
  }

  return { action, decision, sessionId };
}

function getHistoryField(action) {
  const record = history.get(action);

  if (!record) {
    return {
      name: 'Last action',
      value: 'No previous actions recorded.',
    };
  }

  const descriptor = record.outcome === 'approved' ? 'Approved' : record.outcome === 'cancelled' ? 'Cancelled' : 'Expired';

  const parts = [
    `${descriptor} ${formatRelative(record.at)} (${formatAbsolute(record.at)})`,
  ];

  if (record.actorTag) {
    parts.push(`Handled by **${record.actorTag}**.`);
  }

  if (record.reason) {
    parts.push(record.reason);
  }

  return {
    name: 'Last action',
    value: parts.join('
'),
  };
}

function buildSessionPrompt(session) {
  const actionDisplay = getActionDisplay(session.action);
  const description = [
    `**${session.requestedBy.tag}** requested a ${actionDisplay.toLowerCase()} of the bot.`,
    'Use the buttons below to confirm or cancel the request.',
    `This session expires ${formatRelative(session.expiresAt)} (${formatAbsolute(session.expiresAt)}).`,
    `Session ID: \`${session.id}\``,
  ].join('

');

  const fields = [
    {
      name: 'Requested by',
      value: `<@${session.requestedBy.id}> (\`${session.requestedBy.tag}\`)`,
      inline: true,
    },
    {
      name: 'Opened',
      value: `${formatRelative(session.createdAt)} (${formatAbsolute(session.createdAt)})`,
      inline: true,
    },
    getHistoryField(session.action),
  ];

  const confirmLabel = session.action === POWER_ACTIONS.SHUTDOWN ? 'Confirm shutdown' : 'Confirm restart';
  const confirmStyle = session.action === POWER_ACTIONS.SHUTDOWN ? ButtonStyle.Danger : ButtonStyle.Success;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId(session.action, 'confirm', session.id))
      .setStyle(confirmStyle)
      .setLabel(confirmLabel),
    new ButtonBuilder()
      .setCustomId(createCustomId(session.action, 'cancel', session.id))
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cancel request'),
  );

  return {
    embeds: [
      createEmbed({
        title: `${actionDisplay} confirmation`,
        description,
        color: getActionColor(session.action),
        timestamp: new Date(session.createdAt),
        fields,
      }),
    ],
    components: [row],
  };
}

function buildActiveSessionEmbed(session) {
  const actionDisplay = getActionDisplay(session.action);

  return createEmbed({
    title: `${actionDisplay} already pending`,
    color: 0xfee75c,
    description: [
      `A ${actionDisplay.toLowerCase()} request from **${session.requestedBy.tag}** is already pending.`,
      `It will expire ${formatRelative(session.expiresAt)} (${formatAbsolute(session.expiresAt)}).`,
      'Resolve the existing request before starting a new one.',
      `Session ID: \`${session.id}\``,
    ].join('

'),
    fields: [
      {
        name: 'Requested by',
        value: `<@${session.requestedBy.id}> (\`${session.requestedBy.tag}\`)`,
        inline: true,
      },
      {
        name: 'Opened',
        value: `${formatRelative(session.createdAt)} (${formatAbsolute(session.createdAt)})`,
        inline: true,
      },
    ],
  });
}

function buildCooldownEmbed(action, endsAt) {
  const actionDisplay = getActionDisplay(action);

  return createEmbed({
    title: `${actionDisplay} cooldown active`,
    description: [
      `A global cooldown is in effect for **${actionDisplay.toLowerCase()}** requests.`,
      `You can initiate another request ${formatRelative(endsAt)} (${formatAbsolute(endsAt)}).`,
    ].join('

'),
    color: 0xffa500,
  });
}

function beginPowerSession({ action, userId, userTag }) {
  const now = Date.now();
  const cooldownUntil = cooldowns.get(action) ?? 0;

  if (cooldownUntil > now) {
    return { error: 'cooldown', embed: buildCooldownEmbed(action, cooldownUntil) };
  }

  const existingSessionId = actionSessions.get(action);
  if (existingSessionId) {
    const existingSession = sessions.get(existingSessionId);
    if (existingSession) {
      return { error: 'active', embed: buildActiveSessionEmbed(existingSession) };
    }
    actionSessions.delete(action);
  }

  const sessionId = randomUUID();
  const createdAt = now;
  const expiresAt = now + SESSION_DURATION_MS;
  const session = {
    id: sessionId,
    action,
    createdAt,
    expiresAt,
    requestedBy: {
      id: userId,
      tag: userTag,
    },
    status: 'pending',
    message: null,
    timeout: null,
  };

  const timeout = setTimeout(() => {
    expireSession(sessionId);
  }, SESSION_DURATION_MS);

  if (typeof timeout.unref === 'function') {
    timeout.unref();
  }

  session.timeout = timeout;

  sessions.set(sessionId, session);
  actionSessions.set(action, sessionId);

  return { session, prompt: buildSessionPrompt(session) };
}

function registerSessionMessage(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  session.message = message;
}

function buildOutcomeEmbed(session, { state, actorTag, cooldownUntil, reason }) {
  const actionDisplay = getActionDisplay(session.action);
  const titleBase = state === 'approved' ? `${actionDisplay} approved` : state === 'cancelled' ? `${actionDisplay} cancelled` : `${actionDisplay} expired`;

  const descriptionParts = [];

  if (actorTag) {
    const verb = state === 'approved' ? 'approved' : state === 'cancelled' ? 'cancelled' : 'allowed to expire';
    descriptionParts.push(`**${actorTag}** ${verb} this request.`);
  }

  if (reason) {
    descriptionParts.push(reason);
  }

  if (cooldownUntil && cooldownUntil > Date.now()) {
    descriptionParts.push(`Global cooldown in effect until ${formatRelative(cooldownUntil)} (${formatAbsolute(cooldownUntil)}).`);
  }

  const fields = [
    {
      name: 'Requested by',
      value: `<@${session.requestedBy.id}> (\`${session.requestedBy.tag}\`)`,
      inline: true,
    },
    {
      name: 'Opened',
      value: `${formatRelative(session.createdAt)} (${formatAbsolute(session.createdAt)})`,
      inline: true,
    },
  ];

  return createEmbed({
    title: titleBase,
    description: descriptionParts.join('
') || undefined,
    color: getResultColor(state),
    fields,
    timestamp: new Date(),
  });
}

function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.timeout) {
    clearTimeout(session.timeout);
    session.timeout = null;
  }

  sessions.delete(sessionId);

  if (actionSessions.get(session.action) === sessionId) {
    actionSessions.delete(session.action);
  }

  return session;
}

async function expireSession(sessionId) {
  const session = cleanupSession(sessionId);
  if (!session || session.status !== 'pending') {
    return;
  }

  session.status = 'expired';

  const cooldownUntil = Date.now() + COOLDOWN_AFTER_EXPIRED_MS;
  cooldowns.set(session.action, cooldownUntil);
  history.set(session.action, { at: Date.now(), outcome: 'expired', reason: 'No response before the session expired.' });

  const embed = buildOutcomeEmbed(session, {
    state: 'expired',
    actorTag: null,
    cooldownUntil,
    reason: 'Request timed out before confirmation.',
  });

  if (session.message?.editable) {
    try {
      await session.message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      // ignore edit errors for expired sessions
    }
  }
}

async function resolvePowerSession(sessionId, { approved, actor, client }) {
  const session = sessions.get(sessionId);

  if (!session || session.status !== 'pending') {
    return { error: 'not-found' };
  }

  if (Date.now() > session.expiresAt) {
    await expireSession(sessionId);
    return { error: 'expired' };
  }

  cleanupSession(sessionId);

  session.status = approved ? 'approved' : 'cancelled';

  const now = Date.now();
  const cooldownUntil = now + (approved ? COOLDOWN_AFTER_APPROVED_MS : COOLDOWN_AFTER_CANCELLED_MS);
  cooldowns.set(session.action, cooldownUntil);

  const actorTag = actor?.tag ?? 'Unknown user';
  history.set(session.action, { at: now, actorTag, outcome: approved ? 'approved' : 'cancelled' });

  const embed = buildOutcomeEmbed(session, {
    state: approved ? 'approved' : 'cancelled',
    actorTag,
    cooldownUntil,
  });

  if (session.message?.editable) {
    try {
      await session.message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      // ignore edit errors
    }
  }

  if (approved) {
    if (session.action === POWER_ACTIONS.RESTART) {
      client?.requestRestart?.();
    } else if (session.action === POWER_ACTIONS.SHUTDOWN) {
      client?.requestShutdown?.();
    }
  }

  return { embed };
}

async function cancelPowerSession(sessionId, { actor, reason }) {
  const session = sessions.get(sessionId);

  if (!session || session.status !== 'pending') {
    return { error: 'not-found' };
  }

  cleanupSession(sessionId);

  session.status = 'cancelled';

  const now = Date.now();
  const cooldownUntil = now + COOLDOWN_AFTER_CANCELLED_MS;
  cooldowns.set(session.action, cooldownUntil);

  const actorTag = actor?.tag ?? 'Unknown user';
  history.set(session.action, { at: now, actorTag, outcome: 'cancelled', reason });

  const embed = buildOutcomeEmbed(session, {
    state: 'cancelled',
    actorTag,
    cooldownUntil,
    reason,
  });

  if (session.message?.editable) {
    try {
      await session.message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      // ignore edit errors
    }
  }

  return { embed };
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

module.exports = {
  POWER_ACTIONS,
  CUSTOM_ID_PREFIX,
  beginPowerSession,
  buildSessionPrompt,
  registerSessionMessage,
  buildCooldownEmbed,
  buildActiveSessionEmbed,
  parseCustomId,
  resolvePowerSession,
  cancelPowerSession,
  getSession,
};
