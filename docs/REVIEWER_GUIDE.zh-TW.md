# NEURON｜中文審閱指南

[回到專案首頁](../README.md) · [重現操作](REPRODUCIBILITY.zh-TW.md) · [完整驗證](PHASE1A_VALIDATION.md)

本指南把已實作的技術問題、可查看的畫面與驗證證據對應起來。範圍為 Phase 1A；這是基於預訓練 GPT-2 的分析與視覺化系統，不是新訓練的模型，也沒有主張提高模型準確率或證明模型的因果推理。

## 三個值得檢視的技術問題

| 問題 | 系統如何處理 | 證據入口 |
|---|---|---|
| 如何避免各層 hidden state 定義不一致？ | 取得 EMB 與正規化前的 12 個 block residual outputs；不把已經過 ln_f 的最後 hidden state 當成 raw stream | [推論引擎](../engine/inference.py)、[真實模型測試](../tests/test_real_model.py) |
| 不同層的二維座標能否直接比較？ | 合併所有層／token 擬合一次 PCA；共用 mean、components 與全域軸域，保留舊獨立 PCA 欄位供區分 | [共同投影](../engine/projection.py)、[表徵核心測試](../tests/test_representation_core.py) |
| 如何確認介面沒有換用示意數值？ | 固定模型 revision、公開句子與 JSON SHA-256；runtime 驗證資料，再用真實數值檢查 UI 與舊資料一致性 | [manifest](../frontend/public/fixtures/manifest.json)、[驗證器](../frontend/src/data/validate.ts)、[前端核心測試](../frontend/src/tests/core.test.tsx) |

<a id="sat-layer-comparison"></a>

## 案例：sat 從 L03 到 L09

固定輸入 `The cat sat on the mat`。分析對象是位置 **2**、token ID **3332**、BPE piece **Ġsat**，解碼文字為前導空格加上 `sat`。以下六位小數僅為閱讀格式；原始 JSON 保留完整數值。

| 層 | Magnitude：向量範數 | Change：相較上一層的 L2 | Shared PC1 | Shared PC2 |
|---|---:|---:|---:|---:|
| EMB | 5.640590 | N/A | -392.214966 | -63.064979 |
| L01 | 59.875694 | 59.158249 | -367.936659 | -48.116132 |
| L03 | 70.156593 | 20.413107 | -368.304935 | -46.266318 |
| L06 | 96.067047 | 21.461756 | -348.157693 | -33.510792 |
| L09 | 144.412888 | 39.983856 | -328.806384 | 5.889252 |
| L12 | 508.797150 | 311.700165 | -210.297535 | 385.964580 |

Change 欄永遠比較「上一層 → 這一層」。例如 L09 的 39.983856 是 **L08 → L09**，不能當成 L03 → L09 的變化。

COMPARE 則直接比較 FROM／TO 的完整 768 維向量：

| L03 → L09 指標 | 真實值 | 計算意義 |
|---|---:|---|
| Magnitude 差 | +74.256294 | 兩個向量範數的差值，不是向量相減的範數 |
| 高維 L2 distance | 101.120283 | ‖h[L09] − h[L03]‖₂ |
| 跨層 cosine | 0.767492 | 正規化向量的內積 |

![同一 token 的兩層比較](screenshots/phase1a-compare.png)

這個例子顯示三種量不能混用：向量範數差、高維向量距離、畫面上的二維投影位移。Magnitude 增加本身不代表 token 變得更重要；cosine 也不是語意正確率。共同 PCA 讓投影座標可在這次分析內比較，但二維距離仍不能取代 768 維 L2。

### 從數字追溯到原始資料

來源：[showcase.json](../frontend/public/fixtures/showcase.json)。使用零起算索引：

```text
representation_magnitude[3][2]         → sat 在 L03 的範數
representation_delta[9][2]             → sat 的 L08 → L09 距離
same_token_layer_distance[2][3][9]      → sat 的 L03 → L09 高維距離
same_token_layer_similarity[2][3][9]    → sat 的 L03 → L09 cosine
shared_pca.coordinates[9][2]           → sat 在 L09 的共同投影座標
```

引擎對跨層指標的直接向量驗證位於 [test_representation_core.py](../tests/test_representation_core.py)；[瀏覽器 E2E](../frontend/e2e/core.spec.ts)對照 fixture 檢查 COMPARE 的畫面值。這是數值一致性證據，並非因果解釋的驗證。

## 五步操作示範

1. 開啟本機預覽，選取 `sat`。ATTENTION 的 arcs 表示 query–key 權重。
2. 切到 SIMILARITY，依次看 L01、L06、L12；確認這裡使用 hidden cosine，不是 attention 權重。排名排除自身。
3. 切到 SPACE，使用 layer rail 或 scrubber；同一次分析的軸域保持固定。PCA 軸沒有指定的語意名稱。
4. 開啟 TRAIL；它連接 EMB–L12 的實際投影位置，表示層的順序，不是因果推理路徑。
5. 切到 COMPARE，選 L03 → L09；核對上表，再選 EMB → L12。右上選單可切換 64-token 場景，透過 selector 檢視重疊點。

## 如何讀效能與測試成果

Phase 1A 留有 Python 50、前端 57、E2E 11 項通過的歷史紀錄。原始測試、截圖與 CI 可供核對；目前 workflow 狀態以 [GitHub Actions](https://github.com/oliverchenOVO/project-neuron/actions)為準。

- **互動 JS p95**：handler 到 React layout commit。六-token／64-token 的最慢種類實測為 7.3／8.6 ms，並非模型推論延遲。
- **Engine analysis**：模型 forward 加衍生指標，排除載入與 JSON encoding。64-token 的加入前／後中位數為 535／1,086 ms；新增指標有真實成本。
- **資料載入**：fetch、JSON parse、schema validation、state、first render 分項記錄，不能只用互動數字概括整體等待時間。

各項方法、硬體與完整樣本見 [驗證報告](PHASE1A_VALIDATION.md)、[engine evidence](evidence/phase1a-engine-benchmark.json)與 [browser evidence](evidence/phase1a-browser-benchmark.json)。沒有用固定公開句子的結果推論所有 prompt／硬體都具有相同性能。

## 現在完成與尚未完成的邊界

完成：本機 CPU 推論引擎、JSON-line RPC scaffold、四種瀏覽器分析模式、共享 PCA、跨層比較、真實資料重現與測試流程。

尚未完成：瀏覽器即時輸入推論、Electron worker 整合、Layer Journey、autoplay、Logit Lens UI、Windows installer／portable。目前的研究價值在於可追溯的觀察工具與數值方法；這些尚未實作的功能不列入完成成果。

公開倉庫延續原始 commit history，沒有為展示重建一份乾淨複本。[開發歷程](../README.md#開發歷程)可查看每個已驗證里程碑。
