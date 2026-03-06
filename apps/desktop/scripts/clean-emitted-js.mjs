/* global process, console */
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!entry.name.endsWith('.js')) {
      continue;
    }

    await fs.unlink(full);
    console.log(`[clean-emitted-js] removed ${path.relative(process.cwd(), full)}`);
  }
}

try {
  await walk(root);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    process.exit(0);
  }
  throw error;
}
