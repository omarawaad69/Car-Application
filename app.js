// ========== قائمة مفاتيح الترخيص ==========
const VALID_KEYS = [
  "OBD-1234-5678",
  "OBD-8765-4321",
  "OBD-0054-0080", 
  "OBD-1203-9252", 
  "ODB-1572-5484" 
];

// ========== دوال معرف الجهاز ==========
function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'DEV-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// ========== التفعيل المحلي ==========
function isLicenseActivated() {
  const licenseData = localStorage.getItem('licenseData');
  if (!licenseData) return false;
  try {
    const data = JSON.parse(licenseData);
    return VALID_KEYS.includes(data.key) && data.deviceId === getDeviceId();
  } catch { return false; }
}

function activateLicense(key) {
  if (!VALID_KEYS.includes(key)) return { success: false, message: "مفتاح غير صحيح" };
  const deviceId = getDeviceId();
  localStorage.setItem('licenseData', JSON.stringify({ key, deviceId }));
  localStorage.setItem('licenseActivated', 'true');
  return { success: true };
}

// ========== إعدادات اللغة ==========
const translations = {
  ar: {
    activateTitle: "تفعيل التطبيق",
    activateDesc: "أدخل مفتاح الترخيص للاستمرار",
    activateBtn: "تفعيل",
    invalidKey: "مفتاح غير صحيح، حاول مرة أخرى",
    onboarding1Title: "افحص سيارتك بنفسك",
    onboarding1Desc: "اقرأ أعطال المحرك مباشرة من العقل الإلكتروني",
    onboarding2Title: "ابحث عن حلول فورية",
    onboarding2Desc: "اضغط على أي كود وابحث في الإنترنت عن أسبابه",
    onboarding3Title: "وفر وقتك ومالك",
    onboarding3Desc: "لا داعي لزيارة الميكانيكي قبل معرفة المشكلة",
    skip: "تخطي",
    next: "التالي",
    start: "ابدأ",
    disconnected: "انقطع اتصال البلوتوث",
    reconnect: "إعادة الاتصال",
    notConnected: "غير متصل",
    connectBtn: "اتصال بالسيارة",
    errorCount: "خطأ",
    readDtc: "قراءة الأعطال",
    clearDtc: "مسح الأعطال",
    liveData: "بيانات حية",
    loading: "جاري قراءة الأعطال...",
    noDtc: "لا توجد أعطال مخزنة في وحدة التحكم.",
    liveDataTitle: "بيانات حية",
    historyTitle: "سجل الأعطال السابقة",
    refresh: "تحديث",
    clearHistory: "مسح السجل",
    settingsTitle: "الإعدادات",
    language: "اللغة",
    deviceIdLabel: "معرف الجهاز",
    darkMode: "الوضع الليلي",
    exportReport: "تصدير تقرير الأعطال"
  },
  en: {
    activateTitle: "Activate App",
    activateDesc: "Enter license key to continue",
    activateBtn: "Activate",
    invalidKey: "Invalid key, try again",
    onboarding1Title: "Diagnose Your Car",
    onboarding1Desc: "Read engine faults directly from the ECU",
    onboarding2Title: "Find Instant Solutions",
    onboarding2Desc: "Tap any code and search online for causes",
    onboarding3Title: "Save Time & Money",
    onboarding3Desc: "No need to visit a mechanic before knowing the issue",
    skip: "Skip",
    next: "Next",
    start: "Start",
    disconnected: "Bluetooth Disconnected",
    reconnect: "Reconnect",
    notConnected: "Disconnected",
    connectBtn: "Connect to Car",
    errorCount: "Errors",
    readDtc: "Read Faults",
    clearDtc: "Clear Faults",
    liveData: "Live Data",
    loading: "Reading faults...",
    noDtc: "No fault codes stored.",
    liveDataTitle: "Live Data",
    historyTitle: "Fault History",
    refresh: "Refresh",
    clearHistory: "Clear History",
    settingsTitle: "Settings",
    language: "Language",
    deviceIdLabel: "Device ID",
    darkMode: "Dark Mode",
    exportReport: "Export Fault Report"
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';
function t(key) { return translations[currentLang]?.[key] || translations.ar[key] || key; }
function applyLanguage() {
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = t(key);
    } else {
      el.textContent = t(key);
    }
  });
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  localStorage.setItem('lang', currentLang);
}

// ========== الوضع الليلي ==========
function applyTheme() {
  const isDark = localStorage.getItem('darkMode') !== 'false';
  document.body.classList.toggle('light-mode', !isDark);
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) darkModeToggle.checked = isDark;
}

// ========== المتغيرات العامة ==========
let device, server, txCharacteristic;
let obdCodes = {};
let connected = false;
let currentRPM = 0;
let dtcHistory = JSON.parse(localStorage.getItem('obdHistory') || '[]');
let currentDTCs = [];

// ========== Onboarding ==========
function showOnboarding() {
  document.getElementById('onboardingModal').classList.remove('hidden');
  document.getElementById('onboardingModal').style.display = 'flex';
  let currentSlide = 1;
  const nextBtn = document.getElementById('nextOnboarding');
  const finishBtn = document.getElementById('finishOnboarding');
  const skipBtn = document.getElementById('skipOnboarding');

  function updateSlide(n) {
    document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
    const slide = document.querySelector(`[data-slide="${n}"]`);
    const dot = document.querySelector(`[data-dot="${n}"]`);
    if (slide) slide.classList.add('active');
    if (dot) dot.classList.add('active');
    if (n === 3) {
      nextBtn.classList.add('hidden');
      finishBtn.classList.remove('hidden');
    } else {
      nextBtn.classList.remove('hidden');
      finishBtn.classList.add('hidden');
    }
  }

  nextBtn.onclick = () => { currentSlide++; if (currentSlide <= 3) updateSlide(currentSlide); };
  finishBtn.onclick = () => { document.getElementById('onboardingModal').style.display = 'none'; };
  skipBtn.onclick = () => { document.getElementById('onboardingModal').style.display = 'none'; };
}

// ========== بدء التطبيق ==========
if (isLicenseActivated()) {
  document.getElementById('licenseModal').style.display = 'none';
  if (!localStorage.getItem('onboardingSeen')) {
    showOnboarding();
    localStorage.setItem('onboardingSeen', 'true');
  }
  showApp();
} else {
  document.getElementById('licenseModal').style.display = 'flex';
}

document.getElementById('activateBtn').addEventListener('click', () => {
  const key = document.getElementById('licenseKeyInput').value.trim();
  const errorEl = document.getElementById('licenseError');
  if (!key) return;
  const result = activateLicense(key);
  if (result.success) {
    document.getElementById('licenseModal').style.display = 'none';
    if (!localStorage.getItem('onboardingSeen')) {
      showOnboarding();
      localStorage.setItem('onboardingSeen', 'true');
    }
    showApp();
  } else {
    errorEl.textContent = t('invalidKey');
    errorEl.style.display = 'block';
  }
});

function showApp() {
  document.getElementById('appContent').style.display = 'block';
  document.getElementById('deviceIdDisplay').textContent = getDeviceId();
  applyLanguage();
  applyTheme();
  initApp();
}

// ========== التطبيق الأساسي ==========
function initApp() {
  fetch('obd_codes.json').then(r => r.json()).then(data => obdCodes = data).catch(() => {});

  // عناصر DOM
  const connectBtn = document.getElementById('connectBtn');
  const readDtcBtn = document.getElementById('readDtcBtn');
  const clearDtcBtn = document.getElementById('clearDtcBtn');
  const liveDataBtn = document.getElementById('liveDataBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const langSelect = document.getElementById('langSelect');
  const historyModal = document.getElementById('historyModal');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const refreshHistoryListBtn = document.getElementById('refreshHistoryListBtn');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const disconnectAlert = document.getElementById('disconnectAlert');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const exportReportBtn = document.getElementById('exportReportBtn');

  const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  function showToast(msg, type = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 3000);
  }

  function updateConnectionUI(active) {
    connected = active;
    document.getElementById('ledIndicator').className = active ? 'led online' : 'led offline';
    document.getElementById('connectionText').textContent = active ? 'متصل' : t('notConnected');
    readDtcBtn.disabled = !active;
    clearDtcBtn.disabled = !active;
    liveDataBtn.disabled = !active;
    if (active) disconnectAlert.classList.add('hidden');
  }

  async function connect() {
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'V' }, { namePrefix: 'OBD' }, { namePrefix: 'ELM' }],
        optionalServices: [UART_SERVICE, '0000ffe0-0000-1000-8000-00805f9b34fb']
      });
      server = await device.gatt.connect();
      device.addEventListener('gattserverdisconnected', () => {
        updateConnectionUI(false);
        disconnectAlert.classList.remove('hidden');
      });
      let service = await server.getPrimaryService(UART_SERVICE).catch(() => server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb'));
      txCharacteristic = await service.getCharacteristic(TX_CHAR);
      await txCharacteristic.startNotifications();
      txCharacteristic.addEventListener('characteristicvaluechanged', handleOBDResponse);
      updateConnectionUI(true);
      showToast('تم الاتصال', 'success');
      await sendCmd('ATZ\r'); await delay(800);
      await sendCmd('ATE0\r'); await sendCmd('ATSP0\r');
    } catch (err) {
      showToast('فشل الاتصال: ' + err.message, 'error');
    }
  }

  function handleOBDResponse(event) {
    let text = new TextDecoder().decode(event.target.value);
    if (text.includes('43')) parseDTCs(text);
    else if (text.includes('41 0C')) parseRPM(text);
    else if (text.includes('41 0D')) parseSpeed(text);
    else if (text.includes('41 05')) parseCoolantTemp(text);
    else if (text.includes('41 42')) parseVoltage(text);
  }

  async function sendCmd(cmd) { if (txCharacteristic) await txCharacteristic.writeValue(new TextEncoder().encode(cmd)); }

  async function readDTCs() {
    loadingSpinner.classList.remove('hidden');
    document.getElementById('dtcList').innerHTML = '';
    document.getElementById('noDtcMessage').classList.add('hidden');
    await sendCmd('03\r');
  }

  async function clearDTCs() {
    if (!confirm(t('clearDtc') + '؟')) return;
    await sendCmd('04\r');
    showToast('تم مسح الأعطال', 'success');
    document.getElementById('dtcList').innerHTML = '';
    document.getElementById('noDtcMessage').classList.remove('hidden');
    document.getElementById('dtcCount').textContent = '0';
  }

  async function readLiveData() {
    const panel = document.getElementById('liveDataPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await sendCmd('01 0C\r');
      await sendCmd('01 0D\r');
      await sendCmd('01 05\r');
      await sendCmd('01 42\r');
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
    currentDTCs = dtcs;
    displayDTCs(dtcs);
    loadingSpinner.classList.add('hidden');
    if (dtcs.length > 0 && navigator.vibrate) navigator.vibrate(200);
  }

  function decodeDTC(hex) {
    let fb = parseInt(hex.substring(0,2), 16);
    let prefix = 'P';
    if ((fb & 0xC0) === 0x40) prefix = 'C';
    else if ((fb & 0xC0) === 0x80) prefix = 'B';
    else if ((fb & 0xC0) === 0xC0) prefix = 'U';
    return prefix + ((fb >> 4) & 0x03) + (fb & 0x0F) + hex.substring(2);
  }

  function getSeverity(code) {
    if (code.startsWith('P03') || code.startsWith('P02')) return 'high';
    if (code.startsWith('P04')) return 'medium';
    return 'low';
  }

  function displayDTCs(codes) {
    const dtcList = document.getElementById('dtcList');
    const noDtcMsg = document.getElementById('noDtcMessage');
    dtcList.innerHTML = '';
    if (!codes.length) {
      noDtcMsg.classList.remove('hidden');
      document.getElementById('dtcCount').textContent = '0';
      return;
    }
    noDtcMsg.classList.add('hidden');
    document.getElementById('dtcCount').textContent = codes.length;
    const timestamp = new Date().toLocaleString('ar-EG');
    codes.forEach(code => {
      dtcHistory.unshift({ code, timestamp });
      if (dtcHistory.length > 50) dtcHistory.pop();
    });
    localStorage.setItem('obdHistory', JSON.stringify(dtcHistory));

    codes.forEach(code => {
      const info = obdCodes[code] || { en: 'Unknown', ar: 'كود غير معروف' };
      const severity = getSeverity(code);
      let severityClass = '';
      if (severity === 'medium') severityClass = 'severity-yellow';
      else if (severity === 'low') severityClass = 'severity-blue';

      const div = document.createElement('div');
      div.className = `dtc-item ${severityClass}`;
      div.innerHTML = `
        <div class="dtc-code">${code}</div>
        <div class="desc-en"><i class="fas fa-language"></i> ${info.en}</div>
        <div class="desc-ar"><i class="fas fa-language"></i> ${info.ar}</div>
        <button class="search-btn" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(code + ' car repair')}','_blank')">
          <i class="fas fa-search"></i> ${t('readDtc')}
        </button>
      `;
      dtcList.appendChild(div);
    });
  }

  function parseRPM(data) {
    const m = data.match(/41 0C ([0-9A-F]{2}) ([0-9A-F]{2})/i);
    if (m) {
      currentRPM = Math.round((parseInt(m[1],16)*256 + parseInt(m[2],16))/4);
      document.getElementById('rpmValue').textContent = currentRPM;
      const angle = Math.min(360, (currentRPM / 8000) * 360);
      document.getElementById('rpmGauge').style.background = `conic-gradient(var(--accent-blue) ${angle}deg, #2a3a4a 0deg)`;
      updateLiveCard('rpm', currentRPM + ' RPM');
    }
  }
  function parseSpeed(data) {
    const m = data.match(/41 0D ([0-9A-F]{2})/i);
    if (m) updateLiveCard('speed', parseInt(m[1],16) + ' km/h');
  }
  function parseCoolantTemp(data) {
    const m = data.match(/41 05 ([0-9A-F]{2})/i);
    if (m) updateLiveCard('coolant', (parseInt(m[1],16)-40) + '°C');
  }
  function parseVoltage(data) {
    const m = data.match(/41 42 ([0-9A-F]{4})/i);
    if (m) updateLiveCard('voltage', (parseInt(m[1],16)/1000).toFixed(1) + ' V');
  }

  function updateLiveCard(id, value) {
    let el = document.getElementById(`live-${id}`);
    if (!el) {
      const container = document.getElementById('liveValues');
      el = document.createElement('div');
      el.className = 'live-card';
      el.id = `live-${id}`;
      container.appendChild(el);
    }
    el.innerHTML = `<strong>${value}</strong><small>${id}</small>`;
  }

  // ========== السجل ==========
  function showHistory() {
    historyList.innerHTML = dtcHistory.length ? dtcHistory.map(h => `<p><strong>${h.code}</strong> - ${h.timestamp}</p>`).join('') : '<p>لا يوجد سجل</p>';
    historyModal.classList.remove('hidden');
  }
  refreshHistoryBtn.onclick = showHistory;
  closeHistoryBtn.onclick = () => historyModal.classList.add('hidden');
  clearHistoryBtn.onclick = () => {
    dtcHistory = [];
    localStorage.removeItem('obdHistory');
    showHistory();
    showToast('تم مسح السجل', 'success');
  };
  refreshHistoryListBtn.onclick = showHistory;

  // ========== الإعدادات ==========
  settingsBtn.onclick = () => settingsModal.classList.remove('hidden');
  closeSettingsBtn.onclick = () => settingsModal.classList.add('hidden');

  darkModeToggle.onchange = (e) => {
    localStorage.setItem('darkMode', e.target.checked);
    applyTheme();
  };

  langSelect.value = currentLang;
  langSelect.onchange = (e) => {
    currentLang = e.target.value;
    applyLanguage();
  };

  // ========== تصدير تقرير الأعطال ==========
  exportReportBtn.onclick = () => {
    if (!currentDTCs.length) {
      showToast('لا توجد أعطال لتصديرها', 'error');
      return;
    }
    let report = 'OBD Pro Fault Report\n======================\n';
    currentDTCs.forEach(code => {
      const info = obdCodes[code] || { en: 'Unknown', ar: 'كود غير معروف' };
      report += `${code}: ${info.en} / ${info.ar}\n`;
    });
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'obd-report.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير التقرير', 'success');
  };

  // ========== ربط الأزرار ==========
  connectBtn.addEventListener('click', connect);
  readDtcBtn.addEventListener('click', readDTCs);
  clearDtcBtn.addEventListener('click', clearDTCs);
  liveDataBtn.addEventListener('click', readLiveData);
  reconnectBtn.addEventListener('click', connect);

  // ========== تطبيق اللغة والثيم ==========
  applyLanguage();
  applyTheme();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
