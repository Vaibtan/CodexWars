const DAY_MS = 86_400_000;

export interface GenerationGovernorOptions {
  readonly dailyGenerationLimit: number;
  readonly dailySearchLimit: number;
  readonly maxConcurrent: number;
}

export interface GenerationPermit {
  recordSearchCalls(count: number): boolean;
  release(): void;
}

export interface GenerationGovernor {
  acquire(now: number): GenerationPermit | undefined;
}

export function createGenerationGovernor(options: GenerationGovernorOptions): GenerationGovernor {
  let active = 0;
  let day = Number.NaN;
  let generations = 0;
  let searchCalls = 0;

  return {
    acquire(now) {
      const requestedDay = Math.floor(now / DAY_MS);
      if (requestedDay !== day) {
        day = requestedDay;
        generations = 0;
        searchCalls = 0;
      }
      if (active >= options.maxConcurrent || generations >= options.dailyGenerationLimit || searchCalls >= options.dailySearchLimit) return undefined;

      active += 1;
      generations += 1;
      let released = false;
      return {
        recordSearchCalls(count) {
          if (!Number.isInteger(count) || count < 0 || searchCalls + count > options.dailySearchLimit) return false;
          searchCalls += count;
          return true;
        },
        release() {
          if (released) return;
          released = true;
          active -= 1;
        }
      };
    }
  };
}
