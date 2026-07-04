const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- TEMPAT SIMPANAN DATA MASA NYATA ---
let currentServing = "-";
let waitingList = [];  // Kategori Normal (A)
let priorityList = []; // Kategori Priority (P)
let skippedList = [];  

// Kaunter turutan untuk sistem Kiosk Digital
let nextNormalCount = 1;
let nextPriorityCount = 1;

function pancarKemaskiniQueue() {
    io.emit('updateQueue', {
        currentServing: currentServing,
        waiting: waitingList,
        priority: priorityList,
        skipped: skippedList
    });
}

// 1. INPUT HARDWARE: Terima data daripada butang fizikal Pico
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        const tUpper = tiket.trim().toUpperCase();
        if (tUpper.startsWith('P')) {
            priorityList.push(tUpper);
        } else {
            waitingList.push(tUpper);
        }
        console.log(`[PICO]: Tiket ${tUpper} dimasukkan.`);
        pancarKemaskiniQueue();
        res.status(200).json({ status: "berjaya" });
    } else {
        res.status(400).json({ status: "gagal" });
    }
});

// CONNECTION EVENT: Socket.io
io.on('connection', (socket) => {
    console.log('[SOCKET]: Pelanggan/Staf terhubung.');
    
    socket.emit('updateQueue', {
        currentServing: currentServing,
        waiting: waitingList,
        priority: priorityList,
        skipped: skippedList
    });

    // 2. INPUT DIGITAL: Menjana tiket terus dari portal pelanggan (Self-Service)
    socket.on('generateTicket', (data) => {
        let newTicket = "";
        if (data.type === 'P') {
            newTicket = "P" + String(nextPriorityCount).padStart(3, '0');
            nextPriorityCount++;
            priorityList.push(newTicket);
        } else {
            newTicket = "S" + String(nextNormalCount).padStart(3, '0');
            nextNormalCount++;
            waitingList.push(newTicket);
        }
        
        console.log(`[KIOSK DIGITAL]: Tiket ${newTicket} dijana.`);
        // Hantar maklum balas kepada pemohon tiket sahaja
        socket.emit('ticketGenerated', newTicket);
        // Kemas kini keseluruhan senarai ke semua skrin
        pancarKemaskiniQueue();
    });
});

// --- API KAWALAN STAF ---
app.get('/api/panggil-next', (req, res) => {
    if (priorityList.length > 0) {
        currentServing = priorityList.shift();
    } else if (waitingList.length > 0) {
        currentServing = waitingList.shift();
    } else {
        return res.json({ status: "gagal", mesej: "Tiada tiket" });
    }
    console.log(`[STAF]: Panggil ${currentServing}`);
    pancarKemaskiniQueue();
    res.json({ status: "berjaya", tiket: currentServing });
});

app.get('/api/recall', (req, res) => {
    io.emit('triggerRecallAudio', currentServing);
    res.json({ status: "berjaya" });
});

app.get('/api/skip', (req, res) => {
    if (currentServing !== "-") {
        if (!skippedList.includes(currentServing)) skippedList.push(currentServing);
        currentServing = "-";
        pancarKemaskiniQueue();
        res.json({ status: "berjaya" });
    } else {
        res.json({ status: "gagal" });
    }
});

// ROUTING
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'staff.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, 'customer.html')));

http.listen(PORT, () => {
    console.log(`Sistem QSmart+ Kiosk Kesihatan aktif di port ${PORT}`);
});
