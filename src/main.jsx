import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Ban,
  Calculator,
  Clock,
  Coins,
  Copy,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  ListRestart,
  Loader2,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import {
  Contract,
  HDNodeWallet,
  Interface,
  JsonRpcProvider,
  Mnemonic,
  Wallet,
  formatEther,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
} from "ethers";
import "./styles.css";

const ADDRESS_COUNT = 20;
const GITHUB_URL = "https://github.com/axboy/evm-wallet-studio";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const DEFAULT_RPC_NODES = [
  { id: "default-ethereum", name: "Ethereum", url: "https://ethereum-rpc.publicnode.com", symbol: "ETH" },
  { id: "default-bnb", name: "BNB Chain", url: "https://bsc-rpc.publicnode.com", symbol: "BNB" },
  { id: "default-polygon", name: "Polygon", url: "https://polygon-bor-rpc.publicnode.com", symbol: "POL" },
];
const COMMON_TIME_ZONES = [
  { label: "UTC", value: "UTC" },
  { label: "GMT+8", value: "Etc/GMT-8" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Hong_Kong", value: "Asia/Hong_Kong" },
  { label: "Asia/Singapore", value: "Asia/Singapore" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "America/Los_Angeles", value: "America/Los_Angeles" },
  { label: "Europe/London", value: "Europe/London" },
];
const RPC_STORAGE_KEY = "evm-wallet-studio-rpc-nodes";
const SELECTED_RPC_STORAGE_KEY = "evm-wallet-studio-selected-rpc";
const LEGACY_PRIVATE_KEY_HISTORY_STORAGE_KEY = "evm-wallet-studio-private-key-query-history";

function App() {
  const [mnemonic, setMnemonic] = useState("");
  const [mnemonicError, setMnemonicError] = useState("");
  const [derived, setDerived] = useState([]);
  const [showSecrets, setShowSecrets] = useState(false);

  const [vanityMode, setVanityMode] = useState("free");
  const [vanityPrefix, setVanityPrefix] = useState("");
  const [vanitySuffix, setVanitySuffix] = useState("");
  const [serialBasePrefix, setSerialBasePrefix] = useState("");
  const [vanityLimit, setVanityLimit] = useState(5);
  const [vanityResults, setVanityResults] = useState([]);
  const [vanityStatus, setVanityStatus] = useState({ running: false, attempts: 0, message: "等待开始" });
  const workerRef = useRef(null);

  const [rpcNodes, setRpcNodes] = useState(loadRpcNodes);
  const [selectedRpcId, setSelectedRpcId] = useState(() => loadSelectedRpcId(loadRpcNodes()));
  const [newRpc, setNewRpc] = useState({ name: "", url: "", symbol: "" });
  const [queryAddress, setQueryAddress] = useState("");
  const [tokenContract, setTokenContract] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [queryStatus, setQueryStatus] = useState("");

  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyResult, setPrivateKeyResult] = useState(null);
  const [privateKeyStatus, setPrivateKeyStatus] = useState("");
  const [importedWallets, setImportedWallets] = useState([]);
  const [activeWalletAddress, setActiveWalletAddress] = useState("");
  const [activePage, setActivePage] = useState("mnemonic");
  const [nativeTransfer, setNativeTransfer] = useState({ to: "", amount: "", data: "" });
  const [txStatus, setTxStatus] = useState("");
  const [pendingTx, setPendingTx] = useState(null);
  const [txQueue, setTxQueue] = useState([]);
  const [abiText, setAbiText] = useState("");
  const [abiTarget, setAbiTarget] = useState("");
  const [abiValue, setAbiValue] = useState("");
  const [abiFunctions, setAbiFunctions] = useState([]);
  const [selectedAbiFunction, setSelectedAbiFunction] = useState("");
  const [abiArgs, setAbiArgs] = useState([]);
  const [abiStatus, setAbiStatus] = useState("");
  const [abiResult, setAbiResult] = useState(null);
  const [unitTool, setUnitTool] = useState({ raw: "", readable: "", decimals: "18" });
  const [unitResult, setUnitResult] = useState(null);
  const [unitHistory, setUnitHistory] = useState([]);
  const [timeTool, setTimeTool] = useState({
    timestamp: "",
    timestampUnit: "seconds",
    dateTime: "",
    timeZone: "Asia/Shanghai",
  });
  const [timeResult, setTimeResult] = useState(null);
  const [timeHistory, setTimeHistory] = useState([]);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  const selectedRpc = useMemo(
    () => rpcNodes.find((node) => node.id === selectedRpcId) ?? rpcNodes[0],
    [rpcNodes, selectedRpcId],
  );
  const selectedWallet = useMemo(
    () => importedWallets.find((wallet) => wallet.address === activeWalletAddress) ?? importedWallets[0],
    [importedWallets, activeWalletAddress],
  );

  useEffect(() => {
    if (!mnemonic.trim()) {
      setDerived([]);
      setMnemonicError("");
      return;
    }

    try {
      const phrase = normalizeWords(mnemonic);
      Mnemonic.fromPhrase(phrase);
      const rows = Array.from({ length: ADDRESS_COUNT }, (_, index) => {
        const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${index}`);
        return { index, address: wallet.address, privateKey: wallet.privateKey };
      });
      setDerived(rows);
      setMnemonicError("");
    } catch {
      setDerived([]);
      setMnemonicError("助记词格式不正确，请检查单词数量和拼写。");
    }
  }, [mnemonic]);

  useEffect(() => {
    return () => stopVanity();
  }, []);

  useEffect(() => {
    saveStorageItem(RPC_STORAGE_KEY, JSON.stringify(rpcNodes));
  }, [rpcNodes]);

  useEffect(() => {
    removeStorageItem(LEGACY_PRIVATE_KEY_HISTORY_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (selectedRpcId) {
      saveStorageItem(SELECTED_RPC_STORAGE_KEY, selectedRpcId);
    }
  }, [selectedRpcId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function generateMnemonic() {
    const wallet = Wallet.createRandom();
    setMnemonic(wallet.mnemonic.phrase);
  }

  function startVanity() {
    stopVanity();
    setVanityResults([]);
    setVanityStatus({ running: true, attempts: 0, message: "正在本地生成" });

    const worker = new Worker(new URL("./vanityWorker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === "progress") {
        setVanityStatus({ running: true, attempts: payload.attempts, message: payload.message });
      }
      if (type === "found") {
        setVanityResults((items) => [...items, payload]);
      }
      if (type === "done") {
        setVanityStatus({ running: false, attempts: payload.attempts, message: payload.message });
        worker.terminate();
        workerRef.current = null;
      }
      if (type === "error") {
        setVanityStatus({ running: false, attempts: payload.attempts ?? 0, message: payload.message });
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({
      mode: vanityMode,
      prefix: vanityMode === "free" ? cleanHex(vanityPrefix) : cleanHex(serialBasePrefix),
      suffix: vanityMode === "free" ? cleanHex(vanitySuffix) : "",
      limit: Number(vanityLimit) || 1,
    });
  }

  function stopVanity() {
    workerRef.current?.postMessage({ mode: "stop" });
    workerRef.current?.terminate();
    workerRef.current = null;
    setVanityStatus((status) => (status.running ? { ...status, running: false, message: "已停止" } : status));
  }

  function addRpcNode() {
    if (!newRpc.name.trim() || !newRpc.url.trim()) return;
    const name = newRpc.name.trim();
    const existing = rpcNodes.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const node = {
      id: existing?.id || crypto.randomUUID(),
      name,
      url: newRpc.url.trim(),
      symbol: newRpc.symbol.trim() || "ETH",
    };
    setRpcNodes((nodes) => {
      if (!existing) return [...nodes, node];
      return nodes.map((item) => (item.id === existing.id ? node : item));
    });
    setNewRpc({ name: "", url: "", symbol: "" });
    setSelectedRpcId(node.id);
  }

  function selectRpcNode(node) {
    setSelectedRpcId(node.id);
    setNewRpc({ name: node.name, url: node.url, symbol: node.symbol });
  }

  function removeRpcNode(id) {
    const next = rpcNodes.filter((node) => node.id !== id);
    setRpcNodes(next);
    if (selectedRpcId === id) {
      setSelectedRpcId(next[0]?.id ?? "");
    }
  }

  async function queryBalance(addressInput = queryAddress, tokenInput = tokenContract) {
    setQueryStatus("查询中...");
    setQueryResult(null);
    try {
      const address = getAddress(addressInput.trim());
      const provider = new JsonRpcProvider(selectedRpc.url);
      const nativeBalance = await provider.getBalance(address);
      const result = {
        address,
        network: selectedRpc.name,
        nativeSymbol: selectedRpc.symbol || "ETH",
        nativeBalance: formatEther(nativeBalance),
        token: null,
      };

      if (tokenInput.trim()) {
        const tokenAddress = getAddress(tokenInput.trim());
        const token = new Contract(tokenAddress, ERC20_ABI, provider);
        const [rawBalance, decimals, symbol, name] = await Promise.all([
          token.balanceOf(address),
          token.decimals().catch(() => 18),
          token.symbol().catch(() => "TOKEN"),
          token.name().catch(() => "ERC20"),
        ]);
        result.token = {
          address: tokenAddress,
          name,
          symbol,
          balance: formatUnits(rawBalance, decimals),
        };
      }

      setQueryResult(result);
      setQueryStatus("查询完成");
    } catch (error) {
      setQueryStatus(error.shortMessage || error.message || "查询失败，请检查 RPC、地址或合约。");
    }
  }

  async function importPrivateKey() {
    setPrivateKeyStatus("解析中...");
    setPrivateKeyResult(null);
    try {
      const wallet = new Wallet(privateKey.trim());
      const result = { address: wallet.address, balance: null };
      if (selectedRpc?.url) {
        const provider = new JsonRpcProvider(selectedRpc.url);
        result.balance = formatEther(await provider.getBalance(wallet.address));
        result.symbol = selectedRpc.symbol || "ETH";
        result.network = selectedRpc.name;
      }
      setPrivateKeyResult(result);
      setImportedWallets((items) => upsertWallet(items, { ...result, privateKey: wallet.privateKey }));
      setActiveWalletAddress(wallet.address);
      setPrivateKeyStatus("导入完成");
      setQueryAddress(wallet.address);
    } catch (error) {
      setPrivateKeyStatus(error.shortMessage || error.message || "私钥无效。");
    }
  }

  function getWallet() {
    if (!selectedRpc?.url) throw new Error("请先选择 RPC 节点。");
    const key = selectedWallet?.privateKey || privateKey.trim();
    if (!key) throw new Error("请先导入并选择钱包。");
    return new Wallet(key, new JsonRpcProvider(selectedRpc.url));
  }

  async function prepareNativeTransfer() {
    setTxStatus("生成待签名内容中...");
    setPendingTx(null);
    try {
      const wallet = getWallet();
      const tx = {
        to: getAddress(nativeTransfer.to.trim()),
        value: parseEther(nativeTransfer.amount.trim() || "0"),
        data: normalizeTxData(nativeTransfer.data),
      };
      setPendingTx(await buildPendingTxDraft("主币转账", tx, wallet, "transfer", selectedRpc?.symbol || "ETH"));
      setTxStatus("已生成待签名内容");
    } catch (error) {
      setTxStatus(readError(error));
    }
  }

  function addPendingTxToQueue() {
    if (!pendingTx) return;
    setTxQueue((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        title: pendingTx.title,
        tx: draftToTransaction(pendingTx.draft),
        draft: pendingTx.draft,
        symbol: pendingTx.symbol || selectedRpc?.symbol || "ETH",
        from: pendingTx.from,
        chainId: pendingTx.chainId,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      },
    ]);
    if (pendingTx.source === "abi") {
      setAbiStatus("已加入交易列表");
    } else {
      setTxStatus("已加入交易列表");
    }
    setPendingTx(null);
  }

  async function sendQueuedTx(id) {
    const item = txQueue.find((tx) => tx.id === id);
    if (!item) return;
    setTxStatus("广播交易中...");
    try {
      const wallet = getWallet();
      const response = await wallet.sendTransaction(draftToTransaction(item.draft || txToDraft(item.tx)));
      setTxQueue((items) => items.map((tx) => (tx.id === id ? { ...tx, hash: response.hash } : tx)));
      setTxStatus(`已广播：${response.hash}`);
    } catch (error) {
      setTxStatus(readError(error));
    }
  }

  function removeQueuedTx(id) {
    setTxQueue((items) => items.filter((tx) => tx.id !== id));
  }

  async function sendPendingTx() {
    if (!pendingTx) return;
    if (pendingTx.source === "abi") {
      setAbiStatus("广播交易中...");
    } else {
      setTxStatus("广播交易中...");
    }
    try {
      const wallet = getWallet();
      const response = await wallet.sendTransaction(draftToTransaction(pendingTx.draft));
      if (pendingTx.source === "abi") {
        setAbiStatus(`已广播：${response.hash}`);
      } else {
        setTxStatus(`已广播：${response.hash}`);
      }
      setPendingTx((item) => ({ ...item, hash: response.hash }));
    } catch (error) {
      if (pendingTx.source === "abi") {
        setAbiStatus(readError(error));
      } else {
        setTxStatus(readError(error));
      }
    }
  }

  function updatePendingTxDraft(field, value) {
    setPendingTx((item) => (item ? { ...item, draft: { ...item.draft, [field]: value } } : item));
  }

  function parseAbiInput() {
    setAbiStatus("");
    setAbiResult(null);
    try {
      const fragments = parseAbiFragments(abiText);
      setAbiFromFragments(fragments, "ABI 已解析");
    } catch (error) {
      setAbiFunctions([]);
      setSelectedAbiFunction("");
      setAbiArgs([]);
      setAbiStatus(readError(error));
    }
  }

  function setAbiFromFragments(fragments, message) {
    const iface = new Interface(fragments);
    const functions = iface.fragments
      .filter((fragment) => fragment.type === "function")
      .map((fragment) => ({
        key: fragment.format("minimal"),
        name: fragment.name,
        stateMutability: fragment.stateMutability,
        inputs: fragment.inputs.map((input, index) => ({
          name: input.name || `arg${index}`,
          type: input.type,
        })),
        display: fragment.format("full"),
      }));
    setAbiFunctions(functions);
    setSelectedAbiFunction(functions[0]?.key || "");
    setAbiArgs(Array.from({ length: functions[0]?.inputs.length || 0 }, () => ""));
    setAbiResult(null);
    setAbiStatus(functions.length > 0 ? message : "ABI 中没有可调用方法");
  }

  function applyAbiPreset(type) {
    const presets = {
      balance: ["function balanceOf(address owner) view returns (uint256)"],
      transfer: ["function transfer(address to, uint256 amount) returns (bool)"],
      approve: ["function approve(address spender, uint256 amount) returns (bool)"],
      allowance: ["function allowance(address owner, address spender) view returns (uint256)"],
    };
    const fragments = presets[type];
    setAbiText(JSON.stringify(fragments, null, 2));
    setAbiValue("");
    setAbiFromFragments(fragments, "模板已载入");
  }

  function chooseAbiFunction(key) {
    const item = abiFunctions.find((func) => func.key === key);
    setSelectedAbiFunction(key);
    setAbiArgs(Array.from({ length: item?.inputs.length || 0 }, () => ""));
    setAbiResult(null);
  }

  async function prepareAbiCall() {
    setAbiStatus("准备调用中...");
    setAbiResult(null);
    setPendingTx(null);
    try {
      const item = abiFunctions.find((func) => func.key === selectedAbiFunction);
      if (!item) throw new Error("请选择 ABI 方法。");
      const target = getAddress(abiTarget.trim());
      const fragments = parseAbiFragments(abiText);
      const provider = new JsonRpcProvider(selectedRpc.url);
      const contract = new Contract(target, fragments, provider);
      const values = item.inputs.map((input, index) => parseAbiValue(input.type, abiArgs[index] ?? ""));

      if (isReadOnlyFunction(item)) {
        const result = await contract.getFunction(item.key).staticCall(...values);
        setAbiResult(formatCallResult(result));
        setAbiStatus("调用完成");
        return;
      }

      const wallet = getWallet();
      const signedContract = contract.connect(wallet);
      const signedFn = signedContract.getFunction(item.key);
      const overrides = abiValue.trim() ? { value: parseEther(abiValue.trim()) } : {};
      const tx = await signedFn.populateTransaction(...values, overrides);
      setPendingTx(await buildPendingTxDraft(`合约调用：${item.name}`, tx, wallet, "abi", selectedRpc?.symbol || "ETH"));
      setAbiStatus("已生成待签名内容");
    } catch (error) {
      setAbiStatus(readError(error));
    }
  }

  function convertRawToReadable() {
    try {
      const decimals = Number(unitTool.decimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error("精度必须是 0 到 255 的整数。");
      }
      const raw = unitTool.raw.trim();
      if (!raw) throw new Error("请输入原始数值。");
      const readable = formatUnits(raw, decimals);
      setUnitTool((value) => ({ ...value, readable }));
      const item = {
        id: crypto.randomUUID(),
        direction: "原始值 -> 可读值",
        raw,
        decimals,
        readable,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      setUnitResult(item);
      setUnitHistory((items) => [item, ...items].slice(0, 30));
    } catch (error) {
      setUnitResult({ error: readError(error) });
    }
  }

  function convertReadableToRaw() {
    try {
      const decimals = Number(unitTool.decimals);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        throw new Error("精度必须是 0 到 255 的整数。");
      }
      const readable = unitTool.readable.trim();
      if (!readable) throw new Error("请输入可读数量。");
      const raw = parseUnits(readable, decimals).toString();
      setUnitTool((value) => ({ ...value, raw }));
      const item = {
        id: crypto.randomUUID(),
        direction: "可读值 -> 原始值",
        raw,
        decimals,
        readable,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      setUnitResult(item);
      setUnitHistory((items) => [item, ...items].slice(0, 30));
    } catch (error) {
      setUnitResult({ error: readError(error) });
    }
  }

  function removeUnitHistory(id) {
    setUnitHistory((items) => items.filter((item) => item.id !== id));
  }

  function convertTimestampToDate() {
    try {
      const text = timeTool.timestamp.trim();
      if (!text) throw new Error("请输入时间戳。");
      const numeric = Number(text);
      if (!Number.isFinite(numeric)) throw new Error("时间戳必须是数字。");
      const milliseconds = timeTool.timestampUnit === "milliseconds" ? numeric : numeric * 1000;
      const date = new Date(milliseconds);
      if (Number.isNaN(date.getTime())) throw new Error("时间戳无效。");
      const item = {
        id: crypto.randomUUID(),
        mode: "timestamp",
        timestampSeconds: Math.floor(date.getTime() / 1000).toString(),
        timestampMilliseconds: date.getTime().toString(),
        utc: date.toISOString(),
        zoned: formatDateInTimeZone(date, timeTool.timeZone),
        timeZone: timeTool.timeZone,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      setTimeResult(item);
      setTimeHistory((items) => [item, ...items].slice(0, 30));
    } catch (error) {
      setTimeResult({ error: readError(error) });
    }
  }

  function convertDateToTimestamp() {
    try {
      const text = timeTool.dateTime.trim();
      if (!text) throw new Error("请输入日期时间。");
      const date = zonedDateTimeToDate(text, timeTool.timeZone);
      const item = {
        id: crypto.randomUUID(),
        mode: "datetime",
        input: text,
        timestampSeconds: Math.floor(date.getTime() / 1000).toString(),
        timestampMilliseconds: date.getTime().toString(),
        utc: date.toISOString(),
        zoned: formatDateInTimeZone(date, timeTool.timeZone),
        timeZone: timeTool.timeZone,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      };
      setTimeResult(item);
      setTimeHistory((items) => [item, ...items].slice(0, 30));
    } catch (error) {
      setTimeResult({ error: readError(error) });
    }
  }

  function removeTimeHistory(id) {
    setTimeHistory((items) => items.filter((item) => item.id !== id));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span>Local EVM</span>
          <strong>Wallet Studio</strong>
        </div>
        <PageNavigation activePage={activePage} onChange={setActivePage} variant="side" />
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <p className="eyebrow">{getPageTitle(activePage)}</p>
          <div className="topbar-actions">
            <a className="github-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
              <Github size={18} />
              <span>GitHub</span>
            </a>
            <div className="trust-badge">
              <ShieldCheck size={18} />
              <span>私钥仅在浏览器内处理</span>
            </div>
          </div>
        </header>

        {activePage === "mnemonic" && (
        <section className="grid page-panel">
        <Panel icon={<WalletCards />} title="助记词地址派生">
          <div className="action-row">
            <button className="primary" onClick={generateMnemonic}>
              <Sparkles size={17} />
              随机助记词
            </button>
            <button className="ghost" onClick={() => setShowSecrets((value) => !value)}>
              {showSecrets ? <EyeOff size={17} /> : <Eye size={17} />}
              {showSecrets ? "隐藏敏感数据" : "显示敏感数据"}
            </button>
          </div>
          <textarea
            value={mnemonic}
            onChange={(event) => setMnemonic(event.target.value)}
            rows={4}
            placeholder="输入或生成 12/24 位英文助记词"
          />
          {mnemonicError && <p className="error">{mnemonicError}</p>}
          <AddressTable rows={derived} showSecrets={showSecrets} empty="生成或输入助记词后展示前 20 个地址" />
        </Panel>
      </section>
      )}

        {activePage === "vanity" && (
        <section className="grid page-panel">
        <Panel icon={<Sparkles />} title="靓号地址生成">
          <div className="segmented" role="tablist" aria-label="靓号模式">
            <button className={vanityMode === "free" ? "active" : ""} onClick={() => setVanityMode("free")}>
              前后缀匹配
            </button>
            <button className={vanityMode === "serial" ? "active" : ""} onClick={() => setVanityMode("serial")}>
              后两位递增
            </button>
          </div>

          {vanityMode === "free" ? (
            <div className="form-grid">
              <Field label="前几位" value={vanityPrefix} onChange={setVanityPrefix} placeholder="如 abcd" />
              <Field label="后几位" value={vanitySuffix} onChange={setVanitySuffix} placeholder="如 8888" />
            </div>
          ) : (
            <Field label="固定前缀" value={serialBasePrefix} onChange={setSerialBasePrefix} placeholder="如 cafe，后两位 00-99" />
          )}

          <div className="form-grid compact">
            <label>
              <span>生成数量</span>
              <input
                type="number"
                min="1"
                max="50"
                value={vanityLimit}
                onChange={(event) => setVanityLimit(event.target.value)}
              />
            </label>
            <div className="action-row align-end">
              <button className="primary" disabled={vanityStatus.running} onClick={startVanity}>
                {vanityStatus.running ? <Loader2 className="spin" size={17} /> : <Play size={17} />}
                开始
              </button>
              <button className="ghost danger" disabled={!vanityStatus.running} onClick={stopVanity}>
                <Ban size={17} />
                停止
              </button>
            </div>
          </div>

          <StatusLine attempts={vanityStatus.attempts} text={vanityStatus.message} />
          <AddressTable rows={vanityResults} showSecrets={showSecrets} empty="匹配结果会按发现顺序展示地址和私钥" />
        </Panel>
      </section>
      )}

        {activePage === "tx" && (
        <>
      <section className="grid two bottom-grid">
        <Panel icon={<Activity />} title="RPC 与余额查询">
          <div className="node-list">
            {rpcNodes.map((node) => (
              <button
                className={`node-pill ${node.id === selectedRpcId ? "selected" : ""}`}
                key={node.id}
                onClick={() => selectRpcNode(node)}
                title={node.url}
              >
                <span>{node.name}</span>
                <small>{node.symbol}</small>
                {rpcNodes.length > 1 && (
                  <Trash2
                    size={14}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeRpcNode(node.id);
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="form-grid three">
            <Field label="节点名" value={newRpc.name} onChange={(value) => setNewRpc((item) => ({ ...item, name: value }))} placeholder="Arbitrum" />
            <Field label="RPC URL" value={newRpc.url} onChange={(value) => setNewRpc((item) => ({ ...item, url: value }))} placeholder="https://..." />
            <Field label="主币" value={newRpc.symbol} onChange={(value) => setNewRpc((item) => ({ ...item, symbol: value }))} placeholder="ETH" />
          </div>
          <div className="action-row">
            <button className="secondary" onClick={addRpcNode}>
              <Plus size={17} />
              添加 RPC
            </button>
          </div>

          <Field label="查询地址" value={queryAddress} onChange={setQueryAddress} placeholder="0x..." />
          <Field label="ERC20 合约地址" value={tokenContract} onChange={setTokenContract} placeholder="可选：0x..." />
          <div className="action-row">
            <button className="primary" onClick={() => queryBalance()}>
              <Search size={17} />
              查询余额
            </button>
          </div>
          <ResultBox status={queryStatus} result={queryResult} />
        </Panel>

        <Panel icon={<KeyRound />} title="钱包管理">
          <label>
            <span>私钥</span>
            <input
              type={showSecrets ? "text" : "password"}
              value={privateKey}
              onChange={(event) => setPrivateKey(event.target.value)}
              placeholder="0x..."
            />
          </label>
          <div className="action-row">
            <button className="primary" onClick={importPrivateKey}>
              <KeyRound size={17} />
              导入钱包
            </button>
            <button className="ghost" onClick={() => setPrivateKey("")}>
              <ListRestart size={17} />
              清空
            </button>
          </div>
          {privateKeyStatus && <p className={privateKeyResult ? "success" : "muted"}>{privateKeyStatus}</p>}
          {privateKeyResult && (
            <div className="result-card">
              <ValueRow label="地址" value={privateKeyResult.address} />
              {privateKeyResult.balance !== null && (
                <ValueRow
                  label="主币余额"
                  value={`${privateKeyResult.balance} ${privateKeyResult.symbol} · ${privateKeyResult.network}`}
                />
              )}
            </div>
          )}
          {importedWallets.length > 0 && (
            <div className="history-block">
              <div className="history-title">
                <span>已导入钱包</span>
                <small>{selectedRpc?.name}</small>
              </div>
              <div className="history-list">
                {importedWallets.map((wallet) => (
                  <button
                    className={`history-item ${wallet.address === selectedWallet?.address ? "selected" : ""}`}
                    key={wallet.address}
                    onClick={() => setActiveWalletAddress(wallet.address)}
                    title="设为签名钱包"
                  >
                    <span className="mono">{wallet.address}</span>
                    <strong>
                      {wallet.balance ?? "0"} {wallet.symbol || selectedRpc?.symbol || "ETH"}
                    </strong>
                    <small>{wallet.network || selectedRpc?.name}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </section>

      <section className="grid two bottom-grid">
        <Panel icon={<Send />} title="主币转账">
          <div className="subpanel">
            <h3>主币转账</h3>
            <div className="form-grid">
              <Field label="接收地址" value={nativeTransfer.to} onChange={(value) => setNativeTransfer((item) => ({ ...item, to: value }))} placeholder="0x..." />
              <Field label={`数量 ${selectedRpc?.symbol || ""}`} value={nativeTransfer.amount} onChange={(value) => setNativeTransfer((item) => ({ ...item, amount: value }))} placeholder="0.01" />
            </div>
            <Field label="Data" value={nativeTransfer.data} onChange={(value) => setNativeTransfer((item) => ({ ...item, data: value }))} placeholder="可选：0x..." />
            <div className="action-row">
              <button className="primary" onClick={prepareNativeTransfer}>
                <Send size={17} />
                生成待签名内容
              </button>
            </div>
          </div>

          {txStatus && <p className={pendingTx ? "success" : "muted"}>{txStatus}</p>}
          <PendingTxCard
            pendingTx={pendingTx?.source === "transfer" ? pendingTx : null}
            onChange={updatePendingTxDraft}
            onConfirm={sendPendingTx}
            onAdd={addPendingTxToQueue}
            onClear={() => setPendingTx(null)}
          />
        </Panel>

        <Panel icon={<Activity />} title="ABI 合约调用">
          <div className="preset-row">
            <button className="ghost" onClick={() => applyAbiPreset("balance")}>
              查询余额
            </button>
            <button className="ghost" onClick={() => applyAbiPreset("transfer")}>
              ERC20 转账
            </button>
            <button className="ghost" onClick={() => applyAbiPreset("approve")}>
              ERC20 授权
            </button>
            <button className="ghost" onClick={() => applyAbiPreset("allowance")}>
              查询授权
            </button>
          </div>
          <label>
            <span>合约地址</span>
            <input value={abiTarget} onChange={(event) => setAbiTarget(event.target.value)} placeholder="0x..." />
          </label>
          <label>
            <span>ABI</span>
            <textarea
              value={abiText}
              onChange={(event) => setAbiText(event.target.value)}
              rows={7}
              placeholder={`[{"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address"}],"outputs":[{"type":"uint256"}],"stateMutability":"view"}]\n或 ['function balanceOf(address owner) view returns (uint256)']`}
            />
          </label>
          <div className="action-row">
            <button className="secondary" onClick={parseAbiInput}>
              <Search size={17} />
              解析 ABI
            </button>
          </div>
          {abiFunctions.length > 0 && (
            <>
              <label>
                <span>方法</span>
                <select value={selectedAbiFunction} onChange={(event) => chooseAbiFunction(event.target.value)}>
                  {abiFunctions.map((func) => (
                    <option value={func.key} key={func.key}>
                      {func.display}
                    </option>
                  ))}
                </select>
              </label>
              <div className="abi-args">
                {abiFunctions
                  .find((func) => func.key === selectedAbiFunction)
                  ?.inputs.map((input, index) => (
                    <Field
                      key={`${input.name}-${input.type}-${index}`}
                      label={`${input.name} (${input.type})`}
                      value={abiArgs[index] || ""}
                      onChange={(value) => setAbiArgs((items) => items.map((item, itemIndex) => (itemIndex === index ? value : item)))}
                      placeholder={input.type.endsWith("[]") ? "[...]" : input.type}
                    />
                  ))}
              </div>
              {abiFunctions.find((func) => func.key === selectedAbiFunction)?.stateMutability === "payable" && (
                <Field label={`附带主币 ${selectedRpc?.symbol || ""}`} value={abiValue} onChange={setAbiValue} placeholder="0" />
              )}
              <div className="action-row">
                <button className="primary" onClick={prepareAbiCall}>
                  {isReadOnlyFunction(abiFunctions.find((func) => func.key === selectedAbiFunction)) ? <Search size={17} /> : <Send size={17} />}
                  {isReadOnlyFunction(abiFunctions.find((func) => func.key === selectedAbiFunction)) ? "直接查询" : "生成待签名内容"}
                </button>
              </div>
            </>
          )}
          {abiStatus && <p className={abiResult || pendingTx ? "success" : "muted"}>{abiStatus}</p>}
          <PendingTxCard
            pendingTx={pendingTx?.source === "abi" ? pendingTx : null}
            onChange={updatePendingTxDraft}
            onConfirm={sendPendingTx}
            onAdd={addPendingTxToQueue}
            onClear={() => setPendingTx(null)}
          />
          {abiResult && (
            <div className="result-card">
              <ValueRow label="返回值" value={abiResult} />
            </div>
          )}
        </Panel>
      </section>
      <section className="grid bottom-grid">
        <Panel icon={<Send />} title="交易列表">
          <QueuedTxList
            items={txQueue}
            onSend={sendQueuedTx}
            onRemove={removeQueuedTx}
            onClear={() => setTxQueue([])}
          />
        </Panel>
      </section>
      </>
      )}

        {activePage === "unit" && (
      <section className="grid two bottom-grid">
        <Panel icon={<Calculator />} title="精度转换">
          <div className="form-grid unit-grid">
            <Field label="原始值" value={unitTool.raw} onChange={(value) => setUnitTool((item) => ({ ...item, raw: value }))} placeholder="如 1000000000000000000" />
            <Field label="可读数量" value={unitTool.readable} onChange={(value) => setUnitTool((item) => ({ ...item, readable: value }))} placeholder="如 1.23" />
            <Field label="精度 decimals" value={unitTool.decimals} onChange={(value) => setUnitTool((item) => ({ ...item, decimals: value }))} placeholder="18" />
          </div>
          <div className="action-row">
            <button className="primary" onClick={convertRawToReadable}>
              <Calculator size={17} />
              原始值转可读值
            </button>
            <button className="secondary" onClick={convertReadableToRaw}>
              <Calculator size={17} />
              可读值转原始值
            </button>
            {unitResult?.error && <span className="inline-result error-text">{unitResult.error}</span>}
          </div>
          <UnitHistory items={unitHistory} onRemove={removeUnitHistory} />
        </Panel>
      </section>
      )}

        {activePage === "time" && (
      <section className="grid two bottom-grid">
        <Panel icon={<Clock />} title="时间转换">
          <div className="result-card">
            <div className="history-title">
              <span>当前时间</span>
              <small>{timeTool.timeZone}</small>
            </div>
            <ValueRow label="时间" value={formatDateInTimeZone(new Date(currentTimestamp), timeTool.timeZone)} />
            <ValueRow label="时间戳" value={Math.floor(currentTimestamp / 1000)} />
          </div>
          <label>
            <span>时区</span>
            <select value={timeTool.timeZone} onChange={(event) => setTimeTool((item) => ({ ...item, timeZone: event.target.value }))}>
              {COMMON_TIME_ZONES.map((zone) => (
                <option value={zone.value} key={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid compact">
            <Field label="时间戳" value={timeTool.timestamp} onChange={(value) => setTimeTool((item) => ({ ...item, timestamp: value }))} placeholder="1718352000" />
            <label>
              <span>单位</span>
              <select value={timeTool.timestampUnit} onChange={(event) => setTimeTool((item) => ({ ...item, timestampUnit: event.target.value }))}>
                <option value="seconds">秒</option>
                <option value="milliseconds">毫秒</option>
              </select>
            </label>
          </div>
          <div className="action-row">
            <button className="primary" onClick={convertTimestampToDate}>
              <Clock size={17} />
              时间戳转时间
            </button>
            <InlineTimeResult result={timeResult} mode="timestamp" />
          </div>
          <Field label="日期时间" value={timeTool.dateTime} onChange={(value) => setTimeTool((item) => ({ ...item, dateTime: value }))} placeholder="2026-06-14 21:30:00" />
          <div className="action-row">
            <button className="secondary" onClick={convertDateToTimestamp}>
              <Clock size={17} />
              时间转时间戳
            </button>
            <InlineTimeResult result={timeResult} mode="datetime" />
          </div>
          <TimeHistory items={timeHistory} onRemove={removeTimeHistory} />
        </Panel>
      </section>
      )}
      </div>

      <PageNavigation activePage={activePage} onChange={setActivePage} variant="bottom" />
    </main>
  );
}

function PageNavigation({ activePage, onChange, variant }) {
  const items = [
    { id: "mnemonic", label: "助记词", icon: <WalletCards size={18} /> },
    { id: "vanity", label: "靓号", icon: <Sparkles size={18} /> },
    { id: "tx", label: "交易", icon: <Send size={18} /> },
    { id: "unit", label: "精度转换", icon: <Calculator size={18} /> },
    { id: "time", label: "时间转换", icon: <Clock size={18} /> },
  ];

  return (
    <nav className={`page-nav ${variant === "bottom" ? "bottom-nav" : "side-nav"}`} aria-label="页面切换">
      {items.map((item) => (
        <button
          className={activePage === item.id ? "active" : ""}
          key={item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function getPageTitle(page) {
  if (page === "vanity") return "靓号生成";
  if (page === "tx") return "交易";
  if (page === "unit") return "精度转换";
  if (page === "time") return "时间转换";
  return "助记词地址派生";
}

function Panel({ icon, title, children }) {
  return (
    <section className="panel">
      <div className="panel-title">
        {React.cloneElement(icon, { size: 20 })}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function AddressTable({ rows, showSecrets, empty }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>地址</th>
            <th>私钥</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="empty" colSpan="4">{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${row.address}-${index}`}>
                <td>{row.index ?? index + 1}</td>
                <td className="mono">{row.address}</td>
                <td className="mono secret">{showSecrets ? row.privateKey : maskValue(row.privateKey)}</td>
                <td className="copy-actions">
                  <button className="mini-copy" title="复制地址" onClick={() => copyText(row.address)}>
                    地址
                  </button>
                  <button className="mini-copy" title="复制私钥" onClick={() => copyText(row.privateKey)}>
                    私钥
                  </button>
                  <button className="icon-button" title="复制地址和私钥" onClick={() => copyText(`${row.address}\n${row.privateKey}`)}>
                    <Copy size={15} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResultBox({ status, result }) {
  if (!status && !result) return null;
  return (
    <div className="result-card">
      {status && <p className={result ? "success" : "muted"}>{status}</p>}
      {result && (
        <>
          <ValueRow label="网络" value={result.network} />
          <ValueRow label="地址" value={result.address} />
          <ValueRow label="主币余额" value={`${result.nativeBalance} ${result.nativeSymbol}`} />
          {result.token && <ValueRow label={result.token.name} value={`${result.token.balance} ${result.token.symbol}`} />}
        </>
      )}
    </div>
  );
}

function UnitHistory({ items, onRemove }) {
  if (items.length === 0) return <p className="muted">转换记录会临时显示在这里。</p>;
  return (
    <div className="compact-history">
      {items.map((item) => (
        <div className="compact-history-item" key={item.id}>
          <code>{item.raw}</code>
          <span>decimals {item.decimals}</span>
          <code>{item.readable}</code>
          <button className="icon-button" title="删除记录" onClick={() => onRemove(item.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function InlineTimeResult({ result, mode }) {
  if (!result) return null;
  if (result.error) return <span className="inline-result error-text">{result.error}</span>;
  if (result.mode !== mode) return null;
  const value = mode === "timestamp" ? `${result.zoned} · ${result.timeZone}` : result.timestampSeconds;
  return <code className="inline-result">{value}</code>;
}

function TimeHistory({ items, onRemove }) {
  if (items.length === 0) return <p className="muted">转换记录会临时显示在这里。</p>;
  return (
    <div className="compact-history">
      {items.map((item) => (
        <div className="compact-history-item time-history-item" key={item.id}>
          <span>{item.timeZone}</span>
          <code>{item.zoned}</code>
          <code>{item.timestampSeconds}</code>
          <button className="icon-button" title="删除记录" onClick={() => onRemove(item.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PendingTxCard({ pendingTx, onChange, onConfirm, onAdd, onClear }) {
  if (!pendingTx) return null;
  const draft = pendingTx.draft || txToDraft(pendingTx.tx);
  return (
    <div className="result-card pending-card">
      <div className="history-title">
        <span>{pendingTx.title}</span>
        <button className="icon-button" title="清除待签名内容" onClick={onClear}>
          <Trash2 size={15} />
        </button>
      </div>
      {pendingTx.from && <ValueRow label="From" value={pendingTx.from} />}
      {pendingTx.chainId && <ValueRow label="Chain ID" value={pendingTx.chainId} />}
      <EditableTxField label="To" value={draft.to} onChange={(value) => onChange("to", value)} />
      <EditableTxField label={`Value ${pendingTx.symbol || "ETH"}`} value={draft.value} onChange={(value) => onChange("value", value)} placeholder="0" />
      <EditableTxField label="Data" value={draft.data} onChange={(value) => onChange("data", value)} placeholder="0x" multiline />
      <div className="form-grid three tx-draft-grid">
        <EditableTxField label="GasPrice Gwei" value={draft.gasPrice} onChange={(value) => onChange("gasPrice", value)} placeholder="自动" />
        <EditableTxField label="GasLimit" value={draft.gasLimit} onChange={(value) => onChange("gasLimit", value)} placeholder="自动" />
        <EditableTxField label="Nonce" value={draft.nonce} onChange={(value) => onChange("nonce", value)} placeholder="自动" />
      </div>
      {pendingTx.hash && <ValueRow label="Tx Hash" value={pendingTx.hash} />}
      {!pendingTx.hash && (
        <div className="action-row">
          {onAdd && (
            <button className="secondary" onClick={onAdd}>
              <Plus size={17} />
              加入交易列表
            </button>
          )}
          <button className="primary" onClick={onConfirm}>
            <Send size={17} />
            确认签名并广播
          </button>
        </div>
      )}
    </div>
  );
}

function EditableTxField({ label, value, onChange, placeholder, multiline = false }) {
  return (
    <label>
      <span>{label}</span>
      {multiline ? (
        <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={3} placeholder={placeholder} />
      ) : (
        <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function QueuedTxList({ items, onSend, onRemove, onClear }) {
  if (items.length === 0) {
    return <p className="muted">交易草稿会显示在这里，可以逐条签名广播。</p>;
  }

  return (
    <div className="queue-list">
      <div className="history-title">
        <span>{items.length} 笔待处理交易</span>
        <button className="icon-button" title="清空交易列表" onClick={onClear}>
          <Trash2 size={15} />
        </button>
      </div>
      {items.map((item, index) => (
        <div className="queue-item" key={item.id}>
          <div className="history-title">
            <span>
              #{index + 1} {item.title}
            </span>
            <button className="icon-button" title="移除交易" onClick={() => onRemove(item.id)}>
              <Trash2 size={15} />
            </button>
          </div>
          <ValueRow label="To" value={item.tx.to || ""} />
          <ValueRow label="Value" value={item.tx.value ? `${formatEther(item.tx.value)} ${item.symbol || "ETH"}` : "0"} />
          <ValueRow label="Data" value={item.tx.data || "0x"} />
          <ValueRow label="创建时间" value={item.createdAt} />
          {item.hash ? (
            <ValueRow label="Tx Hash" value={item.hash} />
          ) : (
            <button className="primary" onClick={() => onSend(item.id)}>
              <Send size={17} />
              签名并广播
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusLine({ attempts, text }) {
  return (
    <div className="status-line">
      <Coins size={16} />
      <span>{text}</span>
      <strong>{attempts.toLocaleString()} 次</strong>
    </div>
  );
}

function ValueRow({ label, value }) {
  return (
    <div className="value-row">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

async function buildPendingTxDraft(title, tx, wallet, source, symbol) {
  const provider = wallet.provider;
  const from = wallet.address;
  const enriched = { ...tx, from };
  let chainId = "";

  try {
    const network = await provider.getNetwork();
    chainId = network.chainId.toString();
  } catch {
    chainId = "";
  }

  try {
    enriched.nonce = await provider.getTransactionCount(from, "pending");
  } catch {
    enriched.nonce = undefined;
  }

  try {
    enriched.gasLimit = await wallet.estimateGas(enriched);
  } catch {
    enriched.gasLimit = undefined;
  }

  try {
    const feeData = await provider.getFeeData();
    enriched.gasPrice = feeData.gasPrice ?? undefined;
  } catch {
    enriched.gasPrice = undefined;
  }

  return {
    title,
    tx: compactTransaction(enriched),
    draft: txToDraft(enriched),
    symbol,
    source,
    from,
    chainId,
  };
}

function txToDraft(tx = {}) {
  return {
    to: tx.to || "",
    value: tx.value ? formatEther(tx.value) : "0",
    data: tx.data || "0x",
    gasPrice: tx.gasPrice ? formatUnits(tx.gasPrice, "gwei") : "",
    gasLimit: tx.gasLimit ? tx.gasLimit.toString() : "",
    nonce: tx.nonce !== undefined && tx.nonce !== null ? String(tx.nonce) : "",
  };
}

function draftToTransaction(draft) {
  const tx = {
    to: getAddress(draft.to.trim()),
    value: parseEther(draft.value.trim() || "0"),
    data: normalizeTxData(draft.data || ""),
  };

  if (draft.gasPrice.trim()) tx.gasPrice = parseUnits(draft.gasPrice.trim(), "gwei");
  if (draft.gasLimit.trim()) tx.gasLimit = BigInt(draft.gasLimit.trim());
  if (draft.nonce.trim()) tx.nonce = Number(draft.nonce.trim());

  return tx;
}

function compactTransaction(tx) {
  return Object.fromEntries(Object.entries(tx).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function formatDateInTimeZone(date, timeZone) {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

function zonedDateTimeToDate(value, timeZone) {
  const parts = parseDateTimeInput(value);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let timestamp = localAsUtc;

  for (let index = 0; index < 3; index += 1) {
    timestamp = localAsUtc - getTimeZoneOffsetMs(new Date(timestamp), timeZone);
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error("日期时间无效。");
  return date;
}

function parseDateTimeInput(value) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) throw new Error("日期时间格式应为 YYYY-MM-DD HH:mm:ss。");
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || "0"),
    minute: Number(match[5] || "0"),
    second: Number(match[6] || "0"),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getDateTimeParts(date, timeZone);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return zonedAsUtc - date.getTime();
}

function getDateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function cleanHex(value) {
  return value.trim().replace(/^0x/i, "").toLowerCase();
}

function normalizeWords(value) {
  return value.trim().toLowerCase().split(/\s+/).join(" ");
}

function maskValue(value) {
  if (!value) return "";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text);
}

function normalizeTxData(value) {
  const data = value.trim();
  if (!data) return "0x";
  if (!/^0x[0-9a-f]*$/i.test(data)) throw new Error("Data 必须是 0x 开头的十六进制。");
  return data;
}

function parseAbiFragments(value) {
  const text = value.trim();
  if (!text) throw new Error("请输入 ABI。");
  try {
    return JSON.parse(text);
  } catch {
    const matches = [...text.matchAll(/(['"])(.*?)\1/g)].map((match) => match[2]);
    if (matches.length > 0) return matches;
    throw new Error("ABI 格式不正确。支持 JSON ABI 或 ['function ...'] 片段数组。");
  }
}

function parseAbiValue(type, value) {
  const text = value.trim();
  if (type.endsWith("[]") || type.startsWith("tuple")) return JSON.parse(text);
  if (type === "address") return getAddress(text);
  if (type === "bool") return text === "true" || text === "1";
  if (type.startsWith("uint") || type.startsWith("int")) return text;
  if (type.startsWith("bytes")) return normalizeTxData(text);
  return text;
}

function isReadOnlyFunction(func) {
  return func.stateMutability === "view" || func.stateMutability === "pure";
}

function formatCallResult(result) {
  if (typeof result === "bigint") return result.toString();
  if (Array.isArray(result)) return JSON.stringify(result.map((item) => (typeof item === "bigint" ? item.toString() : item)));
  if (result && typeof result === "object") {
    return JSON.stringify(result, (_, value) => (typeof value === "bigint" ? value.toString() : value));
  }
  return String(result);
}

function readError(error) {
  return error.shortMessage || error.reason || error.message || "操作失败。";
}

function loadRpcNodes() {
  try {
    const saved = JSON.parse(localStorage.getItem(RPC_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_RPC_NODES;
    const nodes = saved
      .filter((node) => node?.name && node?.url)
      .map((node) => ({
        id: node.id || crypto.randomUUID(),
        name: String(node.name),
        url: String(node.url),
        symbol: String(node.symbol || "ETH"),
      }));
    return nodes.length > 0 ? nodes : DEFAULT_RPC_NODES;
  } catch {
    return DEFAULT_RPC_NODES;
  }
}

function loadSelectedRpcId(nodes) {
  try {
    const saved = localStorage.getItem(SELECTED_RPC_STORAGE_KEY);
    return nodes.some((node) => node.id === saved) ? saved : nodes[0]?.id ?? "";
  } catch {
    return nodes[0]?.id ?? "";
  }
}

function upsertWallet(items, wallet) {
  return [
    wallet,
    ...items.filter((item) => item.address !== wallet.address),
  ];
}

function saveStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be disabled in strict browser privacy modes.
  }
}

function removeStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage can be disabled in strict browser privacy modes.
  }
}

const rootElement = document.getElementById("root");
const root = window.__walletStudioRoot ?? createRoot(rootElement);
window.__walletStudioRoot = root;
root.render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
