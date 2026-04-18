const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor Z-Link Talk Ativo');
});

const wss = new WebSocket.Server({ server });

// Map de clientes
const clients = new Map();

// Controle de canal (PTT real)
let currentTransmitter = null;

wss.on('connection', (ws) => {

    const clientId = uuidv4().substring(0, 8);
    clients.set(ws, clientId);

    const currentClients = Array.from(clients.values());

    ws.send(JSON.stringify({
        type: "init",
        id: clientId,
        clients: currentClients
    }));

    broadcast(JSON.stringify({ type: "new_peer", id: clientId }), ws);

    ws.on('message', (data) => {

        // ÁUDIO BINÁRIO
        if (Buffer.isBuffer(data)) {
            if (currentTransmitter === clientId) {
                broadcast(data, ws);
            }
            return;
        }

        try {
            const msg = JSON.parse(data);
            msg.from = clientId;

            switch (msg.type) {

                case "start_tx":
                    if (!currentTransmitter) {
                        currentTransmitter = clientId;
                        broadcast(JSON.stringify(msg), ws);
                    }
                    break;

                case "stop_tx":
                    if (currentTransmitter === clientId) {
                        currentTransmitter = null;
                        broadcast(JSON.stringify(msg), ws);
                    }
                    break;

                default:
                    if (msg.to) {
                        const targetClient = Array.from(clients.entries())
                            .find(([socket, id]) => id === msg.to);

                        if (targetClient && targetClient[0].readyState === WebSocket.OPEN) {
                            targetClient[0].send(JSON.stringify(msg));
                        }
                    } else {
                        broadcast(JSON.stringify(msg), ws);
                    }
                    break;
            }

        } catch (err) {
            console.error("Erro ao processar mensagem JSON");
        }
    });

    ws.on('close', () => {
        const idLeaving = clients.get(ws);

        if (currentTransmitter === idLeaving) {
            currentTransmitter = null;
            broadcast(JSON.stringify({ type: "stop_tx", id: idLeaving }));
        }

        clients.delete(ws);

        broadcast(JSON.stringify({ type: "peer_left", id: idLeaving }));
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
    console.log(`Servidor Z-Link Talk rodando na porta ${PORT}`);
});