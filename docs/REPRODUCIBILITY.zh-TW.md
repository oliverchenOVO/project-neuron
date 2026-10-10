# NEURON｜中文重現指南

[專案首頁](../README.md) · [審閱指南](REVIEWER_GUIDE.zh-TW.md) · [驗證報告](PHASE1A_VALIDATION.md)

整理日期：2026-10-11。以下以 Windows PowerShell 為準；既有驗證成果為 Phase 1A。每段命令都標明執行目錄，請勿把 Python 根目錄指令直接放在 `frontend/` 執行。

## 先選執行路徑

| 目的 | 需要什麼 | 使用的資料 | 是否當場推論 |
|---|---|---|---|
| 閱讀作品 | 瀏覽器 | GitHub 截圖、架構圖與文件 | 否 |
| 操作四種模式 | Node.js、npm | 倉庫內已提交的固定公開 JSON | 否 |
| 分析自己的輸入 | Python 3.12、依賴、官方 GPT-2 checkpoint | 本機輸入的真實模型輸出 | 是，使用 CLI |
| 重現完整測試 | Node.js、Python、官方 checkpoint、Playwright Chromium | 固定測試資料與真實模型 | Python 測試會推論 |

Vite 的 Node 需求為 `^20.19.0 || >=22.12.0`；CI 使用 Node 22。為了貼近既有驗證，使用 Node 22.12 以上的 22.x 與 Python 3.12。GitHub 提供原始碼與固定展示資料，目前沒有 `.exe` 或安裝檔。

## A. 操作瀏覽器展示，不下載模型

先取得原倉庫並安裝前端依賴：

```powershell
git clone https://github.com/oliverchenOVO/project-neuron.git
Set-Location project-neuron/frontend
npm ci
npm run build
npm run preview
```

保持此終端運行，瀏覽器開啟 `http://127.0.0.1:4173/`。資料已在 `frontend/public/fixtures/`，不需要 Python 或模型權重。初次 `npm ci` 需要網路；完成安裝後，展示介面使用本機檔案。

建議依照 [審閱指南的五步操作](REVIEWER_GUIDE.zh-TW.md#五步操作示範)：選 sat → SIMILARITY → SPACE → TRAIL → COMPARE。右上 fixture 選單可切到 64-token；EMB 沒有 attention matrix，需在 ATTENTION 選 L01–L12。

停止展示時，在該終端按 Ctrl+C。程式改動後需重新 `npm run build`，preview 不會自動重新編譯原始碼。4173 已被其他程序使用時會明確失敗；請先確認是否已有 NEURON preview，不要直接終止不明程序。

## B. 執行真實本機推論

以下在 **project-neuron 倉庫根目錄**執行。若剛操作 A，先另開終端進入根目錄，以保留 preview。

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-compile -r requirements-cpu.lock
.\.venv\Scripts\python.exe -m pip install --no-compile --no-deps -e ".[dev]"
.\.venv\Scripts\python.exe -m scripts.download_model
.\.venv\Scripts\python.exe -m engine.cli --model-dir resources/models/gpt2 --offline
```

第一次安裝與下載需要網路。官方模型 revision 固定為 `607a30d783dfa663caf39e06633721c8d4cfcd7e`，模型目錄附帶 provenance／hash 紀錄。`--offline` 控制模型載入不連線，不是讓首次依賴安裝或下載也變成離線。

CLI 預設分析 `The cat sat on the mat`，列出 tokens、IDs、tensor shapes 與 top-10；完整結果預設寫入 `artifacts/phase0-analysis.json`。也可指定自己的輸入與輸出檔：

```powershell
.\.venv\Scripts\python.exe -m engine.cli "The cat sat on the mat" --model-dir resources/models/gpt2 --offline --output artifacts/my-analysis.json
```

這是模型當場計算的結果，不會自動替換瀏覽器的公開 fixtures。輸出包含輸入文字與衍生訊號，屬於本機資料；`artifacts/` 由 Git 忽略，請勿把私人輸入產生的檔案改放到公開資料夾。

## C. 驗證與重現公開 fixtures

在根目錄執行 Python 檢查，需要 B 的真實 checkpoint；測試不會略過模型缺失，也不會改用隨機模型。

```powershell
.\.venv\Scripts\python.exe -m pytest -q --junitxml=artifacts/pytest.xml
.\.venv\Scripts\python.exe -m scripts.generate_showcase_fixture --verify-reproducibility --output artifacts/reproduced-public-fixtures
```

第二個命令輸出到忽略的資料夾，保留已提交 fixtures 不變。它會對固定公開句子執行兩次 uncached 分析並比較序列化 bytes；確認失敗會報錯。若要刻意更新瀏覽器 fixtures，才省略 `--output`，並審閱產生的 Git diff。

在前端目錄執行：

```powershell
Set-Location frontend
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:e2e
```

E2E 會啟動 production preview，或在本機使用已運行的 4173 preview。正常測試不更新 baselines；不要為了消除失敗而直接使用 `test:visual:update`。PNG 基準使用 Windows、固定 viewport／DPR、dark mode 與 reduced motion；其他系統或字型可能產生像素差異。

## D. 重新量測效能

模型與瀏覽器分開量測，避免兩者同時占用 CPU。

```powershell
# 根目錄；checkpoint 已下載
.\.venv\Scripts\python.exe -m scripts.benchmark_phase1a

# 前端目錄；另開終端保持 npm run preview 運行
Set-Location frontend
npm run benchmark:core
```

這兩個命令會更新 `docs/evidence/phase1a-engine-benchmark.json` 與 `docs/evidence/phase1a-browser-benchmark.json`。若只是個人重現，請將新結果當成本機觀察，審閱 diff 後再決定是否提交；不要把不同硬體的結果直接覆蓋成同一份歷史驗證結論。

讀取效能報告時，請分清楚：

- engine 的 loading、forward、derived metrics、analysis、cache copy 與 serialization；analysis 中位數不含 loading／JSON encoding。
- 瀏覽器的 fetch、parse、schema validation、state assignment、first render 與 post-load interaction；JS p95 不等於下載與推論的總等待時間。
- rAF 間隔、callback scheduling work 與 monitor presentation；三者並非同一個指標。

## 常見問題

**可以在畫面上直接輸入新句子嗎？** 目前不行。瀏覽器使用兩份固定公開資料；自己的輸入走 CLI。即時 worker 整合屬於後續階段。

**為什麼 SPACE 的很多 token 擠在一起？** 共同 PCA 使用 raw residual vectors，沒有為排版而重新分布資料。高範數向量可能主導投影；使用 selector／數值列表檢視重疊點。

**換 prompt 的 PC1／PC2 可以直接相比嗎？** 不可以。共享 basis 僅涵蓋同一次分析的層／token，不同分析會重新擬合。

**為什麼十個預測機率沒有加總為 100%？** 它們是完整詞彙 softmax 的 top-10 子集，不重新正規化。

**模型離線檔案缺失或輸入太長怎麼辦？** 檢查模型下載是否完成、根目錄與 `--model-dir` 是否正確。超過 64 tokens 時縮短輸入；引擎不會默默截斷或生成假結果。

**公開倉庫是否包含模型權重或我的輸入？** 已提交資料是固定公開句子的結果。權重、環境與本機 `artifacts/` 被忽略；請保持私人分析輸出在忽略目錄內。
