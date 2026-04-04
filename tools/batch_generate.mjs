#!/usr/bin/env node
// Batch generate all sprites for DEAD PROCESS
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const TOKEN = process.argv[2] || process.env.HF_TOKEN;
const HOME = process.env.USERPROFILE || process.env.HOME;
const SCRIPT = resolve(HOME, '.claude/skills/pixel-art-gen/scripts/generate_sprite.mjs');
const scriptPath = SCRIPT;

const OUTDIR = 'images/sprites';

const presets = [
  'player_down', 'player_up', 'player_left', 'player_right',
  'terminal', 'safe', 'door_locked', 'door_unlocked',
  'note', 'server_rack', 'desk', 'switch_panel',
  'hdd_slot', 'usb_slot', 'shelf', 'core_server',
  'camera', 'floor_map',
  'tile_floor', 'tile_wall', 'tile_rack',
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`Script: ${scriptPath}`);
  console.log(`Output: ${OUTDIR}/`);
  console.log(`Total: ${presets.length} sprites`);
  console.log('');

  let success = 0, fail = 0;

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    const output = `${OUTDIR}/${preset}.png`;

    // Skip if already exists
    if (existsSync(output)) {
      console.log(`[${i+1}/${presets.length}] SKIP ${preset} (already exists)`);
      success++;
      continue;
    }

    console.log(`[${i+1}/${presets.length}] Generating ${preset}...`);
    try {
      execSync(
        `node "${scriptPath}" --token "${TOKEN}" --preset ${preset} --output "${output}"`,
        { stdio: 'pipe', timeout: 60000 }
      );
      console.log(`  -> OK`);
      success++;
    } catch (e) {
      console.error(`  -> FAIL: ${e.stderr?.toString().trim() || e.message}`);
      fail++;
    }

    // Rate limit: wait 2s between requests
    if (i < presets.length - 1) await sleep(2000);
  }

  console.log('');
  console.log(`Done: ${success} success, ${fail} failed`);
}

main();
