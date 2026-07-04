const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- SIMPANAN DATA GILIRAN ---
let senaraiTiket = []; 
let tiketSemasa = "---";
let statusPanggilanBaru = false; // Flag untuk bagitahu web customer ada nombor baru masuk

// 1. API: Menerima Tiket Baharu dari Pico
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        senaraiTiket.push(tiket);
        console.log(`[SERVER]: Tiket ${tiket} dimasukkan dalam senarai.`);
        res.status(200).json({ status: "berjaya" });
    } else {
        res.status(400).json({ status: "gagal" });
    }
});

// 2. API: Statistik untuk Web Staf
app.get('/api/statistik', (req, res) => {
    const jumlahPrio = senaraiTiket.filter(t => t.startsWith('P')).length;
    const jumlahStd = senaraiTiket.filter(t => t.startsWith('S')).length;
    res.json({
        total: senaraiTiket.length,
        prio: jumlahPrio,
        std: jumlahStd
    });
});

// 3. API: Staf Panggil Tiket (CALL NEXT) -> Sini punca bunyi/pergerakan!
app.get('/api/panggil-next', (req, res) => {
    if (senaraiTiket.length > 0) {
        tiketSemasa = senaraiTiket.shift(); 
        statusPanggilanBaru = true; // Aktifkan flag supaya web customer tahu kena berbunyi & bertukar!
        console.log(`[SERVER]: Memanggil tiket baharu: ${tiketSemasa}`);
        res.json({ status: "berjaya", tiket: tiketSemasa });
    } else {
        res.json({ status: "gagal", tiket: null });
    }
});

// 4. API: Diakses oleh customer.html secara "polling" untuk semak nombor & bunyi
app.get('/api/tiket-semasa', (req, res) => {
    res.json({ 
        tiket: tiketSemasa,
        bunyi: statusPanggilanBaru // Hantar status sama ada perlu bunyikan suara/buzzer atau tidak
    });
});

// 5. API: Reset flag bunyi selepas web customer selesai berbunyi
app.post('/api/reset-bunyi', (req, res) => {
    statusPanggilanBaru = false;
    res.json({ status: "ok" });
});

// --- ROUTING HALAMAN WEB ---
app.get('/staff', (req, res) => {
    res.sendFile(path.join(__dirname, 'staff.html'));
});

app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'customer.html'));
});

app.listen(PORT, () => {
    console.log(`Server Klinik Q-Smart berjalan lancar di port ${PORT}`);
});
