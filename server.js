const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;

// ✅ AGORA responde HTTP (IMPORTANTE pro Render)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor WebSocket ativo');
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);

    ws.on('message', (data) => {

        if (Buffer.isBuffer(data)) {
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
            return;
        }

        try {
            const msg = JSON.parse(data);

            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msg));
                }
            });

        } catch (err) {
            console.log("Erro ao processar mensagem");
        }
    });

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
    });
});

// ⚠️ opcional mas recomendado
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});