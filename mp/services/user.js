// 用户服务
const { ensureLogin, getProfile } = require('../utils/auth');

const getMyProfile = async () => {
  await ensureLogin();
  return getProfile();
};

module.exports = { getMyProfile };
