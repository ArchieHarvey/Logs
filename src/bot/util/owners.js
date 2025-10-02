const config = require('../../config');

const ownerIdSet = new Set(config.ownerIds || []);

function isOwner(userId) {
  if (!userId) {
    return false;
  }

  return ownerIdSet.has(userId);
}

module.exports = {
  ownerIdSet,
  isOwner,
};
