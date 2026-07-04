const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Menyediakan fail statik & membenarkan pembacaan JSON (Wajib untuk WiFi)
app.use(express.static(__dirname));
app.use(express.json());

// ==========================================================
// 1. LALUAN API (HTTP POST): TERIMA DATA DARI PICO VIA WIFI
// ==========================================================
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (!tiket) {
        return res.status(400).json({ success: false, message: "Tiada data tiket" });
    }
    const ticketNumber = tiket.trim().toUpperCase();
    console.log(`[PICO WIFI]: 📡 Terima tiket baru via WiFi -> ${ticketNumber}`);
    
    processNewTicket(ticketNumber);
    return res.json({ success: true, message: `Tiket ${ticketNumber} diproses` });
});

// ==========================================================
// 2. TETAPAN SERIALPORT: TERIMA DATA DARI PICO VIA KABEL USB
// ==========================================================
// ⚠️ SILA PASTIKAN PORT 'COM4' INI SAMA SEPERTI DI ARDUINO IDE ANDA
const PICO_PORT = 'COM4'; 
let port, parser;

function sambungSerial() {
    port = new SerialPort({ path: PICO_PORT, baudRate: 9600, autoOpen: false });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.open((err) => {
        if (err) {
            console.log(`\n[SERIAL]: Port ${PICO_PORT} tidak dibuka (Sistem berjalan dalam mod WiFi sahaja).`);
            console.log(`👉 Jika mahu guna kabel, sila pastikan USB dipasang dan Serial Monitor Arduino ditutup.`);
            return;
        }
        console.log(`\n==================================================`);
        console.log(`🎉 [SERIAL]: BACK-UP USB PADA ${PICO_PORT} SEDIA DIGUNAKAN!`);
        console.log(`==================================================`);
    });

    parser.on('data', (data) => {
        const ticketNumber = data.trim().toUpperCase();
        console.log(`[PICO USB]: 🔌 Terima tiket baru via USB -> ${ticketNumber}`);
        if (ticketNumber.startsWith('S') || ticketNumber.startsWith('P')) {
            processNewTicket(ticketNumber);
        }
    });
}
sambungSerial();

// ==========================================================
// 3. FUNGSI UTAMA: MEMPROSES & MENYIMPAN DATA TIKET
// ==========================================================
function processNewTicket(ticketNumber) {
    fs.readFile('queue.json', 'utf8', (err, jsonString) => {
        if (err) return console.error("Gagal membaca queue.json:", err);
        let queueData = JSON.parse(jsonString);

        if (ticketNumber.startsWith('P')) {
            if (!queueData.priority.includes(ticketNumber)) queueData.priority.push(ticketNumber);
        } else {
            if (!queueData.waiting.includes(ticketNumber)) queueData.waiting.push(ticketNumber);
        }

        if (queueData.nextQueue === "-") {
            if (queueData.priority.length > 0) queueData.nextQueue = queueData.priority[0];
            else if (queueData.waiting.length > 0) queueData.nextQueue = queueData.waiting[0];
        }

        fs.writeFile('queue.json', JSON.stringify(queueData, null, 2), (err) => {
            if (err) return console.error("Gagal menulis ke queue.json:", err);
            io.emit('updateQueue', queueData);
        });
    });
}

// ==========================================================
// 4. KOMUNIKASI REAL-TIME SOCKET.IO (PORTAL WEB STAF)
// ==========================================================
io.on('connection', (socket) => {
    fs.readFile('queue.json', 'utf8', (err, jsonString) => {
        if (!err) socket.emit('updateQueue', JSON.parse(jsonString));
    });

    socket.on('callNext', () => {
        fs.readFile('queue.json', 'utf8', (err, jsonString) => {
            if (err) return;
            let queueData = JSON.parse(jsonString);

            if (queueData.priority.length > 0) {
                queueData.currentServing = queueData.priority.shift();
                queueData.servedCount++;
            } else if (queueData.waiting.length > 0) {
                queueData.currentServing = queueData.waiting.shift();
                queueData.servedCount++;
            } else {
                queueData.currentServing = "-";
            }

            if (queueData.priority.length > 0) queueData.nextQueue = queueData.priority[0];
            else if (queueData.waiting.length > 0) queueData.nextQueue = queueData.waiting[0];
            else queueData.nextQueue = "-";

            fs.writeFile('queue.json', JSON.stringify(queueData, null, 2), (err) => {
                if (!err) io.emit('updateQueue', queueData);
            });
        });
    });

    socket.on('skipCurrent', () => {
        fs.readFile('queue.json', 'utf8', (err, jsonString) => {
            if (err) return;
            let queueData = JSON.parse(jsonString);

            if (queueData.currentServing !== "-") {
                queueData.skipped.push(queueData.currentServing);
                queueData.currentServing = "-";
            }

            if (queueData.priority.length > 0) queueData.nextQueue = queueData.priority[0];
            else if (queueData.waiting.length > 0) queueData.nextQueue = queueData.waiting[0];
            else queueData.nextQueue = "-";

            fs.writeFile('queue.json', JSON.stringify(queueData, null, 2), (err) => {
                if (!err) io.emit('updateQueue', queueData);
            });
        });
    });
});

// ==========================================================
// 5. MENGHIDUPKAN SERVER
// ==========================================================
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Server QSmart+ Dual-Mode (WiFi + USB) diaktifkan!`);
    console.log(`📡 URL Portal: http://localhost:${PORT}/staff.html`);
    console.log(`==================================================`);
});