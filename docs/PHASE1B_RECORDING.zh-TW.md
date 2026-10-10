# Project NEURON：60 秒作品影片錄製流程

目標是直接錄製真實儀器操作。使用固定公開句子 `The cat sat on the mat`、GPT-2 真實 forward 資料、1920 × 1080／DPR 1；不加入假訊號、標題卡或機器路徑。需要先在 `frontend` 執行 `npm run build`，另開終端執行 `npm run preview`。

```powershell
cd frontend
$env:NEURON_URL = 'http://127.0.0.1:4173'
node scripts/record-phase1b.mjs
```

影片與操作時間表輸出在忽略的 `artifacts/phase1b-recording/`，可用 `NEURON_RECORDING_DIR` 改變目的地。腳本在資料就緒後開始 60 秒編排；原始 WebM 包含開頭載入畫面，交付影片時可裁掉這一小段。`recording.json` 記錄預定／實際時間與 runtime errors，不提交自訂 prompt 的衍生內容。

本次錄製的原始 WebM 為 65.04 秒，已檢查首秒畫面就緒與第 61 秒完整 OUT 畫面，將 1–61 秒轉為 `project-neuron-60s.mp4`：H.264、25fps、1920×1080、恰 60 秒。只裁切載入與尾端停留，不改播放速度或畫面數值。重錄時應先檢查起訖狀態，再自行選擇裁切時間。

| 時間 | 真實畫面與操作 | 說明或旁白 |
|---|---|---|
| 00:00 | 完整儀器與 PROJECT NEURON 品牌 | Transformer 內部訊號的互動式顯微鏡 |
| 00:03 | 公開短句 | The cat sat on the mat |
| 00:05 | 六個真實 BPE tokens | token IDs 由 GPT-2 tokenizer 產生 |
| 00:08 | 選取 sat | 選取位置 2，與下一個 token 預測位置分開 |
| 00:10 | Attention arcs | 原始 query–key 權重，保留自身與因果遮罩 |
| 00:14／16／18 | L01 → L06 → L12 | 逐層比較真實注意力配置 |
| 00:20 | Similarity | 原始 cosine，相似度排名排除自身 |
| 00:24 | Shared PCA Space | 單一 basis、固定軸域 |
| 00:28 | Representation Trail | 連接同一 token 的實際投影座標 |
| 00:33 | Journey／EMB、Cinematic | 從 embedding residual 開始，沒有 attention |
| 00:36 | 1.5× 播放 | 每步 600 ms；EMB → L12 → OUT，沒有重新推論 |
| 00:46 | L12 診斷曲線與精確值表 | 固定最終五個候選，Logit Lens 是診斷投影 |
| 00:52 | OUT／Final Prediction | 真正的最後 forward logits；OUT 不是 Layer 13 |
| 00:57 | 收起數值表，完整儀器 | 同時保留來源標記、選取 token、timeline 和預測 |
| 01:00 | 儀器最後截圖 | Real Transformer signals, visualized |

`/?recording=1` 是靜態主圖 preset：sat／L06／Cinematic／已走過軌跡。`/?recording=1&intro=1` 是影片開場：Attention、沒有 preselected token。兩者均只設定 UI，不修改 analysis object，並隱藏資料切換與 Info 控制。一般使用者直接開 `/`。

公開展示錄影可使用 Guided Showcase 按鈕快速示範；正式 60 秒腳本則以逐段定時操作控制節奏。自訂匯入的 showcase 必須先由使用者選 token，不猜 token 的語意。Escape 停止並退出 Cinematic；隱藏分頁會停止播放。

## 重現 Phase 1B 效能

在根目錄準備兩份真實 CLI 輸出，模型需已下載；benchmark 不會用 fixture 冒充 CLI 檔案。

```powershell
.\.venv\Scripts\python.exe -m engine.cli 'The cat sat on the mat' --model-dir resources/models/gpt2 --offline --output artifacts/phase1b-cli-6.json
$benchmarkPrompt = ' hello' * 64
.\.venv\Scripts\python.exe -m engine.cli $benchmarkPrompt --model-dir resources/models/gpt2 --offline --output artifacts/phase1b-cli-64.json
cd frontend
$env:NEURON_URL = 'http://127.0.0.1:4173'
node scripts/benchmark-phase1b.mjs
```

四種來源組合包含 6／64 tokens × public／CLI import。每類互動 60 次、每組 13 個真實 timer-driven play steps；JSON 報告保留完整原始統計、硬體條件、revision、載入成本、payload 與 JS heap 近似值。Stage commit 包含 PCA、signals、chart focus 和 ranking 全部更新；它不是獨立微量測每個子元件，rAF 等待也不等於 GPU paint 完成。
