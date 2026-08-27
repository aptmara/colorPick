"use strict";
const SAVE_KEY = "color-battle-tier-rank-v1";
const BACKUP_KEY = "color-battle-tier-rank-v1-backup";
const SCHEMA_VERSION = 2;
const RGB_STEP = 64;
const INITIAL_MU = 25;
const INITIAL_SIGMA = INITIAL_MU / 3;
const BETA = INITIAL_MU / 6;
const TAU = INITIAL_MU / 300;
const BOOTSTRAP_GAMES = 2;
const MONTE_CARLO_SAMPLES = 320;
const ANALYSIS_INTERVAL = 3;
const TARGET_GLOBAL_PROBABILITY = 0.90;
const TARGET_PER_COLOR_CONFIDENCE = 0.90;
const NORMAL_TOLERANCE = 5;
const TOP_TOLERANCE = 2;
const TOP_COUNT = 10;
const TOP3_COUNT = 3;
const TOP3_TOLERANCE = 0;
const REQUIRED_NORMAL_RATIO = 0.90;
const FEEDBACK_TIME = 165;
const TIER_NAMES = ["S", "A", "B", "C", "D"];
let colors = [];
let pairCounts = new Map();
let battleCount = 0;
let leftColor = null;
let rightColor = null;
let inputLocked = false;
let analysisCache = null;
let analysisAtBattle = -999;
let stableGoalHits = 0;
const $ = id => document.getElementById(id);
function clamp(v, min, max) {
return Math.min(max, Math.max(min, v));
}
function createColorSet() {
const values = [];
for (let v = 0; v <= 255; v += RGB_STEP) values.push(v);
if (values[values.length - 1] !== 255) values.push(255);
colors = [];
let id = 0;
for (const r of values) {
for (const g of values) {
for (const b of values) {
colors.push({
id: id++,
r, g, b,
mu: INITIAL_MU,
sigma: INITIAL_SIGMA,
games: 0,
wins: 0,
losses: 0
});
}
}
}
}
function toHex(color) {
const h = v => v.toString(16).padStart(2, "0").toUpperCase();
return `#${h(color.r)}${h(color.g)}${h(color.b)}`;
}
function pairKey(a, b) {
const lo = Math.min(a.id, b.id);
const hi = Math.max(a.id, b.id);
return `${lo}-${hi}`;
}
function getPairCount(a, b) {
return pairCounts.get(pairKey(a, b)) ?? 0;
}
function addPairCount(a, b) {
const key = pairKey(a, b);
pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
}
function erf(x) {
const sign = x < 0 ? -1 : 1;
x = Math.abs(x);
const a1 = 0.254829592;
const a2 = -0.284496736;
const a3 = 1.421413741;
const a4 = -1.453152027;
const a5 = 1.061405429;
const p = 0.3275911;
const t = 1 / (1 + p * x);
const y = 1 - (((((a5*t + a4)*t + a3)*t + a2)*t + a1) * t * Math.exp(-x*x));
return sign * y;
}
function normalPdf(x) {
return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function normalCdf(x) {
return 0.5 * (1 + erf(x / Math.SQRT2));
}
function randomNormal() {
let u = 0;
let v = 0;
while (u === 0) u = Math.random();
while (v === 0) v = Math.random();
return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function predictedProbability(a, b) {
const c = Math.sqrt(
2 * BETA * BETA +
a.sigma * a.sigma +
b.sigma * b.sigma
);
return clamp(normalCdf((a.mu - b.mu) / c), 0.000001, 0.999999);
}
function binaryEntropy(p) {
return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}
function updateTrueSkill(winner, loser) {
const ws = Math.sqrt(winner.sigma ** 2 + TAU ** 2);
const ls = Math.sqrt(loser.sigma ** 2 + TAU ** 2);
const c = Math.sqrt(
2 * BETA * BETA +
ws * ws +
ls * ls
);
const t = (winner.mu - loser.mu) / c;
const cdf = Math.max(normalCdf(t), 1e-9);
const v = normalPdf(t) / cdf;
const w = v * (v + t);
const wv = ws * ws;
const lv = ls * ls;
winner.mu += (wv / c) * v;
loser.mu -= (lv / c) * v;
winner.sigma = Math.sqrt(
Math.max(0.05, wv * (1 - (wv / (c*c)) * w))
);
loser.sigma = Math.sqrt(
Math.max(0.05, lv * (1 - (lv / (c*c)) * w))
);
winner.games++;
loser.games++;
winner.wins++;
loser.losses++;
}
function pointRankingValue(color) {
return color.mu;
}
function getSortedColors() {
return [...colors].sort((a, b) => pointRankingValue(b) - pointRankingValue(a));
}
function getTierName(index, total) {
const ratio = index / total;
if (ratio < 0.10) return "S";
if (ratio < 0.30) return "A";
if (ratio < 0.60) return "B";
if (ratio < 0.85) return "C";
return "D";
}
function currentRankMap() {
const sorted = getSortedColors();
const map = new Map();
sorted.forEach((color, index) => map.set(color.id, index + 1));
return { sorted, map };
}
function percentile(sortedValues, p) {
if (!sortedValues.length) return 1;
const pos = (sortedValues.length - 1) * p;
const lo = Math.floor(pos);
const hi = Math.ceil(pos);
if (lo === hi) return sortedValues[lo];
const t = pos - lo;
return sortedValues[lo] * (1 - t) + sortedValues[hi] * t;
}
function runMonteCarloAnalysis() {
const { sorted: pointSorted, map: pointRank } = currentRankMap();
const rankSamples = new Map();
for (const color of colors) rankSamples.set(color.id, []);
let globalSuccesses = 0;
let top3ExactSuccesses = 0;
for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
const simulated = colors.map(color => ({
color,
score: color.mu + randomNormal() * color.sigma
}));
simulated.sort((a, b) => b.score - a.score);
const sampledRank = new Map();
simulated.forEach((entry, index) => {
const rank = index + 1;
sampledRank.set(entry.color.id, rank);
rankSamples.get(entry.color.id).push(rank);
});
let normalWithin = 0;
let topOk = true;
let top3ExactOk = true;
for (const color of colors) {
const current = pointRank.get(color.id);
const sampled = sampledRank.get(color.id);
const delta = Math.abs(sampled - current);
if (delta <= NORMAL_TOLERANCE) normalWithin++;
if (
current <= TOP_COUNT &&
delta > TOP_TOLERANCE
) {
topOk = false;
}
if (
current <= TOP3_COUNT &&
delta > TOP3_TOLERANCE
) {
top3ExactOk = false;
}
}
if (top3ExactOk) {
top3ExactSuccesses++;
}
const normalNeeded = Math.ceil(colors.length * REQUIRED_NORMAL_RATIO);
if (
normalWithin >= normalNeeded &&
topOk &&
top3ExactOk
) {
globalSuccesses++;
}
}
const info = new Map();
let normalTrusted = 0;
let topTrusted = 0;
let top3Trusted = 0;
for (const color of colors) {
const samples = rankSamples.get(color.id).sort((a, b) => a - b);
const current = pointRank.get(color.id);
const tolerance =
current <= TOP3_COUNT
? TOP3_TOLERANCE
: current <= TOP_COUNT
? TOP_TOLERANCE
: NORMAL_TOLERANCE;
let targetWithin = 0;
let normalWithin = 0;
let top10Within = 0;
for (const sampled of samples) {
const delta = Math.abs(sampled - current);
if (delta <= tolerance) {
targetWithin++;
}
if (delta <= NORMAL_TOLERANCE) {
normalWithin++;
}
if (delta <= TOP_TOLERANCE) {
top10Within++;
}
}
const confidence = targetWithin / MONTE_CARLO_SAMPLES;
const normalConfidence = normalWithin / MONTE_CARLO_SAMPLES;
const top10Confidence = top10Within / MONTE_CARLO_SAMPLES;
const lowRank = Math.max(1, Math.round(percentile(samples, 0.05)));
const highRank = Math.min(colors.length, Math.round(percentile(samples, 0.95)));
if (normalConfidence >= TARGET_PER_COLOR_CONFIDENCE) {
normalTrusted++;
}
if (
current <= TOP_COUNT &&
top10Confidence >= TARGET_PER_COLOR_CONFIDENCE
) {
topTrusted++;
}
if (
current <= TOP3_COUNT &&
confidence >= TARGET_PER_COLOR_CONFIDENCE
) {
top3Trusted++;
}
info.set(color.id, {
currentRank: current,
lowRank,
highRank,
confidence,
normalConfidence,
top10Confidence,
tolerance
});
}
const globalProbability = globalSuccesses / MONTE_CARLO_SAMPLES;
const top3ExactProbability = top3ExactSuccesses / MONTE_CARLO_SAMPLES;
const avgConfidence =
[...info.values()].reduce((sum, x) => sum + x.confidence, 0) / colors.length;
const normalTargetCount = Math.ceil(colors.length * REQUIRED_NORMAL_RATIO);
analysisCache = {
info,
globalProbability,
averageConfidence: avgConfidence,
normalTrusted,
normalTargetCount,
topTrusted,
top3Trusted,
top3ExactProbability,
pointSorted
};
analysisAtBattle = battleCount;
if (globalProbability >= TARGET_GLOBAL_PROBABILITY) {
stableGoalHits++;
} else {
stableGoalHits = 0;
}
return analysisCache;
}
function getAnalysis(force = false) {
if (
force ||
!analysisCache ||
battleCount - analysisAtBattle >= ANALYSIS_INTERVAL
) {
return runMonteCarloAnalysis();
}
return analysisCache;
}
function rankIntervalOverlap(aInfo, bInfo) {
const low = Math.max(aInfo.lowRank, bInfo.lowRank);
const high = Math.min(aInfo.highRank, bInfo.highRank);
if (high < low) return 0;
const overlap = high - low + 1;
const spanA = aInfo.highRank - aInfo.lowRank + 1;
const spanB = bInfo.highRank - bInfo.lowRank + 1;
return overlap / Math.max(1, Math.min(spanA, spanB));
}
function chooseBootstrapPair() {
const minGames = Math.min(...colors.map(c => c.games));
const lowPlayed = colors.filter(c => c.games === minGames);
const anchor = lowPlayed[Math.floor(Math.random() * lowPlayed.length)];
const { map: ranks } = currentRankMap();
const anchorRank = ranks.get(anchor.id);
const candidates = colors
.filter(c => c !== anchor)
.sort((a, b) => {
const da = Math.abs(ranks.get(a.id) - anchorRank) + a.games * 0.35;
const db = Math.abs(ranks.get(b.id) - anchorRank) + b.games * 0.35;
return da - db;
})
.slice(0, 14);
let best = candidates[0];
let bestScore = -Infinity;
for (const c of candidates) {
const p = predictedProbability(anchor, c);
const score =
binaryEntropy(p) * 2 +
(1 / (1 + c.games)) -
getPairCount(anchor, c) * 0.6 +
Math.random() * 0.05;
if (score > bestScore) {
bestScore = score;
best = c;
}
}
return [anchor, best];
}
function chooseBestPair() {
if (Math.min(...colors.map(c => c.games)) < BOOTSTRAP_GAMES) {
return chooseBootstrapPair();
}
const analysis = getAnalysis();
const info = analysis.info;
let bestPair = null;
let bestScore = -Infinity;
for (let i = 0; i < colors.length; i++) {
const a = colors[i];
const ai = info.get(a.id);
for (let j = i + 1; j < colors.length; j++) {
const b = colors[j];
const bi = info.get(b.id);
const rankDistance = Math.abs(ai.currentRank - bi.currentRank);
const overlap = rankIntervalOverlap(ai, bi);
if (overlap === 0 && rankDistance > 8) continue;
const p = predictedProbability(a, b);
const entropy = binaryEntropy(p);
const repeats = getPairCount(a, b);
const repeatPenalty = 1 / (1 + repeats * 1.9);
const unresolvedA = 1 - clamp(ai.confidence / TARGET_PER_COLOR_CONFIDENCE, 0, 1);
const unresolvedB = 1 - clamp(bi.confidence / TARGET_PER_COLOR_CONFIDENCE, 0, 1);
const minRank = Math.min(ai.currentRank, bi.currentRank);
let importance = 1;
if (minRank <= 3) importance = 7.0;
else if (minRank <= 5) importance = 5.0;
else if (minRank <= 10) importance = 3.2;
else if (minRank <= 14) importance = 2.2;
else if (minRank <= 24) importance = 1.35;
const targetWidthForRank = rank =>
rank <= TOP3_COUNT
? 1
: rank <= TOP_COUNT
? TOP_TOLERANCE * 2 + 1
: NORMAL_TOLERANCE * 2 + 1;
const targetWidthA = targetWidthForRank(ai.currentRank);
const targetWidthB = targetWidthForRank(bi.currentRank);
const actualWidthA = ai.highRank - ai.lowRank + 1;
const actualWidthB = bi.highRank - bi.lowRank + 1;
const widthNeed =
clamp(actualWidthA / targetWidthA - 1, 0, 3) +
clamp(actualWidthB / targetWidthB - 1, 0, 3);
const neighborBoost =
rankDistance <= 1 ? 2.2 :
rankDistance <= 3 ? 1.65 :
rankDistance <= 6 ? 1.2 : 1;
const proximity = Math.exp(-rankDistance / 14);
const score =
(
0.35 +
entropy * 2.8 +
overlap * 2.2 +
(unresolvedA + unresolvedB) * 1.8 +
widthNeed * 0.75
)
* importance
* neighborBoost
* (
(
ai.lowRank <= TOP3_COUNT ||
bi.lowRank <= TOP3_COUNT
)
? (
Math.max(ai.currentRank, bi.currentRank) <= 5
? 2.35
: 1.55
)
: 1
)
* (0.45 + proximity * 0.55)
* repeatPenalty
+ Math.random() * 0.003;
if (score > bestScore) {
bestScore = score;
bestPair = [a, b];
}
}
}
if (bestPair) return bestPair;
const sorted = getSortedColors();
let fallback = [sorted[0], sorted[1]];
let fallbackScore = -Infinity;
for (let i = 0; i < sorted.length - 1; i++) {
const a = sorted[i];
const b = sorted[i + 1];
const s =
binaryEntropy(predictedProbability(a, b)) /
(1 + getPairCount(a, b));
if (s > fallbackScore) {
fallbackScore = s;
fallback = [a, b];
}
}
return fallback;
}
