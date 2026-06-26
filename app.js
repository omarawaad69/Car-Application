let device, server, txCharacteristic;
let obdCodes = {};

// تحميل قاعدة بيانات الأعطال الموسعة مع إظهار تفاصيل الخطأ
fetch('obd_codes.json?v=1')
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(data => obdCodes = data)
  .catch(err => alert('فشل تحميل قاعدة البيانات: ' + err.message));

const connectBtn = document.getElementById('connectBtn');
const readDtcBtn = document.getElementById('readDtcBtn');
const liveDataBtn = document.getElementById('liveDataBtn');
const statusEl = document.getElementById('status');
const dtcList = document.getElementById('dtcList');
const liveValue = document.getElementById('liveValue');

const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'.toLowerCase();
const TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'.toLowerCase();

async function connect() {
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'V' }, { namePrefix: 'OBD' }, { namePrefix: 'ELM' }],
      optionalServices: [UART_SERVICE_UUID, '0000ffe0-0000-1000-8000-00805f9b34fb']
    });
    server = await device.gatt.connect();
    let service;
    try {
      service = await server.getPrimaryService(UART_SERVICE_UUID);
    } catch {
      service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    }
    txCharacteristic = await service.getCharacteristic(TX_CHAR_UUID);
    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', handleOBDResponse);
    statusEl.textContent = 'متصل';
    statusEl.className = 'status connected';
    readDtcBtn.disabled = false;
    liveDataBtn.disabled = false;
    await sendOBDCommand('ATZ\r');
    await delay(1000);
    await sendOBDCommand('ATE0\r');
    await sendOBDCommand('ATSP0\r');
  } catch (err) {
    alert('فشل الاتصال: ' + err);
  }
}

function handleOBDResponse(event) {
  const value = event.target.value;
  let text = new TextDecoder().decode(value);
  if (text.includes('43')) {
    parseDTCs(text);
  } else if (text.includes('41 0C')) {
    parseRPM(text);
  }
}

async function sendOBDCommand(cmd) {
  const encoder = new TextEncoder();
  await txCharacteristic.writeValue(encoder.encode(cmd));
}

async function readDTCs() {
  dtcList.innerHTML = '... جاري القراءة';
  await sendOBDCommand('03\r');
}

async function readLiveRPM() {
  await sendOBDCommand('01 0C\r');
}

function parseDTCs(response) {
  const lines = response.split('\r').filter(l => l.startsWith('43'));
  let hexCodes = '';
  lines.forEach(line => {
    const parts = line.replace('>', '').trim().split(' ');
    hexCodes += parts.slice(1).join('').substring(0, parts.length*2);
  });
  let dtcs = [];
  for (let i = 0; i < hexCodes.length; i += 4) {
    let code = hexCodes.substring(i, i+4);
    if (code === '0000') continue;
    dtcs.push(decodeDTC(code));
  }
  displayDTCs(dtcs);
}

function decodeDTC(hex) {
  const bytes = [hex.substring(0,2), hex.substring(2,4)];
  let firstChar = 'P';
  const fb = parseInt(bytes[0], 16);
  if ((fb & 0xC0) === 0) firstChar = 'P';
  else if ((fb & 0xC0) === 0x40) firstChar = 'C';
  else if ((fb & 0xC0) === 0x80) firstChar = 'B';
  else if ((fb & 0xC0) === 0xC0) firstChar = 'U';
  let d1 = (fb >> 4) & 0x03;
  let d2 = fb & 0x0F;
  return firstChar + d1 + d2 + bytes[1];
}

function displayDTCs(codes) {
  dtcList.innerHTML = '';
  if (!codes.length) {
    dtcList.innerHTML = '<p>✅ لا توجد أعطال مخزنة.</p>';
    return;
  }
  codes.forEach(code => {
    const info = obdCodes[code] || { en: 'Unknown code', ar: 'كود غير معروف' };
    const div = document.createElement('div');
    div.className = 'dtc-item';
    div.innerHTML = `
      <div class="dtc-code">${code}</div>
      <div class="desc-en">🇬🇧 ${info.en}</div>
      <div class="desc-ar">🇸🇦 ${info.ar}</div>
      <button class="search-btn" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(code + ' car repair solutions')}','_blank')">🔎 ابحث عن حلول</button>
    `;
    dtcList.appendChild(div);
  });
}

function parseRPM(data) {
  const match = data.match(/41 0C ([0-9A-F]{2}) ([0-9A-F]{2})/i);
  if (match) {
    const A = parseInt(match[1], 16);
    const B = parseInt(match[2], 16);
    const rpm = (A * 256 + B) / 4;
    liveValue.innerHTML = `⏱️ ${Math.round(rpm)} RPM`;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

connectBtn.addEventListener('click', connect);
readDtcBtn.addEventListener('click', readDTCs);
liveDataBtn.addEventListener('click', readLiveRPM);

// ---------- آلية التحديث الصامت (مُعطَّلة مؤقتاً) ----------
// ستُفعَّل بعد حل المشكلة
