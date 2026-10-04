"""Compare genuine old/new analysis pipelines on one resident official model."""
import json
import os
from pathlib import Path
import statistics
import subprocess
import time
import torch
from engine.inference import AnalysisEngine
from engine.model_loader import ModelLoader
from scripts.generate_showcase_fixture import PROMPTS

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '192d12d4030c9f8c4e9a303d5cd69d754652f216'


def main():
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    old_code = subprocess.check_output(['git', 'show', f'{BASELINE}:engine/inference.py'], cwd=ROOT, text=True, encoding='utf-8')
    namespace = {'__package__': 'engine', '__name__': 'engine.phase05_benchmark_baseline'}
    # Exactly the retained prior analysis implementation, not an estimated cost.
    import types, sys
    module = types.ModuleType(namespace['__name__'])
    module.__dict__.update(namespace)
    sys.modules[module.__name__] = module
    exec(compile(old_code, 'phase05-baseline/inference.py', 'exec'), module.__dict__)
    loader = ModelLoader(ROOT/'resources/models/gpt2', offline=True)
    start = time.perf_counter(); loader.load(); loading_ms = (time.perf_counter()-start)*1000
    engines = {'before':module.AnalysisEngine(loader), 'after':AnalysisEngine(loader)}
    evidence = {'baseline_commit':BASELINE,'method':'One resident pinned CPU model; 2 warmups, 7 paired uncached requests, alternating pipeline order; same fixed public prompts. JSON encoding timed separately.', 'model_loading_ms':loading_ms,'cpu_threads':torch.get_num_threads(),'fixtures':{}}
    for name, prompt in PROMPTS.items():
        for engine in engines.values():
            for _ in range(2):
                engine.cache.clear(); engine.analyze(prompt)
        samples = {'before':[], 'after':[]}
        for i in range(7):
            for label in (['before','after'] if i%2==0 else ['after','before']):
                engine=engines[label]; engine.cache.clear(); start=time.perf_counter(); result=engine.analyze(prompt)
                request_ms=(time.perf_counter()-start)*1000
                start=time.perf_counter(); encoded=json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf-8'); encoding_ms=(time.perf_counter()-start)*1000
                m=result['metadata']; samples[label].append({'forward_ms':m['forward_ms'],'derived_ms':m['analysis_ms']-m['forward_ms'],'analysis_ms':m['analysis_ms'],'request_ms':request_ms,'new_metrics_ms':m.get('new_metrics_ms',0),'serialization_ms':encoding_ms,'bytes':len(encoded)})
        medians={label:{k:statistics.median(s[k] for s in group) for k in group[0]} for label,group in samples.items()}
        evidence['fixtures'][name]={'samples':samples,'medians':medians,'analysis_delta_ms':medians['after']['analysis_ms']-medians['before']['analysis_ms'],'derived_delta_ms':medians['after']['derived_ms']-medians['before']['derived_ms']}
        print(name, json.dumps(evidence['fixtures'][name]['medians']),flush=True)
    target=ROOT/'docs/evidence/phase1a-engine-benchmark.json';target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':main()
