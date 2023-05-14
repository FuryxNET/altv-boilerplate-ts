import swc from "@swc/core";
import fs from "fs-extra";
import { extname, join, sep } from "path";
import { minify } from "terser";

const args = process.argv.slice(2);
const minifiedFlag = args.includes("-m");
const resourcePath = "./altv-server/resources/main/";
const modulesPath = "./modules";
const buildPath = "./.build";

async function clearFolders() {
  await fs.remove(buildPath);
  const files = await fs.readdir(resourcePath);
  for (const file of files) {
    if (file === "resource.toml") continue;
    await fs.remove(join(resourcePath, file));
  }
}

async function buildModules() {
  const importModules = {
    client: [],
    server: [],
  };
  const files = await fs.readdir(modulesPath);
  for (const currentModuleName of files) {
    const currentModulePath = join(modulesPath, currentModuleName);
    for (const currentModuleFolder of await fs.readdir(currentModulePath)) {
      switch (currentModuleFolder) {
        case "webview":
          continue;
        case "client":
        case "server":
          importModules[currentModuleFolder].push(`import './${currentModuleName}/index.js'`);
          break;
      }
      await fs.copy(join(currentModulePath, currentModuleFolder), join(buildPath, currentModuleFolder, currentModuleName));
    }
  }
  await Promise.all([
    fs.outputFile(join(buildPath, "client/index.js"), importModules.client.join("\n")),
    fs.outputFile(join(buildPath, "server/index.js"), importModules.server.join("\n")),
  ]);
}

function replaceImport(importLine, filePath) {
  const importSplit = importLine.split(" ");
  for (const key in importSplit) {
    if (!importSplit[key].includes("@/")) continue;
    const splitBySlash = importSplit[key].split("/");
    [splitBySlash[1], splitBySlash[2]] = [splitBySlash[2], splitBySlash[1]];
    importSplit[key] = splitBySlash.join("/");
    const newPath = [];
    for (let i = 1; i < filePath.split(sep).length - 1; i++) newPath.push("../");
    importSplit[key] = importSplit[key].replace("@/", newPath.join(""));
  }
  return importSplit.join(" ");
}

async function fixImports(path) {
  const files = await fs.readdir(path);
  for (const file of files) {
    const filePath = join(path, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fixImports(filePath);
    } else if (stat.isFile() && extname(filePath) === ".ts") {
      const fileContent = await fs.readFile(filePath, "utf-8");
      if (fileContent.includes("import") && fileContent.includes("@/")) {
        const lines = fileContent.split("\n");
        for (const line in lines) {
          if (!lines[line].includes("import") || !lines[line].includes("@/")) continue;
          lines[line] = replaceImport(lines[line], filePath);
        }
        await fs.writeFile(filePath, lines.join("\n"), "utf-8");
      }
    }
  }
}

async function compileTsFile(file) {
  const input = await fs.readFile(file, "utf-8");
  let output = await swc.transform(input, {
    filename: file,
    jsc: {
      parser: { syntax: "typescript" },
      target: "esnext",
    },
  });
  const outputFilePath = file.replace(".ts", ".js");
  if (minifiedFlag) output = await minify(output.code, { mangle: { module: true }, module: true });
  fs.outputFileSync(outputFilePath, output.code, "utf-8");
  fs.removeSync(file);
}

async function compileTypescript(path) {
  const files = await fs.readdir(path);
  for (const file of files) {
    const filePath = join(path, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await compileTypescript(filePath);
    } else if (file.endsWith(".ts")) {
      await compileTsFile(filePath);
    }
  }
}

async function build() {
  await clearFolders();
  await buildModules();
  await fixImports(buildPath);
  await compileTypescript(buildPath);
  await fs.copy(buildPath, resourcePath);
}

build();
