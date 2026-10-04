import type { AnalysisResult, FixtureId } from "../types/analysis";
import { validateAnalysis } from "./validate";
import type { LoadTimings } from "./performance";
export interface LoadedAnalysis {
  analysis: AnalysisResult;
  timings: LoadTimings;
}
export interface AnalysisDataSource {
  load(id: FixtureId): Promise<LoadedAnalysis>;
  clear(id: FixtureId): void;
}
export class FixtureDataSource implements AnalysisDataSource {
  constructor(private readonly basePath = "/fixtures") {}
  private cache = new Map<FixtureId, Promise<LoadedAnalysis>>();
  clear(id: FixtureId) {
    this.cache.delete(id);
  }
  load(id: FixtureId) {
    const found = this.cache.get(id);
    if (found) return found;
    const pending = this.fetchFixture(id).catch((error) => {
      this.cache.delete(id);
      throw error;
    });
    this.cache.set(id, pending);
    return pending;
  }
  private async fetchFixture(id: FixtureId): Promise<LoadedAnalysis> {
    const start = performance.now();
    const response = await fetch(`${this.basePath}/${id}.json`);
    if (!response.ok)
      throw new Error(
        `FIXTURE UNAVAILABLE · HTTP ${response.status}. Generate the public fixtures with npm run fixtures.`,
      );
    const raw = await response.text(),
      fetched = performance.now();
    let unknown: unknown;
    try {
      unknown = JSON.parse(raw);
    } catch {
      throw new Error("INVALID ANALYSIS JSON · The fixture cannot be parsed.");
    }
    const parsed = performance.now(),
      analysis = validateAnalysis(unknown),
      validated = performance.now();
    return {
      analysis,
      timings: {
        fixture: id,
        bytes: new TextEncoder().encode(raw).length,
        fetchMs: fetched - start,
        parseMs: parsed - fetched,
        validationMs: validated - parsed,
        stateMs: 0,
      },
    };
  }
}
export const fixtureSource = new FixtureDataSource();
export const legacyFixtureSource = new FixtureDataSource(
  "/fixtures/legacy-0.1.1",
);
