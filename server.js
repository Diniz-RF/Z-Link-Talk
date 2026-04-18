const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid'); // Recomendado: npm install uuid

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor Z-Link Talk Ativo');
});

const wss = new WebSocket.Server({ server });

// Map para guardar clientes e os seus IDs
const clients = new Map();

wss.on('connection', (ws) => {
    // Gerar um ID único para o novo cliente
    const clientId = uuidv4().substring(0, 8);
    clients.set(ws, clientId);

    // 1. Enviar mensagem de inicialização para o cliente que acabou de ligar
    const currentClients = Array.from(clients.values());
    ws.send(JSON.stringify({
        type: "init",
        id: clientId,
        clients: currentClients
    }));

    // 2. Notificar os outros que um novo utilizador entrou
    broadcast(JSON.stringify({ type: "new_peer", id: clientId }), ws);

    ws.on('message', (data) => {
        // Se for áudio (binário), faz broadcast para todos os outros
        if (Buffer.isBuffer(data)) {
            broadcast(data, ws);
            return;
        }

        try {
            const msg = JSON.parse(data);
            
            // Adiciona o ID de quem enviou à mensagem
            msg.from = clientId;

            // Se a mensagem tiver um destinatário ('to'), envia apenas para ele
            if (msg.to) {
                const targetClient = Array.from(clients.entries())
                    .find(([socket, id]) => id === msg.to);
                if (targetClient && targetClient[0].readyState === WebSocket.OPEN) {
                    targetClient[0].send(JSON.stringify(msg));
                }
            } else {
                // Caso contrário, faz broadcast normal (sinalização geral como start_tx/stop_tx)
                broadcast(JSON.stringify(msg), ws);
            }

        } catch (err) {
            console.error("Erro ao processar mensagem JSON");
        }
    });

    ws.on('close', () => {
        const idLeaving = clients.get(ws);
        clients.delete(ws);
        // Notifica os outros que o utilizador saiu
        broadcast(JSON.stringify({ type: "peer_left", id: idLeaving }));
    });
});

// Função auxiliar para enviar a todos, exceto ao remetente
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