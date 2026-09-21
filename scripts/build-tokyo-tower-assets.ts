import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Export the saved, editable Blender master. Never regenerate or overwrite
// manual modeling edits with an independent procedural approximation.
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.env.BLENDER_BIN ?? 'blender', [
  '--background', 'assets/design-qr/tokyo-tower/tower.blend', '--python-exit-code', '1',
  '--python', 'scripts/blender/export-tokyo-tower.py',
], { cwd: root, stdio: 'inherit' });
if (result.error) throw new Error('Set BLENDER_BIN to Blender 4.5 LTS to export the saved tower model.', { cause: result.error });
if (result.status !== 0) throw new Error(`Blender export failed (${result.status ?? result.signal}).`);
