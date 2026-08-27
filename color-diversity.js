(() => {
"use strict";

/*
 * Coverage / diversity layer for Color Battle.
 * Existing save data is untouched: everything is derived from pairCounts.
 *
 * The core idea is deliberately conservative:
 * - raw TrueSkill sigma measures model uncertainty,
 * - weak comparison coverage inflates that sigma before Monte Carlo,
 * - the final stopping probability also receives a continuous coverage gate,
 * - pair selection actively repairs whichever coverage dimension is weakest.
 */

const TRIAL_TARGET_TOP3 = 50;
const TRIAL_TARGET_TOP10 = 35;
const TRIAL_TARGET_NORMAL = 20;

const UNIQUE_TARGET_TOP3 = 18;
const UNIQUE_TARGET_TOP10 = 14;
const UNIQUE_TARGET_NORMAL = 10;

const SAME_FAMILY_TARGET_TOP3 = 6;
const SAME_FAMILY_TARGET_TOP10 = 5;
const SAME_FAMILY_TARGET_NORMAL = 3;

const CROSS_FAMILY_TARGET_TOP3 = 8;
const CROSS_FAMILY_TARGET_TOP10 = 6;
const CROSS_FAMILY_TARGET_NORMAL = 4;

const NEAR_RANK_TARGET_TOP3 = 8;
const NEAR_RANK_TARGET_TOP10 = 6;
const NEAR_RANK_TARGET_NORMAL = 4;

const FAMILY_SPREAD_TARGET = 5;
const NEAR_RANK_DISTANCE = 7;
const OKLAB_NEAR_DISTANCE = 0.145;
const SAME_HUE_DEGREES = 34;
const NEUTRAL_CHROMA = 0.045;

function linearSrgbChannel(v) {
    v /= 255;
    return v <= 0.04045
        ? v / 12.92
        : Math.pow((v + 0.055) / 1.055, 2.4);
}

function rgbToOklab(color) {
    const r = linearSrgbChannel(color.r);
    const g = linearSrgbChannel(color.g);
    const b = linearSrgbChannel(color.b);

    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return {
        L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    };
}

function oklabToLch(lab) {
    const C = Math.hypot(lab.a, lab.b);
    let h = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    if (h < 0) h += 360;
    return { L: lab.L, C, h };
}

const perceptualCache = new WeakMap();

function getColorPerceptual(color) {
    let cached = perceptualCache.get(color);
    if (!cached) {
        const lab = rgbToOklab(color);
        cached = {
            lab,
            lch: oklabToLch(lab)
        };
        perceptualCache.set(color, cached);
    }
    return cached;
}

function oklabDistance(a, b) {
    const la = getColorPerceptual(a).lab;
    const lb = getColorPerceptual(b).lab;
    return Math.hypot(
        la.L - lb.L,
        la.a - lb.a,
        la.b - lb.b
    );
}

function hueDistanceDegrees(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
}

function colorFamilyName(color) {
    const { L, C, h } = getColorPerceptual(color).lch;

    if (C < NEUTRAL_CHROMA) {
        if (L < 0.32) return "neutral-dark";
        if (L > 0.78) return "neutral-light";
        return "neutral-mid";
    }

    const sectors = [
        [15, "red"],
        [45, "orange"],
        [75, "yellow"],
        [115, "lime"],
        [155, "green"],
        [195, "cyan"],
        [235, "azure"],
        [275, "blue"],
        [315, "violet"],
        [345, "magenta"],
        [360, "red"]
    ];

    for (const [limit, name] of sectors) {
        if (h < limit) return name;
    }
    return "red";
}

function isSameColorFamily(a, b) {
    const pa = getColorPerceptual(a).lch;
    const pb = getColorPerceptual(b).lch;

    const neutralA = pa.C < NEUTRAL_CHROMA;
    const neutralB = pb.C < NEUTRAL_CHROMA;

    if (neutralA || neutralB) {
        return neutralA && neutralB && Math.abs(pa.L - pb.L) <= 0.38;
    }

    return (
        hueDistanceDegrees(pa.h, pb.h) <= SAME_HUE_DEGREES &&
        Math.abs(pa.L - pb.L) <= 0.42
    );
}

function isNearPerceptualColor(a, b) {
    return oklabDistance(a, b) <= OKLAB_NEAR_DISTANCE;
}

function targetForRank(rank, top3, top10, normal) {
    return rank <= TOP3_COUNT
        ? top3
        : rank <= TOP_COUNT
            ? top10
            : normal;
}

function opponentEntriesForColor(color) {
    const result = [];

    for (const [key, rawCount] of pairCounts.entries()) {
        const [aRaw, bRaw] = String(key).split("-");
        const aId = Number(aRaw);
        const bId = Number(bRaw);
        const count = Math.max(0, Number(rawCount) || 0);

        let opponentId = null;
        if (aId === color.id) opponentId = bId;
        else if (bId === color.id) opponentId = aId;

        if (opponentId === null) continue;

        const opponent = colors.find(c => c.id === opponentId);
        if (!opponent) continue;

        result.push({ opponent, count });
    }

    return result;
}

function getColorDiversityInfo(color, rankMap = null) {
    const ranks = rankMap ?? currentRankMap().map;
    const rank = ranks.get(color.id) ?? colors.length;
    const entries = opponentEntriesForColor(color);

    const uniqueOpponents = entries.length;
    const trackedGames = entries.reduce((sum, entry) => sum + entry.count, 0);

    let sameFamilyUnique = 0;
    let crossFamilyUnique = 0;
    let nearColorUnique = 0;
    let nearRankUnique = 0;
    const families = new Set();

    for (const { opponent } of entries) {
        const sameFamily = isSameColorFamily(color, opponent);
        if (sameFamily) sameFamilyUnique++;
        else crossFamilyUnique++;

        if (isNearPerceptualColor(color, opponent)) nearColorUnique++;

        const opponentRank = ranks.get(opponent.id);
        if (
            Number.isFinite(opponentRank) &&
            Math.abs(opponentRank - rank) <= NEAR_RANK_DISTANCE
        ) {
            nearRankUnique++;
        }

        families.add(colorFamilyName(opponent));
    }

    const games = Math.max(Number(color.games) || 0, trackedGames);

    const trialTarget = targetForRank(
        rank,
        TRIAL_TARGET_TOP3,
        TRIAL_TARGET_TOP10,
        TRIAL_TARGET_NORMAL
    );

    const uniqueTarget = targetForRank(
        rank,
        UNIQUE_TARGET_TOP3,
        UNIQUE_TARGET_TOP10,
        UNIQUE_TARGET_NORMAL
    );

    const sameTargetRaw = targetForRank(
        rank,
        SAME_FAMILY_TARGET_TOP3,
        SAME_FAMILY_TARGET_TOP10,
        SAME_FAMILY_TARGET_NORMAL
    );

    const crossTargetRaw = targetForRank(
        rank,
        CROSS_FAMILY_TARGET_TOP3,
        CROSS_FAMILY_TARGET_TOP10,
        CROSS_FAMILY_TARGET_NORMAL
    );

    const nearRankTarget = targetForRank(
        rank,
        NEAR_RANK_TARGET_TOP3,
        NEAR_RANK_TARGET_TOP10,
        NEAR_RANK_TARGET_NORMAL
    );

    const availableSame = colors.reduce(
        (count, candidate) =>
            candidate !== color && isSameColorFamily(color, candidate)
                ? count + 1
                : count,
        0
    );
    const availableCross = Math.max(0, colors.length - 1 - availableSame);

    const sameTarget = Math.max(1, Math.min(sameTargetRaw, availableSame));
    const crossTarget = Math.max(1, Math.min(crossTargetRaw, availableCross));

    const gameProgress = clamp(games / trialTarget, 0, 1);
    const uniqueProgress = clamp(uniqueOpponents / uniqueTarget, 0, 1);
    const sameFamilyProgress = clamp(sameFamilyUnique / sameTarget, 0, 1);
    const crossFamilyProgress = clamp(crossFamilyUnique / crossTarget, 0, 1);
    const nearRankProgress = clamp(nearRankUnique / nearRankTarget, 0, 1);
    const familySpreadProgress = clamp(families.size / FAMILY_SPREAD_TARGET, 0, 1);

    const repeatQuality = games > 0
        ? clamp(uniqueOpponents / games, 0, 1)
        : 0;

    const trialScore = clamp(
        gameProgress * 0.70 +
        uniqueProgress * 0.20 +
        repeatQuality * 0.10,
        0,
        1
    );

    const diversityScore = clamp(
        uniqueProgress * 0.24 +
        sameFamilyProgress * 0.24 +
        crossFamilyProgress * 0.15 +
        nearRankProgress * 0.22 +
        familySpreadProgress * 0.10 +
        repeatQuality * 0.05,
        0,
        1
    );

    const qualityScore = clamp(
        trialScore * 0.52 +
        diversityScore * 0.48,
        0,
        1
    );

    const uncertaintyMultiplier =
        1 +
        (1 - diversityScore) * 0.55 +
        (1 - trialScore) * 0.30;

    return {
        rank,
        games,
        trialTarget,
        uniqueOpponents,
        uniqueTarget,
        sameFamilyUnique,
        sameTarget,
        crossFamilyUnique,
        crossTarget,
        nearColorUnique,
        nearRankUnique,
        nearRankTarget,
        familySpread: families.size,
        familySpreadTarget: FAMILY_SPREAD_TARGET,
        repeatQuality,
        gameProgress,
        uniqueProgress,
        sameFamilyProgress,
        crossFamilyProgress,
        nearRankProgress,
        familySpreadProgress,
        trialScore,
        diversityScore,
        qualityScore,
        uncertaintyMultiplier,
        ownFamily: colorFamilyName(color)
    };
}

function buildAllColorDiversity(rankMap = null) {
    const ranks = rankMap ?? currentRankMap().map;
    const result = new Map();
    for (const color of colors) {
        result.set(color.id, getColorDiversityInfo(color, ranks));
    }
    return result;
}

function diversityCoverageGate(diversityMap, pointSorted) {
    if (!pointSorted.length) return 0;

    const all = pointSorted.map(c => diversityMap.get(c.id));
    const top10 = pointSorted.slice(0, TOP_COUNT).map(c => diversityMap.get(c.id));
    const top3 = pointSorted.slice(0, TOP3_COUNT).map(c => diversityMap.get(c.id));

    const average = arr =>
        arr.reduce((sum, value) => sum + value, 0) / Math.max(1, arr.length);

    const allQuality = average(all.map(x => x.qualityScore));
    const allDiversity = average(all.map(x => x.diversityScore));
    const top10Quality = average(top10.map(x => x.qualityScore));
    const top3Quality = average(top3.map(x => x.qualityScore));

    const gate = Math.min(
        clamp(allQuality / 0.78, 0, 1),
        clamp(allDiversity / 0.76, 0, 1),
        clamp(top10Quality / 0.84, 0, 1),
        clamp(top3Quality / 0.90, 0, 1)
    );

    return {
        gate,
        allQuality,
        allDiversity,
        top10Quality,
        top3Quality
    };
}

runMonteCarloAnalysis = function runMonteCarloAnalysisDiversityAware() {
    const { sorted: pointSorted, map: pointRank } = currentRankMap();
    const diversityMap = buildAllColorDiversity(pointRank);
    const rankSamples = new Map();

    for (const color of colors) rankSamples.set(color.id, []);

    let posteriorGoalSuccesses = 0;
    let top3ExactSuccesses = 0;

    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
        const simulated = colors.map(color => {
            const diversity = diversityMap.get(color.id);
            return {
                color,
                score:
                    color.mu +
                    randomNormal() *
                    color.sigma *
                    diversity.uncertaintyMultiplier
            };
        });

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
            if (current <= TOP_COUNT && delta > TOP_TOLERANCE) topOk = false;
            if (current <= TOP3_COUNT && delta > TOP3_TOLERANCE) top3ExactOk = false;
        }

        if (top3ExactOk) top3ExactSuccesses++;

        const normalNeeded = Math.ceil(colors.length * REQUIRED_NORMAL_RATIO);
        if (normalWithin >= normalNeeded && topOk && top3ExactOk) {
            posteriorGoalSuccesses++;
        }
    }

    const info = new Map();
    let normalTrusted = 0;
    let topTrusted = 0;
    let top3Trusted = 0;

    for (const color of colors) {
        const samples = rankSamples.get(color.id).sort((a, b) => a - b);
        const current = pointRank.get(color.id);
        const diversity = diversityMap.get(color.id);

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
            if (delta <= tolerance) targetWithin++;
            if (delta <= NORMAL_TOLERANCE) normalWithin++;
            if (delta <= TOP_TOLERANCE) top10Within++;
        }

        const confidence = targetWithin / MONTE_CARLO_SAMPLES;
        const normalConfidence = normalWithin / MONTE_CARLO_SAMPLES;
        const top10Confidence = top10Within / MONTE_CARLO_SAMPLES;
        const lowRank = Math.max(1, Math.round(percentile(samples, 0.05)));
        const highRank = Math.min(colors.length, Math.round(percentile(samples, 0.95)));

        if (normalConfidence >= TARGET_PER_COLOR_CONFIDENCE) normalTrusted++;
        if (current <= TOP_COUNT && top10Confidence >= TARGET_PER_COLOR_CONFIDENCE) topTrusted++;
        if (current <= TOP3_COUNT && confidence >= TARGET_PER_COLOR_CONFIDENCE) top3Trusted++;

        info.set(color.id, {
            currentRank: current,
            lowRank,
            highRank,
            confidence,
            normalConfidence,
            top10Confidence,
            tolerance,
            diversity,
            effectiveSigma: color.sigma * diversity.uncertaintyMultiplier
        });
    }

    const posteriorGoalProbability = posteriorGoalSuccesses / MONTE_CARLO_SAMPLES;
    const posteriorTop3ExactProbability = top3ExactSuccesses / MONTE_CARLO_SAMPLES;
    const coverage = diversityCoverageGate(diversityMap, pointSorted);

    const globalProbability = posteriorGoalProbability * coverage.gate;
    const top3ExactProbability = posteriorTop3ExactProbability * Math.min(
        1,
        coverage.top3Quality / 0.90
    );

    const avgConfidence =
        [...info.values()].reduce((sum, x) => sum + x.confidence, 0) /
        Math.max(1, colors.length);

    const normalTargetCount = Math.ceil(colors.length * REQUIRED_NORMAL_RATIO);

    analysisCache = {
        info,
        globalProbability,
        posteriorGoalProbability,
        averageConfidence: avgConfidence,
        normalTrusted,
        normalTargetCount,
        topTrusted,
        top3Trusted,
        top3ExactProbability,
        posteriorTop3ExactProbability,
        pointSorted,
        diversityMap,
        diversityGate: coverage.gate,
        averageDiversity: coverage.allDiversity,
        averageCoverageQuality: coverage.allQuality,
        top10CoverageQuality: coverage.top10Quality,
        top3CoverageQuality: coverage.top3Quality
    };

    analysisAtBattle = battleCount;

    if (globalProbability >= TARGET_GLOBAL_PROBABILITY) stableGoalHits++;
    else stableGoalHits = 0;

    return analysisCache;
};

function pairDiversityOpportunity(a, b, ai, bi) {
    const da = ai.diversity ?? getColorDiversityInfo(a);
    const db = bi.diversity ?? getColorDiversityInfo(b);
    const sameFamily = isSameColorFamily(a, b);
    const nearColor = isNearPerceptualColor(a, b);
    const rankDistance = Math.abs(ai.currentRank - bi.currentRank);
    const newPair = getPairCount(a, b) === 0;

    let gain = 0;

    if (newPair) {
        gain += (1 - da.uniqueProgress) * 0.80;
        gain += (1 - db.uniqueProgress) * 0.80;
    }

    if (sameFamily) {
        gain += (1 - da.sameFamilyProgress) * 1.25;
        gain += (1 - db.sameFamilyProgress) * 1.25;
    } else {
        gain += (1 - da.crossFamilyProgress) * 0.72;
        gain += (1 - db.crossFamilyProgress) * 0.72;
    }

    if (rankDistance <= NEAR_RANK_DISTANCE) {
        gain += (1 - da.nearRankProgress) * 1.05;
        gain += (1 - db.nearRankProgress) * 1.05;
    }

    if (nearColor) {
        gain += (1 - da.sameFamilyProgress) * 0.55;
        gain += (1 - db.sameFamilyProgress) * 0.55;
    }

    return {
        gain,
        sameFamily,
        nearColor,
        newPair
    };
}

chooseBestPair = function chooseBestPairDiversityAware() {
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
            const diversityOpportunity = pairDiversityOpportunity(a, b, ai, bi);
            const da = ai.diversity;
            const db = bi.diversity;

            if (
                overlap === 0 &&
                rankDistance > 10 &&
                diversityOpportunity.gain < 1.25
            ) {
                continue;
            }

            const p = predictedProbability(a, b);
            const entropy = binaryEntropy(p);
            const repeats = getPairCount(a, b);
            const repeatPenalty = 1 / (1 + repeats * 1.9);

            const unresolvedA = 1 - clamp(ai.confidence / TARGET_PER_COLOR_CONFIDENCE, 0, 1);
            const unresolvedB = 1 - clamp(bi.confidence / TARGET_PER_COLOR_CONFIDENCE, 0, 1);

            const minRank = Math.min(ai.currentRank, bi.currentRank);
            let importance = 1;
            if (minRank <= 3) importance = 7.2;
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
                rankDistance <= 1 ? 2.30 :
                rankDistance <= 3 ? 1.72 :
                rankDistance <= 6 ? 1.25 :
                rankDistance <= 10 ? 1.05 : 0.82;

            const proximity = Math.exp(-rankDistance / 14);

            const qualityNeed =
                (1 - da.qualityScore) +
                (1 - db.qualityScore);

            const familyBoost =
                diversityOpportunity.sameFamily && rankDistance <= 6
                    ? 1.24
                    : 1;

            const nearColorBoost =
                diversityOpportunity.nearColor && rankDistance <= 6
                    ? 1.18
                    : 1;

            const newOpponentBoost = diversityOpportunity.newPair ? 1.13 : 1;

            const top3ThreatBoost =
                (ai.lowRank <= TOP3_COUNT || bi.lowRank <= TOP3_COUNT)
                    ? (Math.max(ai.currentRank, bi.currentRank) <= 5 ? 2.35 : 1.55)
                    : 1;

            const score =
                (
                    0.30 +
                    entropy * 2.75 +
                    overlap * 2.15 +
                    (unresolvedA + unresolvedB) * 1.70 +
                    widthNeed * 0.70 +
                    qualityNeed * 1.05 +
                    diversityOpportunity.gain * 0.92
                )
                * importance
                * neighborBoost
                * familyBoost
                * nearColorBoost
                * newOpponentBoost
                * top3ThreatBoost
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
};

const stats = document.querySelector(".stats");
if (stats && !document.getElementById("diversityAvg")) {
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.innerHTML = `
        <span class="stat-label">平均多様性</span>
        <strong id="diversityAvg" class="stat-value">0%</strong>
    `;
    stats.appendChild(stat);

    const style = document.createElement("style");
    style.textContent = `
        @media (min-width: 721px) {
            .stats { grid-template-columns: repeat(6, minmax(0,1fr)); }
        }
    `;
    document.head.appendChild(style);
}

const goalNote = document.querySelector(".goal-note");
if (goalNote) {
    goalNote.textContent =
        "目標: 125色の90%以上が±5位以内、Top10が±2位以内、1〜3位の順番が完全一致する確率が90%以上。比較回数・ユニーク相手・同系色/異系色・近傍順位の多様性も信頼度と終了判定に反映します。Tierは表示のみです。";
}

const originalRenderStats = renderStats;
renderStats = function renderStatsWithDiversity(forceAnalysis = false) {
    originalRenderStats(forceAnalysis);
    const analysis = getAnalysis(false);
    const element = document.getElementById("diversityAvg");
    if (element) {
        element.textContent = `${Math.round((analysis.averageDiversity || 0) * 100)}%`;
        element.title =
            `終了ゲート ${Math.round((analysis.diversityGate || 0) * 100)}% / ` +
            `Top10網羅度 ${Math.round((analysis.top10CoverageQuality || 0) * 100)}% / ` +
            `Top3網羅度 ${Math.round((analysis.top3CoverageQuality || 0) * 100)}%`;
    }
};

})();
