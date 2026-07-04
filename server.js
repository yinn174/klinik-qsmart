const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- TEMPAT SIMPANAN DATA TIKET SECARA BERPUSAT ---
let senaraiTiket = []; 
let tiketSemasa = "---";

// 1. API: Menerima Tiket Baharu dari Pico / Web
app.post('/api/tiket', (req, res) => {
    const { tiket } = req.body;
    if (tiket) {
        senaraiTiket.push(tiket);
        console.log(`[SERVER]: Tiket ${tiket} diterima masuk senarai.`);
        res.status(200).json({ status: "berjaya" });
    } else {
        res.status(400).json({ status: "gagal" });
    }
});

// 2. API: Mengira Statistik Bilangan Menunggu untuk Skrin Staf
app.get('/api/statistik', (req, res) => {
    // Tapis dan kira pecahan mengikut huruf permulaan tiket
    const jumlahPrio = senaraiTiket.filter(t => t.startsWith('P')).length;
    const jumlahStd = senaraiTiket.filter(t => t.startsWith('S')).length;
    
    res.json({
        total: senaraiTiket.length,
        prio: jumlahPrio,
        std: jumlahStd
    });
});

// 3. API: Staf Panggil Tiket Seterusnya (CALL NEXT)
app.get('/api/panggil-next', (req, res) => {
    if (senaraiTiket.length > 0) {
        tiketSemasa = senaraiTiket.shift(); 
        console.log(`[SERVER]: Panggil tiket: ${tiketSemasa}`);
        res.json({ status: "berjaya", tiket: tiketSemasa });
    } else {
        res.json({ status: "gagal", tiket: null });
    }
});

// 4. API: Ambil Status Tiket Semasa untuk customer.html
app.get('/api/tiket-semasa', (req, res) => {
    res.json({ tiket: tiketSemasa });
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
