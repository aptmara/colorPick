(() => {
"use strict";

const style = document.createElement("style");
style.textContent = `
.rank-color {
    cursor: pointer;
    outline: none;
    transition: transform .12s ease, box-shadow .12s ease;
}
.rank-color:focus-visible {
    box-shadow: 0 0 0 3px #fff, 0 0 0 6px #11151b;
    z-index: 2;
}
@media (hover:hover) and (pointer:fine) {
    .rank-color:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 8px 20px rgba(0,0,0,.3);
        z-index: 2;
    }
}
.color-detail-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(4,6,9,.72);
    backdrop-filter: blur(10px);
    animation: colorDetailFade .14s ease-out;
}
.color-detail-panel {
    width: min(720px, 100%);
    max-height: min(820px, calc(100vh - 36px));
    overflow: auto;
    overscroll-behavior: contain;
    border: 1px solid #303641;
    border-radius: 20px;
    background: #111419;
    box-shadow: 0 24px 80px rgba(0,0,0,.55);
    animation: colorDetailIn .16s ease-out;
}
.color-detail-head {
    display: grid;
    grid-template-columns: 112px minmax(0,1fr) 44px;
    gap: 16px;
    align-items: center;
    padding: 18px;
    border-bottom: 1px solid #282d36;
}
.color-detail-swatch {
    width: 112px;
    height: 112px;
    border-radius: 17px;
    border: 1px solid rgba(255,255,255,.14);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.08);
}
.color-detail-rank {
    color: #89919d;
    font-size: 12px;
    font-weight: 750;
    letter-spacing: .04em;
}
.color-detail-hex {
    margin-top: 3px;
    font-size: clamp(28px, 6vw, 42px);
    font-weight: 950;
    letter-spacing: -.035em;
}
.color-detail-sub {
    margin-top: 5px;
    color: #929aa6;
    font-size: 13px;
}
.color-detail-close {
    align-self: start;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid #343a44;
    border-radius: 12px;
    background: #1b1f26;
    color: #eef1f5;
    font-size: 24px;
    cursor: pointer;
}
.color-detail-body {
    padding: 18px;
}
.color-detail-section + .color-detail-section {
    margin-top: 22px;
}
.color-detail-section h3 {
    margin: 0 0 9px;
    color: #cbd1d9;
    font-size: 13px;
    letter-spacing: .02em;
}
.color-detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 8px;
}
.color-detail-card {
    min-width: 0;
    padding: 12px;
    border: 1px solid #282d35;
    border-radius: 12px;
    background: #171a20;
}
.color-detail-label {
    color: #7e8793;
    font-size: 11px;
}
.color-detail-value {
    margin-top: 4px;
    color: #f4f6f8;
    font-size: 18px;
    font-weight: 850;
    line-height: 1.2;
    overflow-wrap: anywhere;
}
.color-detail-note {
    margin-top: 5px;
    color: #737c88;
    font-size: 11px;
    line-height: 1.4;
}
.color-detail-meter {
    height: 7px;
    margin-top: 9px;
    overflow: hidden;
    border-radius: 999px;
    background: #2a2f38;
}
.color-detail-meter > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #eef1f5;
}
.color-neighbors {
    display: grid;
    grid-template-columns: repeat(5, minmax(0,1fr));
    gap: 7px;
}
.color-neighbor {
    min-width: 0;
    border: 1px solid #292f38;
    border-radius: 11px;
    overflow: hidden;
    background: #171a20;
}
.color-neighbor-swatch {
    height: 50px;
}
.color-neighbor-meta {
    padding: 7px;
}
.color-neighbor-rank {
    font-size: 12px;
    font-weight: 850;
}
.color-neighbor-hex {
    margin-top: 2px;
    color: #858e9a;
    font-size: 9px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.color-neighbor.current {
    border-color: #dce1e8;
    box-shadow: inset 0 0 0 1px #dce1e8;
}
.color-detail-disclaimer {
    margin-top: 18px;
    color: #69727e;
    font-size: 11px;
    line-height: 1.55;
}
@keyframes colorDetailFade {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes colorDetailIn {
    from { opacity: 0; transform: translateY(8px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 640px) {
    .color-detail-backdrop {
        place-items: end center;
        padding: 0;
    }
    .color-detail-panel {
        width: 100%;
        max-height: 88vh;
        border-radius: 20px 20px 0 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
    }
    .color-detail-head {
        grid-template-columns: 86px minmax(0,1fr) 42px;
        gap: 12px;
        padding: 14px;
    }
    .color-detail-swatch {
        width: 86px;
        height: 86px;
        border-radius: 14px;
    }
    .color-detail-body { padding: 14px; }
    .color-detail-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
    .color-neighbors { grid-template-columns: repeat(5, minmax(62px,1fr)); overflow-x: auto; }
}
@media (max-width: 380px) {
    .color-detail-grid { grid-template-columns: 1fr 1fr; }
    .color-detail-head { grid-template-columns: 72px minmax(0,1fr) 40px; }
    .color-detail-swatch { width: 72px; height: 72px; }
    .color-detail-value { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
    .color-detail-backdrop,
    .color-detail-panel { animation: none; }
}
`;
document.head.appendChild(style);

let backdrop = null;
let previousFocus = null;
let previousOverflow = "";

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > .5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

function srgbToLinear(v) {
    v /= 255;
    return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
}

function relativeLuminance(color) {
    return .2126 * srgbToLinear(color.r) +
           .7152 * srgbToLinear(color.g) +
           .0722 * srgbToLinear(color.b);
}

function contrastRatio(l1, l2) {
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + .05) / (lo + .05);
}

function opponentStats(color) {
    const opponents = new Set();
    let tracked = 0;

    for (const [key, countRaw] of pairCounts.entries()) {
        const [aRaw, bRaw] = String(key).split("-");
        const a = Number(aRaw);
        const b = Number(bRaw);
        const count = Number(countRaw) || 0;

        if (a === color.id) {
            opponents.add(b);
            tracked += count;
        } else if (b === color.id) {
            opponents.add(a);
            tracked += count;
        }
    }

    return {
        uniqueOpponents: opponents.size,
        trackedComparisons: tracked
    };
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 100)}%`;
}

function makeCard(label, value, note = "", meter = null) {
    const card = document.createElement("div");
    card.className = "color-detail-card";

    const labelEl = document.createElement("div");
    labelEl.className = "color-detail-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("div");
    valueEl.className = "color-detail-value";
    valueEl.textContent = value;

    card.append(labelEl, valueEl);

    if (meter !== null) {
        const meterEl = document.createElement("div");
        meterEl.className = "color-detail-meter";
        const fill = document.createElement("span");
        fill.style.width = `${Math.round(clamp(meter, 0, 1) * 100)}%`;
        meterEl.appendChild(fill);
        card.appendChild(meterEl);
    }

    if (note) {
        const noteEl = document.createElement("div");
        noteEl.className = "color-detail-note";
        noteEl.textContent = note;
        card.appendChild(noteEl);
    }

    return card;
}

function makeSection(title, cards) {
    const section = document.createElement("section");
    section.className = "color-detail-section";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const grid = document.createElement("div");
    grid.className = "color-detail-grid";
    cards.forEach(card => grid.appendChild(card));

    section.append(heading, grid);
    return section;
}

function closeColorDetail() {
    if (!backdrop) return;
    backdrop.remove();
    backdrop = null;
    document.body.style.overflow = previousOverflow;

    if (previousFocus && typeof previousFocus.focus === "function") {
        previousFocus.focus();
    }
}

function showColorDetail(rank) {
    const analysis = getAnalysis();
    const sorted = analysis.pointSorted ?? getSortedColors();
    const color = sorted[rank - 1];
    if (!color) return;

    const info = analysis.info.get(color.id);
    if (!info) return;

    closeColorDetail();

    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const tier = getTierName(rank - 1, sorted.length);
    const hsl = rgbToHsl(color.r, color.g, color.b);
    const lum = relativeLuminance(color);
    const contrastWhite = contrastRatio(lum, 1);
    const contrastBlack = contrastRatio(lum, 0);
    const preferredText = contrastWhite >= contrastBlack ? "白" : "黒";
    const wins = Number(color.wins) || 0;
    const losses = Number(color.losses) || 0;
    const games = Number(color.games) || wins + losses;
    const winRate = games > 0 ? wins / games : 0;
    const opponents = opponentStats(color);
    const intervalWidth = info.highRank - info.lowRank + 1;
    const targetLabel = rank <= TOP3_COUNT ? "順位完全一致" : rank <= TOP_COUNT ? "±2位" : "±5位";
    const tierStartRank = sorted.findIndex(c => getTierName(sorted.indexOf(c), sorted.length) === tier) + 1;
    const tierEntries = sorted.filter((_, index) => getTierName(index, sorted.length) === tier);
    const tierPosition = rank - tierStartRank + 1;

    backdrop = document.createElement("div");
    backdrop.className = "color-detail-backdrop";
    backdrop.setAttribute("role", "presentation");

    const panel = document.createElement("section");
    panel.className = "color-detail-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `${toHex(color)} の詳細`);

    const head = document.createElement("div");
    head.className = "color-detail-head";

    const swatch = document.createElement("div");
    swatch.className = "color-detail-swatch";
    swatch.style.background = `rgb(${color.r},${color.g},${color.b})`;

    const headText = document.createElement("div");
    const rankEl = document.createElement("div");
    rankEl.className = "color-detail-rank";
    rankEl.textContent = `#${rank}  •  ${tier} TIER  •  Tier内 ${tierPosition}/${tierEntries.length}`;

    const hexEl = document.createElement("div");
    hexEl.className = "color-detail-hex";
    hexEl.textContent = toHex(color);

    const sub = document.createElement("div");
    sub.className = "color-detail-sub";
    sub.textContent = `RGB(${color.r}, ${color.g}, ${color.b})  •  HSL(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`;

    headText.append(rankEl, hexEl, sub);

    const close = document.createElement("button");
    close.className = "color-detail-close";
    close.type = "button";
    close.setAttribute("aria-label", "詳細を閉じる");
    close.textContent = "×";
    close.addEventListener("click", closeColorDetail);

    head.append(swatch, headText, close);

    const body = document.createElement("div");
    body.className = "color-detail-body";

    const rankSection = makeSection("ランキング推定", [
        makeCard("現在順位", `${rank}位`, `${tier} Tier`),
        makeCard("90%推定順位範囲", `${info.lowRank}〜${info.highRank}位`, `幅 ${intervalWidth}順位`),
        makeCard(`${targetLabel} 信頼度`, formatPercent(info.confidence), "現在順位を基準にしたMonte Carlo推定", info.confidence),
        makeCard("±5位 信頼度", formatPercent(info.normalConfidence), "全体ランキング目標に使う指標", info.normalConfidence),
        makeCard("Top10 ±2 信頼度", rank <= TOP_COUNT ? formatPercent(info.top10Confidence) : "対象外", rank <= TOP_COUNT ? "Top10精度の判定値" : "11位以下では終了条件に使用しません", rank <= TOP_COUNT ? info.top10Confidence : null),
        makeCard("Top3 完全順位", rank <= TOP3_COUNT ? formatPercent(info.confidence) : "対象外", rank <= TOP3_COUNT ? `${rank}位そのものになる確率` : "Top3のみ順位完全一致を要求", rank <= TOP3_COUNT ? info.confidence : null)
    ]);

    const historySection = makeSection("比較履歴", [
        makeCard("比較回数", `${games}回`, opponents.trackedComparisons && opponents.trackedComparisons !== games ? `履歴追跡 ${opponents.trackedComparisons}回` : ""),
        makeCard("勝敗", `${wins}勝 ${losses}敗`),
        makeCard("勝率", games > 0 ? formatPercent(winRate) : "—", games > 0 ? "参考値。対戦相手の強さは均一ではありません" : "比較データなし", games > 0 ? winRate : null),
        makeCard("対戦相手数", `${opponents.uniqueOpponents}色`, "重複対戦を除いた数"),
        makeCard("再戦率", games > 0 ? formatPercent(clamp(1 - opponents.uniqueOpponents / games, 0, 1)) : "—", "高いほど同じ相手との比較が多い"),
        makeCard("総比較内シェア", battleCount > 0 ? formatPercent(games / (battleCount * 2)) : "—", "全色の出現回数に占める割合")
    ]);

    const colorSection = makeSection("色データ", [
        makeCard("HEX", toHex(color)),
        makeCard("RGB", `${color.r}, ${color.g}, ${color.b}`),
        makeCard("HSL", `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`),
        makeCard("相対輝度", lum.toFixed(3), "WCAG方式 0〜1"),
        makeCard("白文字コントラスト", `${contrastWhite.toFixed(2)}:1`, contrastWhite >= 4.5 ? "通常文字 AA目安を満たす" : "通常文字 AA目安未満"),
        makeCard("黒文字コントラスト", `${contrastBlack.toFixed(2)}:1`, `推奨文字色: ${preferredText}`)
    ]);

    const neighborSection = document.createElement("section");
    neighborSection.className = "color-detail-section";
    const neighborHeading = document.createElement("h3");
    neighborHeading.textContent = "近傍順位";
    const neighborGrid = document.createElement("div");
    neighborGrid.className = "color-neighbors";

    const start = clamp(rank - 3, 0, Math.max(0, sorted.length - 5));
    const end = Math.min(sorted.length, start + 5);

    for (let index = start; index < end; index++) {
        const neighbor = sorted[index];
        const neighborRank = index + 1;
        const card = document.createElement("div");
        card.className = `color-neighbor${neighborRank === rank ? " current" : ""}`;

        const neighborSwatch = document.createElement("div");
        neighborSwatch.className = "color-neighbor-swatch";
        neighborSwatch.style.background = `rgb(${neighbor.r},${neighbor.g},${neighbor.b})`;

        const meta = document.createElement("div");
        meta.className = "color-neighbor-meta";
        const nr = document.createElement("div");
        nr.className = "color-neighbor-rank";
        nr.textContent = `${neighborRank}位`;
        const nh = document.createElement("div");
        nh.className = "color-neighbor-hex";
        nh.textContent = toHex(neighbor);
        meta.append(nr, nh);
        card.append(neighborSwatch, meta);
        neighborGrid.appendChild(card);
    }

    neighborSection.append(neighborHeading, neighborGrid);

    const disclaimer = document.createElement("p");
    disclaimer.className = "color-detail-disclaimer";
    disclaimer.textContent = "順位範囲・信頼度は現在のTrueSkill系事後分布をMonte Carloサンプリングした推定値です。人間の選択自体が揺れる場合、数値が高くても絶対的な好みを保証するものではありません。";

    body.append(rankSection, historySection, colorSection, neighborSection, disclaimer);
    panel.append(head, body);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", event => {
        if (event.target === backdrop) closeColorDetail();
    });

    close.focus();
}

function rankFromTile(tile) {
    const number = tile.querySelector(".rank-number");
    if (!number) return null;
    const rank = Number(number.textContent);
    return Number.isFinite(rank) ? rank : null;
}

function enhanceRankTiles() {
    document.querySelectorAll("#tiers .rank-color").forEach(tile => {
        const rank = rankFromTile(tile);
        if (!rank) return;
        const sorted = getAnalysis().pointSorted ?? getSortedColors();
        const color = sorted[rank - 1];
        if (!color) return;

        tile.tabIndex = 0;
        tile.setAttribute("role", "button");
        tile.setAttribute("aria-label", `${rank}位 ${toHex(color)} の詳細を表示`);
    });
}

const tiers = $("tiers");
if (!tiers) return;

tiers.addEventListener("click", event => {
    const tile = event.target.closest(".rank-color");
    if (!tile || !tiers.contains(tile)) return;
    const rank = rankFromTile(tile);
    if (rank) showColorDetail(rank);
});

tiers.addEventListener("keydown", event => {
    const tile = event.target.closest(".rank-color");
    if (!tile || !tiers.contains(tile)) return;

    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        const rank = rankFromTile(tile);
        if (rank) showColorDetail(rank);
    }
});

document.addEventListener("keydown", event => {
    if (!backdrop) return;

    if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeColorDetail();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.stopImmediatePropagation();
    }
}, true);

const observer = new MutationObserver(enhanceRankTiles);
observer.observe(tiers, { childList: true, subtree: true });
enhanceRankTiles();
})();
