import fs from 'fs-extra';
import path from 'path';
import { minify } from 'terser';

const resourcePath = './altv-server/resources/furyxnet/';
const preBuildPath = './.prebuild';
const buildPath = './.build';
const modulesPath = './modules';

async function clearFolders() {
  await fs.remove(buildPath);
  const files = await fs.readdir(resourcePath);
  for (const file of files) {
    if (file === 'resource.toml') continue;
    await fs.remove(path.join(resourcePath, file));
  }
}

async function buildModules() {
  const importModules = {
    client: [],
    server: [],
  };
  const files = await fs.readdir(preBuildPath);
  for (const currentModuleName of files) {
    const currentModulePath = path.join(preBuildPath, currentModuleName);
    for (const currentModuleFolder of await fs.readdir(currentModulePath)) {
      if (currentModuleFolder.includes('client') || currentModuleFolder.includes('server')) {
        importModules[currentModuleFolder].push(`import './${currentModuleName}/index.js'`);
      }
      await fs.copy(path.join(currentModulePath, currentModuleFolder), path.join(buildPath, currentModuleFolder, currentModuleName));
    }
  }
  await Promise.all([
    fs.outputFile(path.join(buildPath, 'client/index.js'), importModules.client.join('\n')),
    fs.outputFile(path.join(buildPath, 'server/index.js'), importModules.server.join('\n')),
  ]);
}

function replaceImport(importLine, filePath) {
  const importSplit = importLine.split(' ');
  importSplit[importSplit.length - 1] = importSplit[importSplit.length - 1].replace(/[';]/g, '');
  const importPath = importSplit[importSplit.length - 1].split('/');
  importPath[importPath.length - 1] = importPath[importPath.length - 1].trimEnd();
  importPath.shift();
  const folders = ['server', 'client', 'shared'];
  folders.forEach((folder) => {
    const folderIndex = importPath.indexOf(folder);
    if (folderIndex > -1) {
      importPath.splice(folderIndex, 1);
      importPath.unshift(folder);
    }
  });
  for (let i = 1; i < filePath.split(path.sep).length - 1; i++) importPath.unshift('..');
  importSplit[importSplit.length - 1] = `'${importPath.join('/')}';`;
  return importSplit.join(' ');
}

async function fixImports(rootDir) {
  const importSearch = "'@/";
  const files = await fs.readdir(rootDir);
  for (const file of files) {
    const filePath = path.join(rootDir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fixImports(filePath, importSearch);
    } else if (stat.isFile() && path.extname(filePath) === '.js') {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      if (fileContent.includes(importSearch)) {
        const lines = fileContent.split('\n');
        for (const line in lines) {
          if (lines[line].includes(importSearch)) {
            lines[line] = replaceImport(lines[line], filePath);
          }
        }
        const updatedContent = lines.join('\n');
        await fs.writeFile(filePath, updatedContent, 'utf-8');
      }
    }
  }
}

async function minifyJSFiles(directoryPath) {
  const files = await fs.readdir(directoryPath);
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      minifyJSFiles(filePath);
    } else if (stats.isFile() && file.endsWith('.js')) {
      const code = await fs.readFile(filePath, 'utf8');
      const minified = await minify(code);
      fs.writeFile(filePath, minified.code);
    }
  }
}

async function copyOtherFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (filePath.includes('webview')) return;
    if (path.extname(file) === '.ts') return;
    if (fs.statSync(filePath).isDirectory()) {
      copyOtherFiles(filePath);
    } else {
      fs.copySync(filePath, path.join(preBuildPath, path.relative(modulesPath, filePath)));
    }
  });
}

async function build() {
  const args = process.argv.slice(2);
  const minifiedFlag = args.includes('-m');
  await copyOtherFiles(modulesPath);
  await clearFolders();
  await buildModules();
  await fixImports(buildPath);
  if (minifiedFlag) await minifyJSFiles(buildPath);
  await fs.copy(buildPath, resourcePath);
  await fs.remove(preBuildPath);
}

build();
