# PHASE 1B STATUS — PHASE 1B PASS

驗證日期：2026-10-11，Asia/Taipei。全部 A–AB 功能、數值、視覺、效能與 Windows CI 門檻已通過。完整桌面 Phase 1 仍未完成。

## IMPLEMENTED

第五模式 JOURNEY、14-stage timeline、Previous／Next／Play／Pause／Reset、鍵盤與四個有界速度、固定 PCA 軸域與已走過軌跡、768D 訊號、AVG／12 heads、Top 3 注意力／signed similarity、Logit Lens top-10、固定五候選演化曲線與文字表、Cinematic、Guided Showcase、deterministic recording preset 與正式 60 秒錄影脚本。資料來源統一為同一個 analysis object。

## SCHEMA CHANGES

0.2.0 → **0.3.0**；Python、CLI、generator、TypeScript、runtime validation、local import、測試同步更新。`prediction_evolution` 包含最後輸入位置、14 個有序 stage labels、projection／normalization descriptors，以及五個 final-top-ranked 候選的 token ID、text、14 logits／14 probabilities。只有 140 個候選數值，沒有 13 × 50,257 full-vocabulary payload。

新公開 fixture 位於 `frontend/public/fixtures/phase1b/`；原有 0.2.0／0.1.1 檔案與 baseline 保留。0.2.0 匯入保留原有四模式並顯示重新執行 CLI 的說明；不補造 Journey／演化曲線。`?core=1`／`?legacy=1` 分別重現舊階段以執行全部歷史回歸。

## JOURNEY SEMANTICS

| Stage | 表徵與訊號 | Attention | 下一個 token 診斷 |
|---|---|---|---|
| EMB | raw embedding residual；magnitude／same-layer cosine／shared PCA 有效；delta、previous cosine N/A | N/A | 最後位置的 EMB Logit Lens estimate |
| L01–L12 | 原始 post-block residual，norm／delta／cross-layer cosine 使用 768D | 真正該 block 的 selected-query row，AVG 或 H01–H12 | 最後位置 residual → final ln_f → LM head |
| OUT | 沿用 L12，標 FINAL REPRESENTATION: L12；delta 是 L11→L12 | 完成於 L12，OUT 為 N/A | 真正的 forward logits／final prediction |

Selected token 在五模式共用。公開 showcase 選 sat（position 2），預測位置仍為 mat（position 5）。固定軸域包含 13 層所有座標，OUT 不產生新 hidden state 或 Layer 13。TRAIL 預設只顯示 EMB→current，SHOW FULL TRAIL 明確 opt-in。排名依 raw cosine 降冪，self 排除但原始 diagonal 顯示。

## LOGIT LENS / PREDICTION EVOLUTION

13 個 projections 與 existing lens 的 top-k 完全一致；每個候選值與 genuine projected vector 的該 token ID 逐項比較。以 float64 對全部 50,257 vocabulary softmax，完整和為 1（1e-12 tolerance）。OUT 與真正 final logits 的 top-5 ID／order／logit／probability 相符。固定五條曲線可切換機率／logit、隱藏候選；顯示數字直接取原值，僅位置／bar width 動畫，沒有 numeric interpolation。

Runtime validation 檢查最後位置、14 stages、五候選 final identity、有限值、機率範圍、OUT exact equality、中間 top-10 相符、候選機率和及一致的 softmax denominator。拒絕錯誤或缺失 field。格式檢查仍不能證明自訂檔案的來源真實性。

## CINEMATIC MODE

1080p 主圖完整顯示時間軸、sat／stage、共享 PCA、訊號與預測圖，沒有 panel overlap 或 workspace scroll。Presentation state 不改模型數值。公開來源與未驗證匯入來源標記均保留。Showcase 按真實資料依序切換 Attention L01／06／12、Similarity、Space、Journey、OUT；自訂／stress 資料需先選 token。900 ms 預設 timer，0.5×／1×／1.5×／2×；切 head 不重置播放，隱藏分頁／換模式停止，Escape 停止並退出 Cinematic。

`?recording=1` 固定 sat／L06／Cinematic；`&intro=1` 從未選 token 的 Attention 開始。無時間戳／機器路徑；只在 initial public load 設定 preset，匯入不會被重新指定 token。原始 WebM 已實際錄製並抽取畫面檢查，1920×1080／25fps，包含載入畫面與 60 秒操作；本次另將 1–61 秒匯出 H.264 MP4，ffprobe 驗證恰為 60 秒、1920×1080／25fps，不改變速度或資料。[錄影時間證據](evidence/phase1b-recording.json) errors 為空。[正式脚本與重現方法](PHASE1B_RECORDING.zh-TW.md)。

## REAL DATA VALIDATION / CLI IMPORT VALIDATION

本機 Python 3.12、CPU、固定官方 GPT-2 revision `607a30d783dfa663caf39e06633721c8d4cfcd7e`，離線權重已驗證。兩個公開 prompt 均執行兩次獨立 uncached forward，比較完整數值序列化 bytes 完全一致；[fixture evidence](evidence/phase1b-fixture-generation.json) 含 SHA-256。跨硬體浮點／PCA 可能有微小差異；此重現聲明限定同一執行環境。

[引擎驗證](evidence/phase1b-engine-validation.json) 的 6／64 tokens：attention 最大 row-sum error 分別 2.38e-7／4.77e-7，future attention 為 0；cosine 對稱誤差 0，diagonal 誤差最大 7.15e-7。Phase 1B 候選公式另由真實 tensor 測試驗證。

實際 CLI 分別輸出公開短句和 ` hello` × 64，benchmark 用這兩份輸出經 file control 匯入，未以 fixture 冒充 CLI。Unicode preservation／cache isolation 舊測試保留。格式錯誤、錯 revision、因果矩陣破壞、候選破壞與超大檔案均拒絕；失敗保留 analysis、selected token、Journey stage 與 mode。來源始終標為 LOCAL ANALYSIS／SOURCE NOT VERIFIED，機器路徑與 runtime timings 不進畫面。私人 artifacts 不提交。

## TESTS / VISUAL REGRESSION

- 開始開發前：51 Python、68 frontend、12 E2E、CLI import、build 全部通過；[baseline Engine CI](https://github.com/oliverchenOVO/project-neuron/actions/runs/38088778835)、[baseline Browser CI](https://github.com/oliverchenOVO/project-neuron/actions/runs/38088781391)。
- 完成本機：**55 Python、82 frontend、23 E2E**。其中 12 個原有 E2E 全數保留，新增 11 個 Journey／prediction／cinematic／showcase／import／stress／normal-motion／窄螢幕／recording intro 場景。Production build 通過。
- 舊 pixel baselines 不更新。新增 Windows baselines 的建立限 `journey.spec.ts --update-snapshots`，建立後完整普通 E2E 再通過。Runtime／console error 捕捉無錯誤。
- Reduced motion 關閉 CSS interpolation，功能與 timer 照常工作。Normal motion 驗證 240 ms PCA transition，其他轉場 180–240 ms。390×844 可操作 OUT、沒有橫向溢出；歷史 1920／1440／1280 回歸仍通過。
- Browser plugin not available：本次依 frontend-testing-debugging skill 使用 ordinary Playwright fallback，並直接檢查真實程式與影片抽帧。

執行命令：`.venv\Scripts\python.exe -m pytest -q`、`-m scripts.validate_phase0`、`-m scripts.generate_showcase_fixture --verify-reproducibility`；frontend：`npm test`、`npm run build`、`npm run test:e2e`。工具腳本：`node scripts/benchmark-phase1b.mjs`、`node scripts/record-phase1b.mjs`。

## PERFORMANCE / BROWSER MEMORY / 64-TOKEN RESULT

Production Chromium 153.0.8010.12、Node 24.13.0、Windows 10.0.26200、i9-12900H／20 logical cores／47.70 GiB RAM，1920×1080／DPR 1／reduced motion／無 CPU throttle。原始完整統計與載入成本：[performance JSON](evidence/phase1b-browser-performance.json)，production source revision `29a7994d855cc6d7bd3efe6b8cdc162ad9bfa98d`；後續只有測試修正與文件。

| 來源 | Bytes | Stage p95 ms | Play p95 ms | Chart p95 ms | Candidates p95 ms | Cinematic p95 ms | Token p95 ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| 6 public | 142,694 | 3.4 | 3.1 | 1.3 | 1.1 | 2.1 | 2.0 |
| 6 CLI import | 275,849 | 2.8 | 3.2 | 1.8 | 1.4 | 2.3 | 2.3 |
| 64 public | 9,046,328 | 5.0 | 3.9 | 1.9 | 1.1 | 2.8 | 4.1 |
| 64 CLI import | 17,201,289 | 5.9 | 4.9 | 1.6 | 1.4 | 2.7 | 2.8 |

每類 60 個 DOM 操作，另每組 13 個真正 timer-driven play steps；所有 interaction JS p95 **<50 ms**。Stage 計時從 handler 到 React layout commit，包含 PCA、訊號、chart focus 與 top-10 ranking 全部更新，是整個更新的合計，不假稱獨立微量測每個子元件。候選點透過實際鍵盤 focus／Enter 選取，避免重疊點的 pointer ambiguity。rAF 等待另報，不等於 GPU paint 完成；動畫持續時間不等於 main-thread 執行成本。

64-token 保留 64 markers、少於 10 個持續標籤；全部階段、heads、候選圖、OUT 與播放均完成，無 renderer freeze。新版 compact public payload 比舊版增加 3,411／3,437 bytes（約 2.45%／0.038%）。CLI 以縮排輸出，因此檔案比 compact fixture 大，但仍低於 32 MiB。

`--enable-precise-memory-info` 下的整頁 JS heap：Journey 後約 5.56 MB（6 public）、7.99 MB（6 import）、35.95 MB（64 public）、216.70 MB（64 import）。這是 GC 前粗估，包含先前 fixture cache、JSON text、解析副本與 React，不是 isolated parsed-object size；6 import delta 為負值反映 GC，不能解讀為資料變小。沒有傳完整詞彙矩陣，資料量增長已由 bytes 證據核對。

## BUILD / GIT / CI

Vite／TypeScript production build 通過。原倉庫 `oliverchenOVO/project-neuron`、main、PUBLIC 未改 visibility。保留原始 history／releases／Actions／stars／forks；未新建倉庫，未 squash。提交：`d303cfd` engine、`8395541` Journey、`ca86f9b` Cinematic、`1be8aed` tests、`29a7994` recording intro、`ff56969` recording selector 修正。提交的新增 fixture 只含固定公開 prompt。

實作 revision `ff569691771c4dd0092ba72494e69fcf1e5d8248` 的 [Engine CI](https://github.com/oliverchenOVO/project-neuron/actions/runs/38090888670)／[Browser CI](https://github.com/oliverchenOVO/project-neuron/actions/runs/38090888680) 均 **SUCCESS**，包含 55 Python、82 frontend、23 E2E、production build 與真實 fixture 重現。文件與固定公開資料的驗證證據另以後續提交保留；最後交付的 HEAD／remote main／clean tree 與最新 CI 於交付時再次核對。未修改原有 baseline 或私人輸出。

## ACCEPTANCE GATES

| Gate | Requirement | Status／證據 |
|---|---|---|
| A | existing Python tests | PASS — 51 舊測試 + 4 新真實模型測試 |
| B | existing frontend tests | PASS — 68 舊測試 + 14 新測試 |
| C | existing E2E | PASS — 12 原有場景／baseline 保留 |
| D | CLI import regression | PASS — Unicode、numeric identity、失敗保留、真實 CLI benchmark |
| E | selected token Journey flow | PASS — CTA、五模式共享、data reference 不變 |
| F | EMB semantics | PASS — raw residual／N/A attention、delta、previous |
| G | 12 layer stages | PASS — 逐階段 exact coordinates／ranking |
| H | OUT semantics | PASS — L12 representation／N/A attention／final logits |
| I | genuine Logit Lens | PASS — final ln_f／LM head 與 existing lens 相符 |
| J | genuine final prediction | PASS — true forward logits／full softmax |
| K | genuine evolution | PASS — 五候選全部 14 × 原始數值 |
| L | no fake probabilities | PASS — tensor 比較／full-vocab normalization／缺資料拒絕 |
| M | fixed shared PCA axes | PASS — 每階段相同 domain，OUT 沿用 L12 |
| N | real trail | PASS — 真實座標、partial default／full opt-in |
| O | playback／step | PASS — buttons、keyboard、900ms timers／pause／reset |
| P | speed controls | PASS — bounded four choices／2× 450ms 測試 |
| Q | Cinematic | PASS — presentation only／honest provenance／1080p complete |
| R | public fixture | PASS — 真實 6／64 tokens／reproducibility |
| S | imported JSON | PASS — genuine CLI 6／64、0.2 compatibility |
| T | 64-token Journey | PASS — 64 points、sparse labels、playback／OUT |
| U | production build | PASS — TypeScript／Vite |
| V | visual regression | PASS — 舊與新 Windows baselines／23 scenes |
| W | performance | PASS — 全組 p95 ≤5.9 ms，target <50 ms |
| X | no renderer freeze | PASS — 四組重複互動／實際 timer steps／60s 錄影 |
| Y | reduced motion | PASS — 無 interpolation，Next／Play 仍工作 |
| Z | CI | PASS — ff56969 Engine／Browser Windows CI 均成功 |
| AA | no Electron | PASS — 未新增 Electron／installer／live worker |
| AB | visibility unchanged | PASS — gh repo view PUBLIC，沿用原倉庫 |

## KNOWN LIMITATIONS

仍需 CLI → JSON，沒有即時 prompt／Electron／Windows installer。只支援 pinned GPT-2、1–64 tokens。Lens 是最後輸入位置的診斷投影；PCA 二維資訊有限且全域軸可能由末層離群點主導。用戶檔案只能驗格式、不保證來源真實。64-token stress 是重複公開 hello，用來檢驗最大尺寸，不能據此概括所有自然語言輸入。Heap 是 whole-page／GC-sensitive 粗估，效能只代表上述硬體與 workload。視覺回歸是 Windows Chromium，其他字型／系統可能產生像素差異。

## NEXT REQUIRED MILESTONE

**Phase 1C — Electron + live local Python worker integration**。不再堆疊 browser-only feature；下一階段一次串起 prompt → local model → live analysis → UI，桌面封裝另依 milestone 驗證。
