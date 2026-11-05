import { HealthStore } from '@/services/health/service';
import * as healthRepo from './healthRepo';
import { getRaw, setRaw } from './repositories';

export const sqliteHealthStore: HealthStore = {
  upsertDaily: healthRepo.upsertDaily,
  cachedDaily: healthRepo.cachedDaily,
  getFlag: getRaw,
  setFlag: setRaw,
};
