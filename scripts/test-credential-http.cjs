// Isolated real n8n Core proof. Install n8n-core in a temporary prefix and set
// OAH_N8N_CORE_PATH to its package directory. No live token or backend required.
const { createServer } = require('node:http');
const assert = require('node:assert/strict');
const { CredentialTestContext } = require(process.env.OAH_N8N_CORE_PATH || 'n8n-core');
const { testApiCredential } = require('../dist/nodes/OpenAgentHub/transport');
const seen = [];
let mode = 'valid';
let forwarded = 0;
const target = createServer((_req, res) => { forwarded++; res.end('{}'); });
const server = createServer((req, res) => {
  seen.push(req.url);
  assert.equal(req.headers.authorization, 'Bearer synthetic-proof-token');
  if (mode === 'hang' || req.url.endsWith('/sessions')) return;
  if (mode === 'redirect') {
    res.writeHead(302, { Location: `http://127.0.0.1:${target.address().port}/login` });
    return res.end();
  }
  if (mode === 'denied') { res.writeHead(401); return res.end('synthetic-proof-token'); }
  if (mode === 'html') { res.setHeader('content-type', 'text/html'); return res.end('<html>login</html>'); }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ accounts: {}, gitPats: [], apiKeys: [] }));
});
async function listen(s) { await new Promise(resolve => s.listen(0, '127.0.0.1', resolve)); }
(async () => {
  try {
    await listen(target); await listen(server);
    const credential = { id: 'proof', name: 'proof', type: 'openAgentHubApi', data: {
      baseUrl: `http://127.0.0.1:${server.address().port}`, allowLocalHttp: true, token: 'synthetic-proof-token',
    } };
    for (mode of ['valid', 'denied', 'html', 'redirect', 'hang']) {
      const start = performance.now();
      const result = await testApiCredential.call(new CredentialTestContext(), credential);
      const elapsed = performance.now() - start;
      assert.equal(result.status, mode === 'valid' ? 'OK' : 'Error');
      assert.ok(!result.message.includes('synthetic-proof-token'));
      if (mode === 'hang') {
        assert.ok(elapsed >= 9500 && elapsed < 13000, `deadline ${elapsed}ms`);
        assert.match(result.message, /timed out/);
      }
      console.log(`Real n8n CredentialTestContext: ${mode} passed (${Math.round(elapsed)}ms)`);
    }
    assert.ok(seen.every(path => path === '/api/remote/credentials'));
    assert.equal(forwarded, 0, 'redirect must not forward bearer token');
  } finally {
    server.closeAllConnections(); target.closeAllConnections();
    server.close(); target.close();
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
