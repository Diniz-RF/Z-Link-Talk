const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);

    ws.on('message', (data) => {

        // 🔥 Se for binário (áudio)
        if (Buffer.isBuffer(data)) {
            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
            return;
        }

        // 🔥 Se for JSON (controle)
        try {
            const msg = JSON.parse(data);

            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(msg));
                }
            });

        } catch (err) {
            console.log("Mensagem inválida");
        }
    });

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
    });
});

console.log("Servidor rodando na porta 3000");