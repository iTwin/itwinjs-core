# ECSqlReader concurrent-query performance: A vs B (final)

**A** = original addon (`9cd010a6`) · **B** = new addon with serialization fix (`4742fee6`).
Throughput in queries/sec (higher = better), mean of 2 runs/phase; range spans maxConc 16 and 64.
All runs: 0 errors, `rows=847828`.

| workers | A | B (fixed) | Δ |
|--:|--:|--:|--:|
| 1 | 182–183 | 182–184 | ~0% |
| 2 | 307–313 | 306–309 | ≤1.4% |
| 4 | 410–427 | 415–426 | ≤1.1% |
| 8 | 228–239 | 230–238 | ≤1.1% |

**B matches A within ~1% at every concurrency — the earlier low-concurrency regression
(per-character `std::string::push_back` JSON serialization) is fixed.**
