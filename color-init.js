(() => {
"use strict";

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`${src} の読み込みに失敗しました`));
        document.head.appendChild(script);
    });
}

async function startApp() {
    try {
        await loadScript("color-diversity.js?v=3");
        await loadScript("color-detail-metrics.js?v=3");
    } catch (error) {
        console.error(error);
    }

    const leftButton = $("leftColor");
    const rightButton = $("rightColor");

    leftButton.addEventListener("click", event => {
        handleChoice(leftColor, rightColor, leftButton, rightButton, event);
    });

    rightButton.addEventListener("click", event => {
        handleChoice(rightColor, leftColor, rightButton, leftButton, event);
    });

    $("skip").addEventListener("click", () => {
        if (inputLocked) return;
        nextBattle();
        renderAll(false);
    });

    $("reset").addEventListener("click", () => {
        if (!confirm("保存された比較結果をすべて削除しますか？")) return;
        clearState();
        battleCount = 0;
        pairCounts = new Map();
        leftColor = null;
        rightColor = null;
        analysisCache = null;
        analysisAtBattle = -999;
        stableGoalHits = 0;
        createColorSet();
        nextBattle();
        renderAll(true);
    });

    $("exportData").addEventListener("click", exportData);
    $("exportImage").addEventListener("click", exportRankingImage);
    $("importData").addEventListener("click", () => $("importFile").click());

    $("importFile").addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            await importDataFile(file);
            alert("データを復元しました。");
        } catch (error) {
            console.error(error);
            alert(error.message || "復元に失敗しました。");
        } finally {
            event.target.value = "";
        }
    });

    document.addEventListener("keydown", event => {
        if (inputLocked) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            leftButton.click();
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            rightButton.click();
        }
    });

    window.addEventListener("pagehide", saveState);

    const loaded = loadState();
    if (!loaded) createColorSet();
    if (!leftColor || !rightColor) nextBattle();
    renderAll(true);
}

startApp();

})();
