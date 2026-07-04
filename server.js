const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- DATA STRUKTUR STRUKTUR MASA NYATA (REAL-TIME DATA) ---
let currentServing = "-";
let waitingList = [];  // Menyimpan tiket Normal (S)
let priorityList = []; // Menyimpan tiket Priority (P)
let skippedList = [];  // Menyimpan tiket yang di-skip

// Fungsi untuk pancarkan data terkini ke semua web pelanggan & staf secara serentak
function pancarKemaskiniQueue() {
    io.emit('updateQueue', {
        currentServing: currentServing,
        waiting: waitingList,
        priority: priorityList,
        skipped: skippedList
    });
}

// 1. API: Menerima Tiket Baharu dari Pico
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        const tiketUpper = tiket.trim().toUpperCase();
        if (tiketUpper.startsWith('P')) {
            priorityList.push(tiketUpper);
        } else {
            waitingList.push(tiketUpper);
        }
        console.log(`[PICO]: Tiket ${tiketUpper} dimasukkan ke dalam barisan.`);
        pancarKemaskiniQueue(); // Hantar update terus ke web
        res.status(200).json({ status: "berjaya" });
    } else {
        res.status(400).json({ status: "gagal" });
    }
});

// Socket.io Connection Event
io.on('connection', (socket) => {
    console.log('[SOCKET]: Pengguna tersambung.');
    // Hantar data terkini sebaik sahaja ada tab dibuka
    socket.emit('updateQueue', {
        currentServing: currentServing,
        waiting: waitingList,
        priority: priorityList,
        skipped: skippedList
    });
});

// --- API UNTUK BUTANG STAF (CALL NEXT, RECALL, SKIP) ---

// 2. API: CALL NEXT (Utamakan Priority (P) dahulu baru Normal (S))
app.get('/api/panggil-next', (req, res) => {
    if (priorityList.length > 0) {
        currentServing = priorityList.shift();
    } else if (waitingList.length > 0) {
        currentServing = waitingList.shift();
    } else {
        return res.json({ status: "gagal", mesej: "Tiada tiket dalam giliran" });
    }
    
    console.log(`[STAF]: Memanggil tiket baharu: ${currentServing}`);
    pancarKemaskiniQueue();
    res.json({ status: "berjaya", tiket: currentServing });
});

// 3. API: RECALL (Pemicu Bunyi Semula)
app.get('/api/recall', (req, res) => {
    console.log(`[STAF]: Menjalankan Recall untuk tiket: ${currentServing}`);
    // Pancar semula isyarat untuk paksa customer.html bercakap semula
    io.emit('triggerRecallAudio', currentServing);
    res.json({ status: "berjaya" });
});

// 4. API: SKIP TIKET
app.get('/api/skip', (req, res) => {
    if (currentServing !== "-") {
        if (!skippedList.includes(currentServing)) {
            skippedList.push(currentServing);
        }
        console.log(`[STAF]: Tiket ${currentServing} dimasukkan ke senarai Skip.`);
        currentServing = "-";
        pancarKemaskiniQueue();
        res.json({ status: "berjaya" });
    } else {
        res.json({ status: "gagal", mesej: "Tiada tiket aktif untuk di-skip" });
    }
});

// ROUTING HALAMAN WEB
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'staff.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, 'customer.html')));

http.listen(PORT, () => {
    console.log(`Server QSmart+ aktif di port ${PORT}`);
});
