import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const root = resolve(import.meta.dirname, "../..");
const python =
  process.env.NEURON_PYTHON ||
  resolve(
    root,
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );
if (!existsSync(python))
  throw new Error(
    "Install the documented Python environment or set NEURON_PYTHON.",
  );
const result = spawnSync(
  python,
  ["-B", "-m", "scripts.generate_showcase_fixture", "--verify-reproducibility"],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 1);
