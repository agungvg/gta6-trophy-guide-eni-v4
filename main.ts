// Sunset Ledger — a GTA VI trophy guide and tracker for gta6-trophy-guide-01.
// Node 22, standard library only. The app is plain static files under app/:
// index.html opens in desktop Chrome with the network off, its trophy data in
// app/data/trophies.json, its sources in app/data/sources.json, its roadmap in
// app/data/roadmap.json. This program hands the entry in: it copies app/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json with the vendored make.fun library, which the scorer
// rebuilds byte for byte. vendor/makefun-frontend.ts is the kit's copy and is
// left exactly as it shipped.
//
// Run it locally (outside the grader) with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outDir, { recursive: true });
cpSync(join(here, "app"), join(outDir, "app"), { recursive: true });

const shotsDir = join(outDir, "screenshots");
mkdirSync(shotsDir, { recursive: true });
if (existsSync(join(here, "screenshots"))) {
  cpSync(join(here, "screenshots"), shotsDir, { recursive: true });
}

// The scorer's caps, as the kit's reference/gate.json states them: at most
// 4 screenshots, each at most 256 KiB; app/ at most 993 files and
// directories and 48 MiB in all. text_max_bytes shapes the dossier text.
writeFileSync(
  join(outDir, "dossier.json"),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);
