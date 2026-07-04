const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(express.static(__dirname));

// Route Utama (Saja untuk semak status server)
app.get('/', (req, res) => {
    res.send('<h1>Server Klinik Q-Smart Aktif di Cloud!</h1>');
});

// Endpoint yang akan dipanggil oleh Pico melalui WiFi
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        console.log(`[WIFI DATA MASUK]: ${tiket}`);
        io.emit('tiketBaru', tiket); // Hantar ke skrin staff & customer
        return res.status(200).json({ success: true, message: 'Tiket berjaya diterima' });
    }
    return res.status(400).json({ success: false, message: 'Tiket kosong' });
});

io.on('connection', (socket) => {
    console.log('Ada peranti (Web/Telefon) bersambung ke Socket.io');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server sedang berjalan lancar di port ${PORT}`);
});
