function nextBattle() {
let [a, b] = chooseBestPair();
if (Math.random() < 0.5) {
[a, b] = [b, a];
}
leftColor = a;
rightColor = b;
renderBattle();
saveState();
}
function mergePairMaps(...maps) {
const result = new Map();
for (const entries of maps) {
if (!Array.isArray(entries)) continue;
for (const [key, value] of entries) {
result.set(key, (result.get(key) ?? 0) + Number(value || 0));
}
}
return result;
}
function sanitizeLoadedColors(rawColors) {
if (!Array.isArray(rawColors) || rawColors.length !== 125) return null;
const cleaned = rawColors.map((c, index) => ({
id: Number.isFinite(c.id) ? c.id : index,
r: Number(c.r),
g: Number(c.g),
b: Number(c.b),
mu: Number.isFinite(c.mu) ? c.mu : INITIAL_MU,
sigma: Number.isFinite(c.sigma) ? c.sigma : INITIAL_SIGMA,
games: Number.isFinite(c.games) ? c.games : 0,
wins: Number.isFinite(c.wins) ? c.wins : 0,
losses: Number.isFinite(c.losses) ? c.losses : 0
}));
if (cleaned.some(c =>
!Number.isFinite(c.r) ||
!Number.isFinite(c.g) ||
!Number.isFinite(c.b)
)) return null;
return cleaned;
}
function saveState() {
try {
const payload = {
schemaVersion: SCHEMA_VERSION,
battleCount,
colors,
pairCounts: [...pairCounts.entries()],
leftColorId: leftColor?.id ?? null,
rightColorId: rightColor?.id ?? null,
savedAt: Date.now()
};
localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
$("saveStatus").textContent = "保存済";
} catch (error) {
console.error(error);
$("saveStatus").textContent = "保存不可";
}
}
function loadState() {
try {
const raw = localStorage.getItem(SAVE_KEY);
if (!raw) return false;
const parsed = JSON.parse(raw);
const loadedColors = sanitizeLoadedColors(parsed.colors);
if (!loadedColors) return false;
if (!parsed.schemaVersion || parsed.schemaVersion < SCHEMA_VERSION) {
try {
if (!localStorage.getItem(BACKUP_KEY)) {
localStorage.setItem(BACKUP_KEY, raw);
}
} catch (_) {}
}
colors = loadedColors;
battleCount = Number.isFinite(parsed.battleCount) ? parsed.battleCount : 0;
pairCounts = parsed.pairCounts
? new Map(parsed.pairCounts)
: mergePairMaps(parsed.tierPairCounts, parsed.rankPairCounts);
leftColor = colors.find(c => c.id === parsed.leftColorId) ?? null;
rightColor = colors.find(c => c.id === parsed.rightColorId) ?? null;
analysisCache = null;
analysisAtBattle = -999;
return true;
} catch (error) {
console.error(error);
return false;
}
}
function clearState() {
try {
localStorage.removeItem(SAVE_KEY);
} catch (_) {}
}
function processChoice(winner, loser) {
updateTrueSkill(winner, loser);
addPairCount(winner, loser);
battleCount++;
analysisCache = null;
saveState();
}
function renderColor(side, color) {
const button = $(side + "Color");
if (!color) {
button.disabled = true;
button.style.background = "#23262d";
$(side + "Hex").textContent = "完了";
$(side + "Rgb").textContent = "";
return;
}
button.disabled = false;
button.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
$(side + "Hex").textContent = toHex(color);
$(side + "Rgb").textContent = `RGB(${color.r}, ${color.g}, ${color.b})`;
}
function renderBattle() {
renderColor("left", leftColor);
renderColor("right", rightColor);
}
function confidenceProgress(analysis) {
const normalRatio =
analysis.normalTrusted /
Math.max(1, analysis.normalTargetCount);
const top10Ratio =
analysis.topTrusted /
TOP_COUNT;
return clamp(
analysis.globalProbability * 0.42 +
analysis.top3ExactProbability * 0.28 +
clamp(normalRatio, 0, 1) * 0.14 +
clamp(top10Ratio, 0, 1) * 0.10 +
analysis.averageConfidence * 0.06,
0,
1
);
}
function renderStats(forceAnalysis = false) {
const analysis = getAnalysis(forceAnalysis);
const probabilityPct = Math.round(analysis.globalProbability * 100);
const progressPct = Math.round(confidenceProgress(analysis) * 100);
$("goalProbability").textContent = `${probabilityPct}%`;
$("progressFill").style.width = `${progressPct}%`;
if (analysis.globalProbability >= TARGET_GLOBAL_PROBABILITY) {
$("progressStatus").innerHTML = "目標達成<br>Top3の順番まで確定";
$("subtitle").textContent = "目標精度に到達。さらに比較して精密化も可能";
} else if (probabilityPct >= 60) {
$("progressStatus").innerHTML = "終盤<br>近傍順位を重点比較";
$("subtitle").textContent = "順位が近い色を重点的に比較";
} else if (probabilityPct >= 20) {
$("progressStatus").innerHTML = "収束中<br>不確実な近傍を優先";
$("subtitle").textContent = "より好きな色を選択";
} else {
$("progressStatus").innerHTML = "探索中<br>比較価値の高いペアを選択";
$("subtitle").textContent = "より好きな色を選択";
}
$("battleCount").textContent = battleCount.toLocaleString();
$("normalTrusted").textContent = `${analysis.normalTrusted} / ${analysis.normalTargetCount}`;
$("topTrusted").textContent = `${analysis.topTrusted} / ${TOP_COUNT}`;
$("top3Exact").textContent =
`${Math.round(analysis.top3ExactProbability * 100)}%`;
}
function renderRanking() {
const analysis = getAnalysis();
const sorted = analysis.pointSorted ?? getSortedColors();
const container = $("tiers");
container.innerHTML = "";
const tierData = { S: [], A: [], B: [], C: [], D: [] };
sorted.forEach((color, index) => {
tierData[getTierName(index, sorted.length)].push({ color, index });
});
for (const tierName of TIER_NAMES) {
const row = document.createElement("div");
row.className = "tier";
const label = document.createElement("div");
label.className = `tier-label ${tierName}`;
label.textContent = tierName;
const list = document.createElement("div");
list.className = "tier-colors";
for (const entry of tierData[tierName]) {
const color = entry.color;
const rank = entry.index + 1;
const info = analysis.info.get(color.id);
const item = document.createElement("div");
item.className = "rank-color";
item.style.background = `rgb(${color.r},${color.g},${color.b})`;
item.title =
`${rank}位 ${toHex(color)}\n` +
`90%推定範囲: ${info.lowRank}〜${info.highRank}位\n` +
`${rank <= TOP3_COUNT ? "完全順位一致" : "目標範囲内"}信頼度: ${Math.round(info.confidence * 100)}%\n` +
`比較: ${color.games}回`;
const number = document.createElement("span");
number.className = "rank-number";
number.textContent = rank;
const confidence = document.createElement("div");
confidence.className = "rank-confidence";
const fill = document.createElement("span");
fill.style.width = `${Math.round(info.confidence * 100)}%`;
confidence.appendChild(fill);
item.append(number, confidence);
list.appendChild(item);
}
row.append(label, list);
container.appendChild(row);
}
}
function renderAll(forceAnalysis = false) {
renderBattle();
renderStats(forceAnalysis);
renderRanking();
}
function createBurst(button, event) {
const rect = button.getBoundingClientRect();
const burst = document.createElement("span");
burst.className = "burst";
const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
const y = event.clientY ? event.clientY - rect.top : rect.height / 2;
burst.style.left = `${x}px`;
burst.style.top = `${y}px`;
button.appendChild(burst);
setTimeout(() => burst.remove(), 390);
}
function handleChoice(winner, loser, winnerButton, loserButton, event) {
if (inputLocked || !winner || !loser) return;
inputLocked = true;
createBurst(winnerButton, event);
winnerButton.classList.add("chosen");
loserButton.classList.add("rejected");
try {
if ("vibrate" in navigator) navigator.vibrate(8);
} catch (_) {}
processChoice(winner, loser);
setTimeout(() => {
winnerButton.classList.remove("chosen");
loserButton.classList.remove("rejected");
nextBattle();
if (battleCount % ANALYSIS_INTERVAL === 0) {
renderAll(true);
} else {
renderAll(false);
}
inputLocked = false;
}, FEEDBACK_TIME);
}
function downloadBlob(blob, filename) {
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportData() {
const payload = {
app: "Color Battle",
schemaVersion: SCHEMA_VERSION,
exportedAt: new Date().toISOString(),
battleCount,
colors,
pairCounts: [...pairCounts.entries()]
};
downloadBlob(
new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
`color-battle-backup-${new Date().toISOString().slice(0,10)}.json`
);
}
async function importDataFile(file) {
const text = await file.text();
const parsed = JSON.parse(text);
const loadedColors = sanitizeLoadedColors(parsed.colors);
if (!loadedColors) throw new Error("互換性のないデータです。");
colors = loadedColors;
battleCount = Number.isFinite(parsed.battleCount) ? parsed.battleCount : 0;
pairCounts = Array.isArray(parsed.pairCounts)
? new Map(parsed.pairCounts)
: new Map();
analysisCache = null;
analysisAtBattle = -999;
leftColor = null;
rightColor = null;
nextBattle();
renderAll(true);
saveState();
}
function canvasTextColor(r, g, b) {
const brightness = r * .299 + g * .587 + b * .114;
return brightness > 158 ? "#101216" : "#ffffff";
}
function roundedRect(ctx, x, y, w, h, radius) {
const r = Math.min(radius, w/2, h/2);
ctx.beginPath();
ctx.moveTo(x+r, y);
ctx.arcTo(x+w, y, x+w, y+h, r);
ctx.arcTo(x+w, y+h, x, y+h, r);
ctx.arcTo(x, y+h, x, y, r);
ctx.arcTo(x, y, x+w, y, r);
ctx.closePath();
}
function exportRankingImage() {
const analysis = getAnalysis(true);
const sorted = analysis.pointSorted ?? getSortedColors();
const logicalWidth = 1600;
const scale = 2;
const margin = 56;
const labelWidth = 92;
const gap = 10;
const columns = 13;
const tileW = 100;
const tileH = 80;
const rowGap = 11;
const tierData = { S: [], A: [], B: [], C: [], D: [] };
sorted.forEach((color, index) => {
tierData[getTierName(index, sorted.length)].push({ color, rank: index + 1 });
});
const headerH = 190;
let bodyH = 0;
for (const tier of TIER_NAMES) {
const rows = Math.max(1, Math.ceil(tierData[tier].length / columns));
bodyH += rows * (tileH + rowGap) + 36;
}
const logicalHeight = headerH + bodyH + 70;
const canvas = document.createElement("canvas");
canvas.width = logicalWidth * scale;
canvas.height = logicalHeight * scale;
const ctx = canvas.getContext("2d");
ctx.scale(scale, scale);
ctx.fillStyle = "#0e1014";
ctx.fillRect(0, 0, logicalWidth, logicalHeight);
const gradient = ctx.createLinearGradient(0, 0, logicalWidth, 0);
gradient.addColorStop(0, "rgba(255,255,255,.08)");
gradient.addColorStop(1, "rgba(255,255,255,0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, logicalWidth, 145);
ctx.fillStyle = "#f5f7fa";
ctx.font = "900 54px system-ui, sans-serif";
ctx.fillText("COLOR RANKING", margin, 80);
ctx.fillStyle = "#9299a5";
ctx.font = "500 22px system-ui, sans-serif";
const pct = Math.round(analysis.globalProbability * 100);
ctx.fillText(
`${colors.length} colors  •  ${battleCount.toLocaleString()} comparisons  •  confidence ${pct}%  •  Top3 exact ${Math.round(analysis.top3ExactProbability * 100)}%`,
margin,
120
);
ctx.fillStyle = "#656d78";
ctx.font = "500 16px system-ui, sans-serif";
ctx.fillText(
`Goal: 90% of all colors within ±5, Top10 within ±2, and exact 1st/2nd/3rd order at 90% probability`,
margin,
151
);
let y = headerH;
const tierFill = {
S: "#ff8080",
A: "#ffbd78",
B: "#fff37d",
C: "#82e98a",
D: "#82b8ff"
};
for (const tier of TIER_NAMES) {
const entries = tierData[tier];
const rows = Math.max(1, Math.ceil(entries.length / columns));
const groupH = rows * (tileH + rowGap) - rowGap;
ctx.fillStyle = tierFill[tier];
roundedRect(ctx, margin, y, labelWidth, groupH, 14);
ctx.fill();
ctx.fillStyle = "#111318";
ctx.font = "1000 40px system-ui, sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText(tier, margin + labelWidth/2, y + groupH/2);
ctx.textAlign = "left";
ctx.textBaseline = "alphabetic";
entries.forEach((entry, i) => {
const col = i % columns;
const row = Math.floor(i / columns);
const x = margin + labelWidth + 18 + col * (tileW + gap);
const ty = y + row * (tileH + rowGap);
const c = entry.color;
ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
roundedRect(ctx, x, ty, tileW, tileH, 10);
ctx.fill();
ctx.strokeStyle = "rgba(255,255,255,.13)";
ctx.lineWidth = 1;
ctx.stroke();
const textColor = canvasTextColor(c.r, c.g, c.b);
ctx.fillStyle = "rgba(0,0,0,.62)";
roundedRect(ctx, x+6, ty+6, 29, 24, 12);
ctx.fill();
ctx.fillStyle = "#fff";
ctx.font = "800 13px system-ui, sans-serif";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText(String(entry.rank), x+20.5, ty+18);
ctx.fillStyle = textColor;
ctx.font = "800 13px ui-monospace, SFMono-Regular, Menlo, monospace";
ctx.textAlign = "left";
ctx.textBaseline = "alphabetic";
ctx.fillText(toHex(c), x+8, ty+69);
});
y += groupH + 36;
}
ctx.fillStyle = "#5f6670";
ctx.font = "500 14px system-ui, sans-serif";
ctx.fillText(`Generated ${new Date().toLocaleString("ja-JP")}`, margin, logicalHeight - 28);
canvas.toBlob(blob => {
if (!blob) return;
downloadBlob(
blob,
`color-ranking-${new Date().toISOString().slice(0,10)}.png`
);
}, "image/png", 1);
}
