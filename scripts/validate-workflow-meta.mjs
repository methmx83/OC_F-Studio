#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootArg = process.argv[2] ?? process.cwd();
const root = path.resolve(rootArg);
const categories = ['images', 'videos', 'audio'];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

const errors = [];
const warnings = [];

for (const category of categories) {
  const dir = path.join(root, 'workflows', category);
  const files = walk(dir).filter((f) => f.endsWith('.meta.json'));

  for (const file of files) {
    const rel = path.relative(root, file);
    const parsed = readJson(file);
    if (!parsed.ok) {
      errors.push(`${rel}: JSON ungueltig -> ${parsed.error}`);
      continue;
    }

    const meta = parsed.data ?? {};

    if (meta.category !== category) {
      errors.push(`${rel}: category muss '${category}' sein, ist aber '${meta.category ?? 'undefined'}'`);
    }

    if (!Array.isArray(meta.inputs)) {
      errors.push(`${rel}: inputs muss ein Array sein`);
      continue;
    }

    const seenKeys = new Set();
    for (const input of meta.inputs) {
      const key = input?.key;
      if (typeof key !== 'string' || key.length === 0) {
        errors.push(`${rel}: inputs[].key fehlt oder ist leer`);
        continue;
      }

      if (seenKeys.has(key)) {
        errors.push(`${rel}: doppelter input key '${key}'`);
      }
      seenKeys.add(key);

      if (!key.endsWith('AssetId')) {
        errors.push(`${rel}: key '${key}' muss auf 'AssetId' enden`);
      }

      if (key.endsWith('AssetAbsPath')) {
        errors.push(`${rel}: key '${key}' darf nicht direkt 'AssetAbsPath' sein (nutze ...AssetId)`);
      }
    }

    const apiFile = file.replace(/\.meta\.json$/i, '.api.json');
    if (!fs.existsSync(apiFile)) {
      warnings.push(`${rel}: passende API-Datei fehlt (${path.basename(apiFile)})`);
    }
  }
}

if (warnings.length > 0) {
  console.log('\nWarnungen:');
  for (const w of warnings) console.log(`- ${w}`);
}

if (errors.length > 0) {
  console.error('\nFehler:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('Workflow-Meta-Validierung: OK');
