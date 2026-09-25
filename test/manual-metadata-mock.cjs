
const http = require('node:http');

const metadata = {
  title: 'Jornada pelo Oceano',
  synopsis: 'Uma jornada sobre a vida marinha.',
  type: 'DOCUMENTARY',
  releaseYear: 2026,
  durationMinutes: 90,
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/filme-001') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Metadados não encontrados.' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metadata));
});

server.listen(3100, '127.0.0.1', () => {
  console.log('Mock de metadados disponível em http://127.0.0.1:3100/filme-001');
});