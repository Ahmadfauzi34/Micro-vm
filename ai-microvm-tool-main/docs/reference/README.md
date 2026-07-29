# Reference Server Gateway (`server.ts`)

File `server.ts` di folder ini adalah contoh implementasi gateway Express.js / Angular SSR yang menghubungkan request HTTP (`/api/doctor`, `/api/explain`, `/api/run`) dengan CLI runner `aimtctl.mjs`.

## Fitur Hardening Gateway
1. **DRY Execution Helper (`execAimtctl`)**: Menghindari duplikasi parsing JSON dan penanganan error.
2. **Buffer Safety (`AIMT_MAX_BUFFER = 4MB`)**: Mencegah crash `maxBuffer exceeded` saat stdout WASM dibungkus metadata JSON.
3. **Gateway Timeout (`AIMT_GATEWAY_TIMEOUT_MS = 30s`)**: Mencegah HTTP request menggantung jika proses child bermasalah.

> Catatan: Jalur `aimtctlPath` di dalam file ini berasumsi pada struktur AI Studio (`ai-microvm-tool-main/scripts/aimtctl.mjs`). Jika dipakai di root repo standalone, sesuaikan menjadi `scripts/aimtctl.mjs`.
