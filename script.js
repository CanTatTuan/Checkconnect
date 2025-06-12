let port = null, reader = null, writer = null;
let sendTimer = null, readLoop = null;
let bytesReceived = 0, lastCheck = 0, latencyStart = 0;
let isConnected = false;

const el = (id) => document.getElementById(id);

el("connectBtn").onclick = async () => {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: parseInt(el("baudRate").value) });

    writer = port.writable.getWriter();
    reader = port.readable.getReader();

    isConnected = true;
    el("connectBtn").disabled = true;
    el("disconnectBtn").disabled = false;
    el("output").value = "";

    bytesReceived = 0;
    lastCheck = Date.now();

    startSending();
    startReading();
  } catch (err) {
    alert("Không thể kết nối: " + err.message);
    console.error(err);
  }
};

el("disconnectBtn").onclick = async () => {
  await stopAll();
};

async function stopAll() {
  isConnected = false;
  clearInterval(sendTimer);
  if (reader) {
    try { await reader.cancel(); reader.releaseLock(); } catch (e) {}
  }
  if (writer) {
    try { writer.releaseLock(); } catch (e) {}
  }
  if (port) {
    try { await port.close(); } catch (e) {}
  }

  el("connectBtn").disabled = false;
  el("disconnectBtn").disabled = true;
}

function startSending() {
  const interval = parseInt(el("interval").value);
  sendTimer = setInterval(async () => {
    if (!writer || !isConnected) return;
    const pingMsg = `ping-${Date.now()}`;
    latencyStart = Date.now();
    try {
      await writer.write(new TextEncoder().encode(pingMsg + "\n"));
    } catch (e) {
      console.error("Lỗi gửi dữ liệu:", e);
      await stopAll();
    }
  }, interval);
}

function startReading() {
  const output = el("output");
  const bpsDisplay = el("bps");
  const latencyDisplay = el("latency");
  const evalDisplay = el("evaluation");
  const decoder = new TextDecoder();

  (readLoop = async () => {
    while (isConnected && port.readable) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const text = decoder.decode(value);
          output.value += text;
          bytesReceived += text.length;

          // Đo độ trễ nếu có phản hồi "ping"
          if (text.includes("ping")) {
            const latency = Date.now() - latencyStart;
            latencyDisplay.textContent = latency;
          }

          // Cập nhật tốc độ và đánh giá
          const now = Date.now();
          const duration = (now - lastCheck) / 1000;
          if (duration >= 1) {
            const bps = Math.round(bytesReceived / duration);
            bpsDisplay.textContent = bps;
            lastCheck = now;
            bytesReceived = 0;
            evalDisplay.textContent = evaluateSpeed(bps);
          }

          // Giới hạn buffer textarea (buffer overflow prevention)
          if (output.value.length > 20000) {
            output.value = output.value.slice(-15000);
          }

          output.scrollTop = output.scrollHeight;
        }
      } catch (err) {
        console.error("Lỗi đọc:", err);
        await stopAll();
        break;
      }
    }
  })();
}

function evaluateSpeed(bps) {
  if (bps > 10000) return "Tốt";
  if (bps > 3000) return "Chấp nhận được";
  if (bps > 0) return "Yếu";
  return "Không nhận";
}

el("darkMode").addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
});

window.addEventListener("beforeunload", async (e) => {
  if (isConnected) {
    e.preventDefault();
    e.returnValue = "";
    await stopAll();
  }
});