let device, server, txCharacteristic;
let obdCodes = {};
let connected = false;
let currentRPM = 0;
let dtcHistory = JSON.parse(localStorage.getItem('obdHistory') || '[]');

// تحميل قاعدة البيانات
fetch('obd_codes.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => obdCodes = data)
  .catch(err => showToast('فشل تحميل قاعدة البيانات: ' + err.message, 'error'));

const connectBtn = document.getElementById('connectBtn');
const readDtcBtn = document.getElementById('readDtcBtn');
const clearDtcBtn = document.getElementById('clearDtcBtn');
const liveDataBtn = document.getElementById('liveDataBtn');
const led = document.getElementById('ledIndicator');
const connText = document.getElementById('connectionText');
const dtcList = document.getElementById('dtcList');
const noDtcMsg = document.getElementById('noDtcMessage');
const rpmValue = document.getElementById('rpmValue');
const rpmGauge = document.getElementById('rpmGauge');
const dtcCountEl = document.getElementById('dtcCount');
const toastContainer = document.getElementById('toastContainer');
const historyModal = document.getElementById('historyModal');
const historyList = document.getElementById('historyList');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const liveDataPanel = document.getElementById('liveDataPanel');
const liveValues = document.getElementById('liveValues');

const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Toast
function showToast(msg, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
}

// تحديث واجهة الاتصال
function updateConnectionUI(active) {
  connected = active;
  if (active) {
    led.className = 'led online';
    connText.textContent = 'متصل';
    readDtcBtn.disabled = false;
    clearDtcBtn.disabled = false;
    liveDataBtn.disabled = false;
  } else {
    led.className = 'led offline';
    connText.textContent = 'غير متصل';
    readDtcBtn.disabled = true;
    clearDtcBtn.disabled = true;
    liveDataBtn.disabled = true;
  }
}

// الاتصال
async function connect() {
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'V' }, { namePrefix: 'OBD' }, { namePrefix: 'ELM' }],
      optionalServices: [UART_SERVICE, '0000ffe0-0000-1000-8000-00805f9b34fb']
    });
    server = await device.gatt.connect();
    let service = await server.getPrimaryService(UART_SERVICE).catch(() => server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb'));
    txCharacteristic = await service.getCharacteristic(TX_CHAR);
    await txCharacteristic.startNotifications();
    txCharacteristic.addEventListener('characteristicvaluechanged', handleOBDResponse);
    updateConnectionUI(true);
    showToast('تم الاتصال بـ ' + device.name, 'success');
    await sendCmd('ATZ\r'); await delay(800);
    await sendCmd('ATE0\r'); await sendCmd('ATSP0\r');
  } catch (err) {
    showToast('فشل الاتصال: ' + err.message, 'error');
    updateConnectionUI(false);
  }
}

function handleOBDResponse(event) {
  let text = new TextDecoder().decode(event.target.value);
  if (text.includes('43')) parseDTCs(text);
  else if (text.includes('41 0C')) parseRPM(text);
}

async function sendCmd(cmd) {
  if (!txCharacteristic) return;
  await txCharacteristic.writeValue(new TextEncoder().encode(cmd));
}

async function readDTCs() {
  dtcList.innerHTML = '';
  noDtcMsg.classList.add('hidden');
  showToast('جاري قراءة الأعطال...');
  await sendCmd('03\r');
}

async function clearDTCs() {
  if (!confirm('هل أنت متأكد من مسح جميع الأعطال المخزنة؟')) return;
  await sendCmd('04\r');
  showToast('تم إرسال أمر مسح الأعطال', 'success');
  dtcList.innerHTML = '';
  noDtcMsg.classList.remove('hidden');
  dtcCountEl.textContent = '0';
}

async function readLiveData() {
  liveDataPanel.classList.toggle('hidden');
  if (!liveDataPanel.classList.contains('hidden')) {
    await sendCmd('01 0C\r');
  }
}

function parseDTCs(response) {
  const lines = response.split('\r').filter(l => l.startsWith('43'));
  let hex = '';
  lines.forEach(l => { const p = l.replace('>','').trim().split(' '); hex += p.slice(1).join('').substring(0, p.length*2); });
  let dtcs = [];
  for (let i = 0; i < hex.length; i+=4) {
    let c = hex.substring(i,i+4);
    if (c !== '0000') dtcs.push(decodeDTC(c));
  }
  displayDTCs(dtcs);
}

function decodeDTC(hex) {
  let fb = parseInt(hex.substring(0,2), 16);
  let prefix = 'P';
  if ((fb & 0xC0) === 0x40) prefix = 'C';
  else if ((fb & 0xC0) === 0x80) prefix = 'B';
  else if ((fb & 0xC0) === 0xC0) prefix = 'U';
  return prefix + ((fb >> 4) & 0x03) + (fb & 0x0F) + hex.substring(2);
}

function displayDTCs(codes) {
  dtcList.innerHTML = '';
  if (!codes.length) {
    noDtcMsg.classList.remove('hidden');
    dtcCountEl.textContent = '0';
    return;
  }
  noDtcMsg.classList.add('hidden');
  dtcCountEl.textContent = codes.length;
  // حفظ في السجل
  const timestamp = new Date().toLocaleString('ar-EG');
  codes.forEach(code => {
    dtcHistory.unshift({ code, timestamp });
    if (dtcHistory.length > 50) dtcHistory.pop();
  });
  localStorage.setItem('obdHistory', JSON.stringify(dtcHistory));

  codes.forEach(code => {
    const info = obdCodes[code] || { en: 'كود غير معروف', ar: 'كود غير معروف' };
    const div = document.createElement('div');
    div.className = 'dtc-item';
    div.innerHTML = `
      <div class="dtc-code">${code}</div>
      <div class="desc-en"><i class="fas fa-language"></i> ${info.en}</div>
      <div class="desc-ar"><i class="fas fa-language"></i> ${info.ar}</div>
      <button class="search-btn" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(code + ' car repair')}','_blank')">
        <i class="fas fa-search"></i> ابحث عن حلول
      </button>
    `;
    dtcList.appendChild(div);
  });
}

function parseRPM(data) {
  const m = data.match(/41 0C ([0-9A-F]{2}) ([0-9A-F]{2})/i);
  if (m) {
    currentRPM = Math.round((parseInt(m[1],16)*256 + parseInt(m[2],16))/4);
    rpmValue.textContent = currentRPM;
    const angle = Math.min(360, (currentRPM / 8000) * 360);
    rpmGauge.style.background = `conic-gradient(var(--accent-blue) ${angle}deg, #2a3a4a 0deg)`;
    liveValues.innerHTML = `<p>سرعة المحرك: <strong>${currentRPM} RPM</strong></p>`;
  }
}

// السجل
function showHistory() {
  historyList.innerHTML = dtcHistory.length ? dtcHistory.map(h => `<p><strong>${h.code}</strong> - ${h.timestamp}</p>`).join('') : '<p>لا يوجد سجل</p>';
  historyModal.classList.remove('hidden');
}
refreshHistoryBtn.addEventListener('click', showHistory);
closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
clearHistoryBtn.addEventListener('click', () => {
  dtcHistory = [];
  localStorage.removeItem('obdHistory');
  showHistory();
  showToast('تم مسح السجل', 'success');
});

connectBtn.addEventListener('click', connect);
readDtcBtn.addEventListener('click', readDTCs);
clearDtcBtn.addEventListener('click', clearDTCs);
liveDataBtn.addEventListener('click', readLiveData);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
