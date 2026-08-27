(() => {
"use strict";

const injected = new WeakSet();

function pct(value) {
    if (!Number.isFinite(value)) return "—";
    return `${Math.round(value * 100)}%`;
}

function metricCard(label, value, note = "", meter = null) {
    const card = document.createElement("div");
    card.className = "color-detail-card";
    const labelEl = document.createElement("div");
    labelEl.className = "color-detail-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("div");
    valueEl.className = "color-detail-value";
    valueEl.textContent = value;
    card.append(labelEl, valueEl);

    if (meter !== null && Number.isFinite(meter)) {
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

function trialStage(score) {
    if (score < 0.25) return "データ不足";
    if (score < 0.50) return "初期";
    if (score < 0.75) return "傾向あり";
    if (score < 1.00) return "十分に近い";
    return "回数目安達成";
}

function injectMetrics(panel) {
    if (injected.has(panel)) return;

    const rankText = panel.querySelector(".color-detail-rank")?.textContent ?? "";
    const match = rankText.match(/#(\d+)/);
    if (!match) return;

    const rank = Number(match[1]);
    if (!Number.isFinite(rank) || rank < 1) return;

    const analysis = getAnalysis();
    const sorted = analysis.pointSorted ?? getSortedColors();
    const color = sorted[rank - 1];
    const info = color ? analysis.info.get(color.id) : null;
    const d = color && info ? (info.diversity ?? getColorDiversityInfo(color)) : null;
    if (!color || !info || !d) return;

    const section = document.createElement("section");
    section.className = "color-detail-section";
    section.dataset.coverageMetrics = "true";

    const heading = document.createElement("h3");
    heading.textContent = "試行回数・比較多様性";
    const grid = document.createElement("div");
    grid.className = "color-detail-grid";

    const sigmaInflation = d.uncertaintyMultiplier;
    const rawSigma = Number(color.sigma) || 0;
    const effectiveSigma = Number(info.effectiveSigma) || rawSigma * sigmaInflation;

    const cards = [
        metricCard("試行回数指標", pct(d.trialScore), `${trialStage(d.trialScore)} / 比較 ${d.games}/${d.trialTarget}回目安`, d.trialScore),
        metricCard("比較多様性", pct(d.diversityScore), "相手数・同系色・異系色・近傍順位・色系統の広がりを合成", d.diversityScore),
        metricCard("総合網羅度", pct(d.qualityScore), "試行回数52% + 多様性48%", d.qualityScore),
        metricCard("ユニーク相手", `${d.uniqueOpponents}/${d.uniqueTarget}色`, "同じ相手の繰り返しでは増えません", d.uniqueProgress),
        metricCard("同系色比較", `${d.sameFamilyUnique}/${d.sameTarget}色`, `OKLCH基準 / この色の系統: ${d.ownFamily}`, d.sameFamilyProgress),
        metricCard("異系色比較", `${d.crossFamilyUnique}/${d.crossTarget}色`, "全体順位のアンカーとして利用", d.crossFamilyProgress),
        metricCard("近傍順位比較", `${d.nearRankUnique}/${d.nearRankTarget}色`, "現在順位±7位以内のユニーク相手", d.nearRankProgress),
        metricCard("近似色比較", `${d.nearColorUnique}色`, "OKLab距離が近い色。細かい好み差の検出に重要"),
        metricCard("相手の色系統", `${d.familySpread}/${d.familySpreadTarget}系統目安`, "赤・青・中性色など、相手側の系統数", d.familySpreadProgress),
        metricCard("再戦効率", pct(d.repeatQuality), "1に近いほど重複が少ない", d.repeatQuality),
        metricCard("不確実度補正", `×${sigmaInflation.toFixed(2)}`, `σ ${rawSigma.toFixed(2)} → ${effectiveSigma.toFixed(2)}。多様性不足ほど順位信頼度を下げます`),
        metricCard("全体終了ゲート", pct(analysis.diversityGate ?? 0), "全色・Top10・Top3の網羅度が不足すると最終90%へ到達できません", analysis.diversityGate ?? 0)
    ];

    cards.forEach(card => grid.appendChild(card));
    section.append(heading, grid);

    const body = panel.querySelector(".color-detail-body");
    if (!body) return;
    const historySection = [...body.querySelectorAll(".color-detail-section")]
        .find(node => node.querySelector("h3")?.textContent === "比較履歴");

    if (historySection) historySection.insertAdjacentElement("afterend", section);
    else body.prepend(section);
    injected.add(panel);
}

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.(".color-detail-panel")) injectMetrics(node);
            node.querySelectorAll?.(".color-detail-panel").forEach(injectMetrics);
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
document.querySelectorAll(".color-detail-panel").forEach(injectMetrics);

})();
