import { Wallet } from "ethers";

let stopped = false;

self.onmessage = (event) => {
  const payload = event.data;
  if (payload.mode === "stop") {
    stopped = true;
    return;
  }
  stopped = false;
  run(payload);
};

function run({ mode, prefix = "", suffix = "", limit = 1 }) {
  try {
    validateHex(prefix, "前缀");
    validateHex(suffix, "后缀");
    const targetLimit = Math.max(1, Math.min(Number(limit) || 1, 50));
    const startKey = BigInt(Wallet.createRandom().privateKey);
    const found = [];
    let attempts = 0;
    let serial = 0;

    while (!stopped && found.length < targetLimit) {
      const key = normalizePrivateKey(startKey + BigInt(attempts));
      const wallet = new Wallet(formatPrivateKey(key));
      attempts += 1;
      const addressBody = wallet.address.slice(2).toLowerCase();
      let matched = false;
      let wantedSuffix = suffix;

      if (mode === "serial") {
        wantedSuffix = String(serial % 100).padStart(2, "0");
        matched = addressBody.startsWith(prefix) && addressBody.endsWith(wantedSuffix);
      } else {
        matched = (!prefix || addressBody.startsWith(prefix)) && (!suffix || addressBody.endsWith(suffix));
      }

      if (matched) {
        found.push({
          index: mode === "serial" ? wantedSuffix : found.length + 1,
          address: wallet.address,
          privateKey: wallet.privateKey,
        });
        self.postMessage({
          type: "found",
          payload: found.at(-1),
        });
        if (mode === "serial") serial += 1;
      }

      if (attempts % 1000 === 0) {
        self.postMessage({
          type: "progress",
          payload: { attempts, message: `已找到 ${found.length}/${targetLimit}` },
        });
      }
    }

    self.postMessage({
      type: "done",
      payload: {
        attempts,
        message: stopped ? "已停止" : `已完成 ${found.length}/${targetLimit}`,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: { message: error.message, attempts: 0 },
    });
  }
}

function validateHex(value, label) {
  if (value && !/^[0-9a-f]+$/i.test(value)) {
    throw new Error(`${label}只能包含 0-9 和 a-f`);
  }
}

function normalizePrivateKey(value) {
  const curveOrder = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const normalized = value % curveOrder;
  return normalized === 0n ? 1n : normalized;
}

function formatPrivateKey(value) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}
