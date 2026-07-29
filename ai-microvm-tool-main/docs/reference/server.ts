import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import type { Response as ExpressResponse } from 'express';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';

const aimtctlPath = resolve(process.cwd(), 'ai-microvm-tool-main/scripts/aimtctl.mjs');

// Gateway hardening: upper limit for aimtctl process execution
const AIMT_MAX_BUFFER = 4 * 1024 * 1024; // 4 MB > max_output_bytes(1MB) + JSON wrapper
const AIMT_GATEWAY_TIMEOUT_MS = 30_000;  // Absolute gateway ceiling

function execAimtctl(
  sub: string,
  flags: string[],
  dashArgs: string[],
  timeoutMs: number | undefined,
  res: ExpressResponse,
) {
  const tail = dashArgs.length ? ['--', ...dashArgs] : [];
  const cmdArgs = [aimtctlPath, sub, ...flags, ...tail];

  const timeout = Math.min(
    (timeoutMs ?? AIMT_GATEWAY_TIMEOUT_MS) + 5_000,
    AIMT_GATEWAY_TIMEOUT_MS,
  );

  execFile(
    process.execPath,
    cmdArgs,
    { timeout, maxBuffer: AIMT_MAX_BUFFER },
    (err, stdout, stderr) => {
      try {
        return res.json(JSON.parse(stdout));
      } catch {
        const msg =
          err?.code === 'ETIMEDOUT'
            ? 'aimtctl timed out at gateway'
            : stderr || err?.message || `Failed to parse ${sub} output`;
        return res.status(500).json({ ok: false, error: msg });
      }
    },
  );
}

const app = express();
app.use(express.json());

/**
 * AI MicroVM API Endpoints
 */
app.get('/api/doctor', (_req, res) => {
  execAimtctl('doctor', [], [], undefined, res);
});

app.post('/api/explain', (req, res) => {
  const { profile = 'wasm-echo', policy = 'default', engine = 'auto', timeoutMs, args = [] } = req.body || {};
  const flags = ['--profile', String(profile), '--policy', String(policy), '--engine', String(engine)];
  if (timeoutMs) flags.push('--timeout-ms', String(timeoutMs));
  execAimtctl('explain', flags, args.map(String), timeoutMs, res);
});

app.post('/api/run', (req, res) => {
  const { profile = 'wasm-echo', policy = 'default', engine = 'auto', timeoutMs, args = [] } = req.body || {};
  const flags = ['--profile', String(profile), '--policy', String(policy), '--engine', String(engine), '--output', 'json'];
  if (timeoutMs) flags.push('--timeout-ms', String(timeoutMs));
  execAimtctl('run', flags, args.map(String), timeoutMs, res);
});

/**
 * Angular SSR & Static Handlers
 */
const browserDistFolder = resolve(process.cwd(), 'dist/ai-studio-angular-app/browser');

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

const angularApp = new AngularNodeAppEngine();

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 3000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
