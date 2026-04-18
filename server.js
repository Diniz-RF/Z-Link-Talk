const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;

// Servidor HTTP para compatibilidade com o Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor Z-Link Talk Ativo');
});

const wss = new WebSocket.Server({ server });

const clients = new Map();
let currentTransmitter = null;

wss.on('connection', (ws) => {
    const clientId = uuidv4().substring(0, 8);
    clients.set(ws, clientId);

    // Enviar ID inicial e lista de clientes
    ws.send(JSON.stringify({
        type: "init",
        id: clientId,
        clients: Array.from(clients.values())
    }));

    broadcast(JSON.stringify({ type: "new_peer", id: clientId }), ws);

    ws.on('message', (data) => {
        // TRATAMENTO DE ÁUDIO BINÁRIO (BUFFER)
        if (Buffer.isBuffer(data)) {
            // Só faz broadcast se for o transmissor atual ou se o canal estiver "aberto"
            if (currentTransmitter === clientId || currentTransmitter === null) {
                broadcast(data, ws);
            }
            return;
        }

        // TRATAMENTO DE SINALIZAÇÃO JSON
        try {
            const msg = JSON.parse(data);
            
            switch (msg.type) {
                case "start_tx":
                    if (!currentTransmitter) {
                        currentTransmitter = clientId;
                        msg.from = clientId;
                        broadcast(JSON.stringify(msg), ws);
                    }
                    break;

                case "stop_tx":
                    if (currentTransmitter === clientId) {
                        currentTransmitter = null;
                        msg.from = clientId;
                        broadcast(JSON.stringify(msg), ws);
                    }
                    break;

                default:
                    msg.from = clientId;
                    broadcast(JSON.stringify(msg), ws);
                    break;
            }
        } catch (err) {
            // Ignora erros de parsing de dados que não sejam JSON
        }
    });

    ws.on('close', () => {
        if (currentTransmitter === clientId) currentTransmitter = null;
        clients.delete(ws);
        broadcast(JSON.stringify({ type: "peer_left", id: clientId }));
    });
});

function broadcast(data, sender) {
    clients.forEach((id, client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});