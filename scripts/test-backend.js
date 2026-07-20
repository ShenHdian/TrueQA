const B = 'http://localhost:3000';
(async () => {
  const base = { 'Content-Type': 'application/json' };
  const login = await fetch(B + '/api/auth/wechat-login', { method: 'POST', headers: base, body: JSON.stringify({ code: 'utf8-test' }) }).then(r => r.json());
  const token = login.data.access_token;
  const auth = { ...base, Authorization: 'Bearer ' + token };

  const text = '你最怕失去的是什么？这是一段中文测试。';
  const add = await fetch(B + '/api/questions', { method: 'POST', headers: auth, body: JSON.stringify({ content: text, anger: 6 }) }).then(r => r.json());
  console.log('ADD code=', add.code, '| 回显内容=', add.data && add.data.content);

  const mine = await fetch(B + '/api/questions?mine=1', { headers: auth }).then(r => r.json());
  const found = mine.data.list.find(q => q.id === add.data.id);
  console.log('MINE 含本人题=', !!found, '| 中文回环一致=', !!(found && found.content === text));

  const pub = await fetch(B + '/api/questions').then(r => r.json());
  const leaked = pub.data.list.find(q => q.id === add.data.id);
  console.log('PUBLIC 泄露本人题=', !!leaked, '| PUBLIC 全为系统题=', pub.data.list.every(q => q.source === 'system'), '| 系统题数=', pub.data.list.length);

  const batch = await fetch(B + '/api/questions/batch', { method: 'POST', headers: auth, body: JSON.stringify({ items: [{ content: '批量中文题一', anger: 3 }, { content: '批量中文题二', anger: 7 }] }) }).then(r => r.json());
  console.log('BATCH code=', batch.code, '| 入库数=', batch.data && batch.data.added);

  const rnd = await fetch(B + '/api/questions/random').then(r => r.json());
  console.log('RANDOM ok=', rnd.code === 0, '| 来源=', rnd.data && rnd.data.source);
})();
