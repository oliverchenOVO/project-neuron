import { useEffect, useRef, useState } from "react";
import { useMicroscope } from "../state/microscope";

export function LocalAnalysisDialog({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const attempt = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => { attempt.current++; pending.current?.abort(); element.close(); };
  }, []);
  async function importFile(file: File) {
    const ticket = ++attempt.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(null); setLoaded(null);
    try {
      const accepted = await useMicroscope.getState().importLocal(file, controller.signal);
      if (ticket === attempt.current && accepted) setLoaded(file.name);
    } catch (e) {
      if (ticket === attempt.current)
        setError(e instanceof Error ? e.message : "讀取失敗，請重新選擇檔案。");
    } finally {
      if (ticket === attempt.current) setBusy(false);
    }
  }
  return (
    <dialog className="info-dialog local-dialog" ref={dialog} onCancel={close} aria-labelledby="local-title">
      <div className="dialog-header">
        <h2 id="local-title">載入本機分析 / LOCAL ANALYSIS</h2>
        <button aria-label="Close local analysis" onClick={close}>×</button>
      </div>
      <p>把 Python CLI 產生的 JSON 載入顯微鏡，查看 Attention、Similarity、Space、Compare 與 Journey。</p>
      <div className="local-privacy">只在此瀏覽器記憶體讀取 · 不上傳 · 不儲存到伺服器 · 重新整理後回到公開展示</div>
      <ol className="local-steps">
        <li>在專案根目錄執行已安裝的本機 GPT-2 引擎：</li>
      </ol>
      <pre><code>{'.\\.venv\\Scripts\\python.exe -m engine.cli "Your text" --model-dir resources/models/gpt2 --offline --output artifacts/my-analysis.json'}</code></pre>
      <p>再選擇輸出的檔案。支援 schema 0.3.0、固定 GPT-2 revision、1–64 tokens、最多 32 MiB。舊 0.2.0 可使用原有四模式；請重新執行 CLI 取得 Journey 與 Prediction Evolution，不會補造缺少的曲線。</p>
      <label className="local-file-label">
        選擇分析 JSON
        <input aria-label="Local analysis JSON" type="file" accept=".json,application/json" disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void importFile(file); }} />
      </label>
      {busy && <p role="status">正在讀取並驗證矩陣、模型版本與數值…</p>}
      {error && <div className="local-error" role="alert"><strong>未載入檔案</strong><p>{error}</p><span>上一份分析保留，可重新選檔或關閉此視窗。</span></div>}
      {loaded && <div className="local-success" role="status"><strong>已載入 {loaded}</strong><p>顯微鏡已使用這份檔案的數值。格式檢查不代表已驗證檔案來源或模型推論真實性。</p></div>}
      <div className="local-actions"><button onClick={close}>{loaded ? "開始觀察" : "返回顯微鏡"}</button></div>
    </dialog>
  );
}
