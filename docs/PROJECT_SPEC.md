你現在要正式建立一個新的完整軟體專案：

# Project NEURON — AI Neural Network Microscope

這不是聊天機器人。

這是一個互動式 Transformer 神經網路觀測工具，讓使用者輸入文字後，可以直接觀察真實語言模型在 forward pass 中產生的 tokenizer、attention、hidden states、representation similarity、activation magnitude 與 next-token logits。

核心產品概念：

> Make the invisible internal signals of a Transformer visible.

最重要原則：

- 所有核心視覺化必須來自真實模型資料
- 不得用 fake animation 假裝模型內部狀態
- 不得把 attention 描述成「模型真正思考原因」
- 不得把 hidden-state visualization 描述成模型意識或推理
- 所有 derived metrics 必須有明確數學定義
- 優先完成度與 Showcase 效果
- 目標 3–7 天內形成高完成度版本
- 最終必須能 build 成 Windows executable
- 專案必須持續 Git commit
- 使用私人 GitHub repository

---

# 1. TARGET MODEL

Phase 1 只支援一個主要模型：

openai-community/gpt2

使用 Hugging Face Transformers + PyTorch。

理由：

- 小型模型
- 可本機 CPU 執行
- 12 Transformer layers
- causal LM
- 可取得 attentions
- 可取得 hidden states
- 可取得 final logits
- 非常適合作為 visual microscope 的展示模型

不要在 Phase 1 加入大型 Llama、Mistral 或其他多模型系統。

模型載入時優先設定能可靠回傳 attention weights 的 attention implementation。

在 Transformers 支援的情況下使用 eager attention implementation。

---

# 2. PHASE 0 — REAL DATA SPIKE

在寫正式 UI 前，先建立 Python analysis engine。

必須證明以下資料可以從真實 GPT-2 forward pass 中取得：

1. tokenizer tokens
2. token IDs
3. embeddings
4. hidden states for every layer
5. attention weights for every layer/head
6. final logits
7. next-token softmax probabilities

建立 CLI smoke test：

輸入：

The cat sat on the mat

輸出：

- tokens
- token IDs
- number of layers
- number of attention heads
- hidden-state tensor shapes
- attention tensor shapes
- top-10 next-token predictions

同時輸出 machine-readable analysis JSON。

只有 Phase 0 驗證成功後才開始正式 UI。

Phase 0 必須寫測試。

---

# 3. ANALYSIS ENGINE

Python 模組架構至少包含：

engine/
  model_loader.py
  tokenizer_analysis.py
  inference.py
  attention_analysis.py
  hidden_state_analysis.py
  similarity.py
  projection.py
  prediction.py
  protocol.py

所有 inference 使用：

torch.inference_mode()

預設：

max_tokens = 64

不要在 Phase 1 支援超長 context。

---

# 4. REQUIRED DERIVED METRICS

所有 metric 必須定義清楚。

## Hidden magnitude

對每一個 layer/token：

L2 norm(hidden_state)

UI 名稱：

Representation Magnitude

不要稱作 importance。

## Layer delta

對 layer n：

L2(
 hidden_state[n] -
 hidden_state[n-1]
)

UI 名稱：

Representation Change

## Hidden similarity

使用 cosine similarity。

產生：

sequence_length × sequence_length

matrix。

UI 名稱：

Hidden-State Similarity

## Attention relationships

直接使用模型 attention weights。

禁止把 attention weight 稱為 reasoning probability。

## PCA projection

每個 layer：

hidden_states[layer]
→ PCA(n_components=2)

UI 必須明確寫：

2D PCA Projection

不得暗示這是完整 embedding space。

## Logit Lens

對 intermediate hidden state 使用 GPT-2 final normalization + LM head 得出 diagnostic token ranking。

UI 必須命名：

Logit Lens

或：

Logit Lens Estimate

不要把 intermediate logit lens 結果標成真正的 model prediction。

只有 final logits 可以標：

Final Prediction。

---

# 5. FRONTEND STACK

使用：

React
TypeScript
Vite
Electron
Zustand

視覺元件優先使用：

SVG
Canvas
D3 concepts / scales where useful

不要引入大型 dashboard framework。

不要做成 admin dashboard。

---

# 6. DESKTOP ARCHITECTURE

架構：

Electron Renderer
↓
Preload IPC
↓
Electron Main
↓
Python inference worker

Python inference worker 最終必須可以 freeze 成：

neuron-engine.exe

Renderer 不可直接執行 shell command。

所有 native communication 必須經 Electron main/preload。

---

# 7. IPC

Phase 1 不使用 HTTP server。

Electron 啟動 Python worker process。

使用 stdin/stdout JSON-line RPC。

Request 格式示例：

{
  "id": 1,
  "method": "analyze",
  "params": {
    "text": "The cat sat on the mat"
  }
}

Response：

{
  "id": 1,
  "result": { ... }
}

必須支援：

ping
status
analyze
shutdown

必須處理：

worker crash
worker timeout
malformed response
model load failure

Electron 必須可以重新啟動 worker。

---

# 8. DATA TRANSFER

禁止把所有原始 hidden-state tensor 不加處理地傳到 renderer。

Python 端先計算 UI 所需資料。

analysis result 至少包含：

metadata
tokens
token_ids
layer_count
head_count

representation_magnitude
representation_delta
hidden_similarity
pca_coordinates

attention matrices

final_top_k

logit_lens_top_k

必要時可以對 attention 做 JSON-friendly serialization。

保持 payload 可控。

---

# 9. MAIN UI

整體主介面：

TOP BAR

PROJECT NEURON
AI NEURAL NETWORK MICROSCOPE

顯示：

MODEL
PARAMETERS
LAYERS
HEADS
DEVICE
LOCAL / OFFLINE
STATUS

---

主畫面結構：

TOP:
Prompt input

BELOW:
Token strip

LEFT:
Layer Rail

CENTER:
Microscope Visualization

RIGHT:
Token Inspector

BOTTOM:
Prediction Observatory

---

# 10. TOKEN STRIP

輸入完成後顯示 tokenizer 真實 tokens。

每個 token 是 selectable chip。

需要顯示：

token text
token ID on hover
position

hover 和 selection 必須同步所有視圖。

---

# 11. LAYER RAIL

左側垂直顯示：

EMB
01
02
03
...
12
OUT

支援：

click
keyboard up/down
mouse wheel
play/pause animation

目前 layer 必須非常清楚。

---

# 12. ATTENTION MICROSCOPE

至少實作兩種 mode。

## Heatmap

X = key tokens
Y = query tokens

切換：

layer
head
average heads

hover 顯示：

source token
target token
attention weight

## Arc View

token 水平排列。

以曲線顯示 attention relationships。

預設只顯示 strongest edges，避免視覺過載。

選擇 token 後，只突出：

selected token → other tokens

線寬與 opacity 對應真實 attention weight。

禁止 random edge animation。

---

# 13. REPRESENTATION SPACE

建立 2D PCA view。

每個 token 是一個點。

標 token text。

可選：

Embedding
Layer 1–12

Play 時依 layer 更新座標。

必須使用 smooth interpolation。

UI 顯示：

2D PCA Projection

---

# 14. HIDDEN SIMILARITY VIEW

選擇 token 後，顯示它與其他 token 在目前 layer 的 cosine similarity。

至少提供：

ranked list

以及其中一種：

radial view
matrix view

不得將 similarity 描述為 semantic certainty。

---

# 15. TOKEN INSPECTOR

右側顯示：

Token
Token ID
Position

Representation Magnitude
Representation Change

Top Hidden-State Similarities

Strongest Attention Relationships

數值顯示使用 monospace font。

---

# 16. PREDICTION OBSERVATORY

底部顯示 final next-token predictions。

Top-K 預設：

10

顯示：

token
probability
horizontal probability bar

使用真正 final logits + softmax。

增加另一模式：

LOGIT LENS

顯示 selected layer 的 diagnostic top-k。

layer 改變時 ranking 要有 transition animation。

---

# 17. LAYER JOURNEY

這是產品核心 Showcase feature。

提供一個 Flow / Journey mode。

使用者選擇一個 token。

介面可以逐層播放：

Embedding
→ L1
→ L2
→ ...
→ L12
→ Output

每層更新：

representation magnitude
representation delta
attention relationships
hidden similarities
PCA position
logit lens

提供：

PLAY
PAUSE
STEP
RESET

---

# 18. DEMO PRESETS

不要讓首頁只有空白 input。

提供至少四個 preset prompts。

例如：

The cat sat on the

Paris is the capital of

Alice gave Bob the book because

The doctor told the patient that

一鍵即可執行。

---

# 19. CINEMATIC MODE

加入：

CINEMATIC MODE

開啟後：

- 收起不必要 panel
- 放大主要 visualization
- 減少 chrome
- autoplay layers
- smoothing transitions
- 保留關鍵 labels
- 適合螢幕錄影

Cinematic mode 不得新增 fake data。

---

# 20. VISUAL LANGUAGE

不要 cyberpunk。

不要 Matrix rain。

不要假 AI brain animation。

目標：

premium scientific instrument
AI research laboratory
oscilloscope
medical imaging workstation

色彩：

dark graphite / navy background
cyan primary accent
violet secondary accent
amber prediction accent

但保持克制。

大量使用：

thin borders
subtle glow
grid
mono numbers
precise typography

字體風格：

sans-serif UI
monospace data labels

---

# 21. MOTION

動畫只能表達資料變化。

允許：

attention edge interpolation
PCA token movement
prediction ranking transitions
layer transition
selected-token highlighting
numeric interpolation

禁止：

random particles
decorative neural pulses
fake data flow
meaningless animated networks

---

# 22. PERFORMANCE

硬限制：

max input tokens = 64

Phase 1 必須 CPU 可用。

CUDA 可以 optional。

CPU 不能被視為 fallback failure。

模型載入後維持 resident。

不要每次分析 reload model。

建立 analysis cache。

cache key 至少包含：

model
prompt
analysis version

---

# 23. MODEL STORAGE

Development 可以使用 Hugging Face cache。

Production Showcase build 必須支援 bundled local model。

建議：

resources/models/gpt2/

App 必須可以完全離線運行。

如果 bundled model missing：

顯示清楚 error。

不要默默改用 mock data。

---

# 24. WINDOWS BUILD

Python worker 使用 PyInstaller freeze。

Electron 使用 electron-builder。

必須產生：

Windows NSIS installer

以及：

Windows portable build

至少支援 Windows x64。

不要要求使用者額外安裝：

Python
Node.js
PyTorch
Transformers

---

# 25. STARTUP EXPERIENCE

App 啟動時不要顯示空白。

提供 startup screen：

PROJECT NEURON

INITIALIZING NEURAL MICROSCOPE

顯示：

Loading tokenizer
Loading model
Initializing analysis engine
Ready

完成後顯示：

GPT-2
124M PARAMETERS
12 LAYERS
LOCAL
READY

所有狀態必須是真正 worker status，不是假 progress timer。

---

# 26. TESTS

Python unit tests 必須包含：

tokenization deterministic test

hidden-state shape test

attention shape test

attention row-sum approximately 1 test

causal attention future-mask test

softmax probability test

cosine self-similarity approximately 1

similarity matrix symmetry

PCA no NaN / Inf

logit lens finite output

---

Frontend tests：

token selection
layer selection
head selection
mode switching
prediction display
loading state
error state
worker unavailable state

---

Integration：

Electron → worker → model → response → renderer

---

Visual regression：

至少固定測：

attention heatmap
attention arcs
PCA
Layer Journey
Prediction Observatory

使用 Playwright screenshot testing。

---

# 27. FAILURE STATES

必須設計正式 UI，而不是 console error。

至少：

MODEL NOT FOUND

ENGINE FAILED TO START

ANALYSIS FAILED

INPUT TOO LONG

ENGINE RESTARTING

UNSUPPORTED MODEL DATA

所有 failure 不得 fallback 到假的 visual data。

---

# 28. DOCUMENTATION

README 必須包含：

Project concept

Architecture

Model

What the visualizations mean

What the visualizations do NOT mean

How to run

How to build Windows

Testing

Screenshots

Privacy

所有 inference 為 local。

---

# 29. INTERPRETABILITY DISCLAIMER

在 About 或 Info panel 清楚寫明：

Attention weights show how the attention mechanism distributes weight between token positions, but they should not automatically be interpreted as a complete explanation of why a model produced an output.

Hidden-state similarity and PCA views are analytical visualizations of internal vector representations.

Logit Lens is a diagnostic projection of intermediate representations through the model's output head, not the model's actual intermediate prediction process.

保持技術準確。

---

# 30. GIT

初始化 Git repository。

建立私人 GitHub repository：

project-neuron

如果名稱已存在，可使用合理變體。

禁止建立 public repository。

每個穩定 milestone commit。

建議：

chore: bootstrap project neuron

feat: add real gpt2 analysis engine

feat: add attention microscope

feat: add representation explorer

feat: add prediction observatory

feat: add layer journey

feat: integrate desktop inference worker

build: add windows packaging

test: complete phase 1 validation

---

# 31. DEVELOPMENT ORDER

嚴格按照以下順序：

PHASE 0
Real-model Python spike

↓

PHASE 0.5
Basic browser visualization

↓

PHASE 1A
Microscope core

↓

PHASE 1B
Layer Journey + Showcase polish

↓

PHASE 1C
Electron + Python worker

↓

PHASE 1D
Windows packaging + QA

禁止一開始就處理 installer。

先證明 inference 和 visualization。

---

# 32. ACCEPTANCE GATES

Phase 1 完成前必須全部 PASS：

A
Real GPT-2 tokenizer

B
Real hidden states

C
Real attentions

D
Real logits

E
Attention heatmap

F
Attention arc view

G
Layer/head explorer

H
Hidden-state similarity

I
PCA representation view

J
Final top-k prediction

K
Logit Lens

L
Layer Journey

M
Cinematic Mode

N
CPU mode

O
Offline mode

P
Worker crash recovery

Q
Unit tests

R
Integration tests

S
Visual regression

T
Windows installer

U
Windows portable executable

V
Private GitHub repository

不得在 Gate 未通過時宣稱 Phase 1 完成。

---

# 33. OUT OF SCOPE

Phase 1 明確禁止新增：

chatbot
RAG
agents
accounts
cloud database
training
fine-tuning
model editing
SAE
activation patching
causal tracing
neuron interpretability claims
large language models
multimodal
multiple model comparison

除非完成所有 Phase 1 gates 後另外進入下一 Phase。

---

# 34. FINAL DELIVERABLE

最終必須交付：

完整 source code

私人 GitHub repository

Windows NSIS installer

Windows portable executable

bundled/local GPT-2 model strategy

automated tests

README

screenshots

technical architecture documentation

Phase 1 validation report

最後輸出：

PHASE 1 STATUS

IMPLEMENTED

MODEL

REAL DATA VALIDATION

TESTS

PERFORMANCE

WINDOWS BUILD

OFFLINE VALIDATION

GITHUB

KNOWN LIMITATIONS

NEXT PHASE OPTIONS

如果任何 Gate 未完成，必須明確寫：

PHASE 1 INCOMPLETE

不得虛報。

現在先從 Phase 0 開始。

先檢查開發環境、建立專案目錄、初始化 Git、建立私人 GitHub repository，然後實作最小 GPT-2 inference spike。

不要先花時間做完整 UI。