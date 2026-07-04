const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Balut dengan try-catch supaya kalau port USB tak wujud (di Cloud), server tak crash
let port = null;
let parser = null;

try {
    // Gantikan 'COM3' dengan port laptop anda jika berbeza, tetapi letak try-catch ini
    port = new SerialPort({ path: 'COM3', baudRate: 9600 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
        const noTiket = data.trim();
        if (noTiket) {
            console.log(`[USB DATA]: ${noTiket}`);
            io.emit('tiketBaru', noTiket);
        }
    });
    console.log("USB Serial Port berjaya diaktifkan (Mod Laptop).");
} catch (err) {
    console.log("Amaran: Tiada USB Serial Port dikesan. Server berjalan dalam Mod Cloud/WiFi sahaja.");
}
