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
let waitingList = [];  // Kategori Normal (S)
let priorityList = []; // Kategori Priority (P)
let skippedList = [];  

// --- PEMBOLEHUBAH PEMBILANG NOMBOR BERSAMBUNG ---
let normalCounter = 0;   // Menjaga turutan bersambung Siri S
let priorityCounter = 0; // Menjaga turutan bersambung Siri P

// Pembolehubah untuk mengawal had keutamaan adil (Fairness Control)
let priorityCalledCount = 0; 

function pancarKemaskiniQueue() {
    io.emit('updateQueue', {
        currentServing: currentServing,
        waiting: waitingList,
        priority: priorityList,
        skipped: skippedList
    });
}

// 1. INPUT HARDWARE: Terima isyarat daripada butang fizikal Pico
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        const tUpper = tiket.trim().toUpperCase();
        let nomborFormatBaru = "";

        // Mengesan jenis request dari Pico dan menjana nombor siri bersambung secara dinamik
        if (tUpper.startsWith('P')) {
            priorityCounter++;
            // Menukar angka (cth: 5) menjadi format string 4 digit (cth: "P0005")
            nomborFormatBaru = `P${String(priorityCounter).padStart(4, '0')}`;
            priorityList.push(nomborFormatBaru);
        } else {
            normalCounter++;
            // Menukar angka (cth: 12) menjadi format string 4 digit (cth: "S0012")
            nomborFormatBaru = `S${String(normalCounter).padStart(4, '0')}`;
            waitingList.push(nomborFormatBaru);
        }

        console.log(`[SERVER]: Tiket ${nomborFormatBaru} berjaya dijana secara bersambung.`);
        pancarKemaskiniQueue();
        res.status(200).json({ status: "berjaya", tiket: nomborFormatBaru });
    } else {
        res.status(400).json({ status: "gagal" });
    }
});

// CONNECTION EVENT: Socket.io
io.on('connection', (socket) => {
    console.log('[SOCKET]: Pelanggan/Staf terhubung.');
    pancarKemaskiniQueue();
});

// --- API KAWALAN STAF (LOGIK ADIL NISBAH 2:1) ---
app.get('/api/panggil-next', (req, res) => {
    
    // Syarat 1: Jika ada Priority DAN belum cukup had panggil 2 kali berturut-turut, UTAMAKAN Priority
    if (priorityList.length > 0 && (priorityCalledCount < 2 || waitingList.length === 0)) {
        currentServing = priorityList.shift();
        priorityCalledCount++; 
        console.log(`[STAF]: Panggil Priority ${currentServing} (Had: ${priorityCalledCount}/2)`);
    } 
    // Syarat 2: Jika sudah panggil 2 Priority berturut-turut, atau tiada Priority, WAJIB panggil Normal
    else if (waitingList.length > 0) {
        currentServing = waitingList.shift();
        priorityCalledCount = 0; 
        console.log(`[STAF]: Panggil Normal ${currentServing} (Had Priority di-reset)`);
    } 
    // Syarat 3: Jika tiada langsung sesiapa dalam kedua-dua barisan
    else {
        return res.json({ status: "gagal", mesej: "Tiada tiket" });
    }
    
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
        priorityCalledCount = 0; // Mengelakkan pepijat limpahan logik keutamaan nisbah selepas skip
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
    console.log(`Sistem QSmart+ aktif di port ${PORT}`);
});
