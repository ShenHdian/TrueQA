// 微信服务端能力封装：access_token 缓存 + 文本内容安全审核(msgSecCheck)。
// 仅在配置了 WX_APPID / WX_SECRET 时启用；未配置（本地开发）自动跳过，不影响功能。
let _token = null;
let _expireAt = 0;

async function getAccessToken() {
  const { WX_APPID, WX_SECRET } = process.env;
  if (!WX_APPID || !WX_SECRET) return null;
  const now = Date.now();
  if (_token && _expireAt > now) return _token;
  try {
    const url =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential` +
      `&appid=${WX_APPID}&secret=${WX_SECRET}`;
    const r = await fetch(url);
    const j = await r.json();
    if (j.access_token) {
      // 提前 60s 过期，避免临界期用旧 token
      _expireAt = now + (j.expires_in ? j.expires_in * 1000 : 7200 * 1000) - 60000;
      _token = j.access_token;
      return _token;
    }
    console.warn('[wechat] 获取 access_token 失败：', j.errcode, j.errmsg);
  } catch (e) {
    console.warn('[wechat] 获取 access_token 异常：', e.message);
  }
  return null;
}

// 文本审核：返回 { ok, skipped?, warn?, reason? }
// - ok=true  : 合规（或已跳过/异常放行）
// - ok=false : 明确命中违规（errcode 87014），应拦截
async function checkText(content, openid) {
  const token = await getAccessToken();
  if (!token) return { ok: true, skipped: true }; // 未配置：放行（本地/dev）

  const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`;
  const body = { content: String(content || '') };
  if (openid) {
    body.openid = openid;
    body.scene = 2; // 资料/评论类
  }

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.errcode === 0) return { ok: true };
    if (j.errcode === 87014) return { ok: false, reason: '内容含违规风险' };
    // 其他错误（未开通/参数/频率/需 openid）：放行但告警，避免线上卡死
    console.warn('[wechat] msg_sec_check 异常 errcode=', j.errcode, j.errmsg);
    return { ok: true, warn: true };
  } catch (e) {
    console.warn('[wechat] msg_sec_check 调用失败：', e.message);
    return { ok: true, warn: true };
  }
}

module.exports = { getAccessToken, checkText };
