// A live football scoreboard in one file: every match in play, with the
// minute, the score and the corner count.
//
//   FIVEDOLLARFOOTBALL_API_KEY=fb_live_... node server.js
//
// The API key stays in this process. The browser only ever receives the
// rendered page, and the API is asked at most once a minute however many
// people have the page open.

const http = require('node:http');
const { Client } = require('fivedollarfootball');

const PORT = process.env.PORT || 3000;
const REFRESH_SECONDS = 60;

if (!process.env.FIVEDOLLARFOOTBALL_API_KEY) {
  console.error('Set FIVEDOLLARFOOTBALL_API_KEY. Free keys: https://5dollarfootballapi.com');
  process.exit(1);
}

const client = new Client(process.env.FIVEDOLLARFOOTBALL_API_KEY);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
let cache = { at: 0, html: '' };

const STYLE = `
  body { font: 15px/1.4 system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #0f172a; }
  h1 { font-size: 1.4rem; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: .75rem; color: #64748b; padding: .4rem .5rem; }
  td { padding: .45rem .5rem; border-top: 1px solid #e2e8f0; }
  .min { color: #dc2626; font-weight: 600; white-space: nowrap; }
  .league { color: #64748b; }
  .home { text-align: right; }
  .score { font-weight: 700; white-space: nowrap; text-align: center; }
  footer { margin-top: 1.5rem; font-size: .8rem; color: #64748b; }
`;

async function scoreboard() {
  // Ask the API at most once a minute, however many visitors there are.
  if (Date.now() - cache.at < REFRESH_SECONDS * 1000) return cache.html;

  // One call: every match in play right now.
  const { data: matches } = await client.fixtures({ status: 'live', perPage: 500 });

  const rows = matches.map((m) => `<tr>
    <td class="min">${m.status_code === 'half' ? 'HT' : esc(m.status_code) + "'"}</td>
    <td class="league">${esc(m.league.name)}</td>
    <td class="home">${esc(m.teams.home.name)}</td>
    <td class="score">${m.goals.home} - ${m.goals.away}</td>
    <td>${esc(m.teams.away.name)}</td>
    <td>${m.corners.home ?? '-'} - ${m.corners.away ?? '-'}</td>
  </tr>`);

  cache.at = Date.now();
  cache.html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${REFRESH_SECONDS}">
  <title>Live scores</title>
  <style>${STYLE}</style>
</head>
<body>
  <h1>Live scores (${matches.length})</h1>
  <table>
    <tr><th>Min</th><th>League</th><th class="home">Home</th><th></th><th>Away</th><th>Corners</th></tr>
    ${rows.join('') || '<tr><td colspan="6">Nothing in play right now.</td></tr>'}
  </table>
  <footer>Football data by <a href="https://5dollarfootballapi.com">5DollarFootballAPI</a></footer>
</body>
</html>`;
  return cache.html;
}

http.createServer(async (req, res) => {
  try {
    const html = await scoreboard();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Could not load scores: ${err.message}`);
  }
}).listen(PORT, () => console.log(`Scoreboard on http://localhost:${PORT}`));
