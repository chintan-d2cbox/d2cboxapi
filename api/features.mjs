/**
 * GET /api/features  — never needs editing.
 * Reads every .js file in /features and splits it into tabs.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BAR = '// =+';

const parse = (text, file) => {
  const title = text.match(/^\/\/ FEATURE:\s*(.+)$/m)?.[1].trim() || file.replace(/\.js$/, '');
  const parts = text.split(new RegExp(`^${BAR}\\n// TAB:\\s*(.+)\\n// PASTE:\\s*(.*)\\n${BAR}[ \\t]*$`, 'm'));

  const tabs = [];
  for (let i = 1; i < parts.length; i += 3) {
    tabs.push({ name: parts[i].trim(), hint: parts[i + 1].trim(), code: parts[i + 2].replace(/^\n+|\s+$/g, '') });
  }
  return { title, tabs };
};

export async function GET() {
  const dir = path.join(process.cwd(), 'features');
  const files = (await readdir(dir)).filter(f => f.endsWith('.js'));

  const features = await Promise.all(files.map(async (file) =>
    parse(await readFile(path.join(dir, file), 'utf8'), file)
  ));

  features.sort((a, b) => a.title.localeCompare(b.title));
  return Response.json(features);
}
