const express = require('express');
const WebSocket = require('ws');
const http = require('http');

// Create an Express app
const app = express();
const server = http.createServer(app);

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

let state = {
    currentTabIndex: 0,
    imageUrls: [],
    drawingData: [],
};

// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Broadcast to all clients
function broadcast(data, sender = null) {
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('error', (error) => {
    console.error("WebSocket server error:", error);
});


// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('A new client connected.');

    // Send initial state to the newly connected client
    ws.send(JSON.stringify({ type: 'syncState', state }));

    ws.on('message', (message) => {
        console.log('Received message:', message);

        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error("Error parsing message:", error);
            return;
        }

        switch (data.type) {
            case 'beginStroke':
                broadcast(JSON.stringify({ type: 'beginStroke' }), ws);
                break;

            case 'draw':
				state.drawingData.push({
					x: data.x,
					y: data.y,
					lineWidth: data.lineWidth,
					color: data.color
				});
				broadcast(JSON.stringify({ type: 'draw', x: data.x, y: data.y, lineWidth: data.lineWidth, color: data.color }), ws);
				break;


            case 'switchTabs':
				state.currentTabIndex = data.index;
				broadcast(JSON.stringify({ type: 'switchTabs', index: data.index }));
				break;
				
            case 'imageChange':
                state.imageUrls = data.imageUrls;
                broadcast(JSON.stringify({ type: 'imageChange', imageUrls: data.imageUrls }));
                break;

            case 'clear':
                state.drawingData = []; // Clear stored drawings
                broadcast(JSON.stringify({ type: 'clear' }), ws);
                break;
			
            case 'ping': // Respond to ping from the client
                ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                console.warn(`Unknown message type: ${data.type}`);
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start the server
server.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});
