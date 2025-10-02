const { createEmbed } = require('./replies');

const LATENCY_STATES = [
  { max: 100, label: 'Low', description: 'All clear!', emoji: '🟢', color: 0x57f287 },
  { max: 250, label: 'Moderate', description: 'A little warm, but still fine.', emoji: '🟡', color: 0xfee75c },
  { max: Infinity, label: 'High', description: 'Things are running hot.', emoji: '🔴', color: 0xed4245 },
];

function resolveLatencyState(roundTrip, wsPing) {
  const metrics = [roundTrip, wsPing].filter((value) => Number.isFinite(value) && value >= 0);
  const worst = metrics.length > 0 ? Math.max(...metrics) : roundTrip;

  return LATENCY_STATES.find((state) => worst <= state.max) || LATENCY_STATES[LATENCY_STATES.length - 1];
}

function formatLatency(value) {
  if (!Number.isFinite(value) || value < 0) {
    return '`N/A`';
  }

  return `\`${Math.round(value)} ms\``;
}

function buildLatencyEmbed({ roundTrip, wsPing }) {
  const state = resolveLatencyState(roundTrip, wsPing);

  return createEmbed({
    title: `${state.emoji} ${state.label} Latency`,
    description: state.description,
    color: state.color,
    fields: [
      { name: 'Round Trip', value: formatLatency(roundTrip), inline: true },
      { name: 'WebSocket', value: formatLatency(wsPing), inline: true },
      {
        name: 'Status',
        value: `${state.emoji} ${state.label}`,
        inline: true,
      },
    ],
  });
}

module.exports = {
  buildLatencyEmbed,
  resolveLatencyState,
};
