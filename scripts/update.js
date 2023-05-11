import fs from "fs-extra";
import https from "https";
import os from "os";
import { join } from "path";

const platform = os.platform();
const serverFolder = "./altv-server";
const CDN = "https://cdn.alt-mp.com";

const clear = (path) => {
  const files = fs.readdirSync(path);
  for (const file of files) {
    if (file === "server.toml" || file === "resources") continue;
    fs.removeSync(join(path, file));
  }
};

const downloadFile = (url, path) => {
  fs.ensureFileSync(path);

  const file = fs.createWriteStream(path);
  const fileName = path.split("/");
  console.log(`Скачивание файла ${fileName[fileName.length - 1]}`);
  https.get(url, (res) => {
    const fileSize = parseInt(res.headers["content-length"], 10);
    let downloadedSize = 0;

    res.on("data", (chunk) => {
      file.write(chunk);
      downloadedSize += chunk.length;
      const percent = ((downloadedSize / fileSize) * 100).toFixed();
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      if (percent !== "100") {
        process.stdout.write(`[${"#".repeat(percent)}${".".repeat(100 - percent)}] ${percent}%`);
      } else {
        process.stdout.write("");
      }
    });

    res.on("end", () => {
      file.end();
    });
  });
};

const downloadData = () => {
  const files = ["clothes.bin", "vehmods.bin", "vehmodels.bin", "pedmodels.bin"];
  for (const file in files) {
    downloadFile(`${CDN}/data/release/data/${files[file]}`, `${serverFolder}/data/${files[file]}`);
  }
};

switch (platform) {
  case "win32":
    clear(serverFolder);
    downloadFile(`${CDN}/server/release/x64_win32/altv-server.exe`, `${serverFolder}/altv-server.exe`);
    downloadData();
    downloadFile(`${CDN}/js-module/release/x64_win32/modules/js-module/js-module.dll`, `${serverFolder}/modules/js-module/js-module.dll`);
    downloadFile(`${CDN}/js-module/release/x64_win32/modules/js-module/libnode.dll`, `${serverFolder}/modules/js-module/libnode.dll`);
    break;
  case "linux":
    clear(serverFolder);
    downloadFile(`${CDN}/server/release/x64_linux/altv-server`, `${serverFolder}/altv-server`);
    downloadData();
    downloadFile(
      `${CDN}/js-module/release/x64_linux/modules/js-module/libjs-module.so`,
      `${serverFolder}/modules/js-module/libjs-module.so`
    );
    downloadFile(`${CDN}/js-module/release/x64_linux/modules/js-module/libnode.so.108`, `${serverFolder}/modules/js-module/libnode.so.108`);
    break;
  default:
    console.error("The script does not support your operating system.");
    break;
}
