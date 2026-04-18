const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);

    ws.on('message', (data) => {

        // 🔥 BINÁRIO (ÁUDIO)
        if (Buffer.isBuffer(data)) {
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
            return;
        }

        // 🔥 JSON (CONTROLE)
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

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});