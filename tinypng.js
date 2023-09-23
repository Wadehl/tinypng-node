const fs = require("fs");
const path = require("path");
const axios = require("axios");
const chalk = require("chalk");

const {Scheduler, timeout} = require('./hooks/useScheduler');
const {calculateMD5, cache} = require('./hooks/useCache');

// 获取命令行参数
const args = process.argv;

// 查找 "--path" 参数并获取其值
const pathIndex = args.indexOf("--path");
let root = process.cwd();

if (pathIndex !== -1 && pathIndex + 1 < args.length) {
  root = args[pathIndex + 1];
  if (!fs.existsSync(root)) {
    throw new Error(root + " 目录不存在");
  }
}

const exts = [".jpg", ".png"];
const max = 5200000; // 5MB == 5242848.754299136

const scheduler = new Scheduler();


fileList(root);
setTimeout(() => {
  console.log(`${chalk.green("开始压缩图片...")}`);
  scheduler.start();
}, 100);

// 生成随机IP， 赋值给 X-Forwarded-For
function getRandomIP() {
  return Array.from(Array(4))
    .map(() => Number(Math.random() * 255))
    .join(".");
}

function getRandomUserAgent() {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 OPR/26.0.1656.60",
    "Opera/8.0 (Windows NT 5.1; U; en)",
    "Mozilla/5.0 (Windows NT 5.1; U; en; rv:1.8.1) Gecko/20061208 Firefox/2.0.0 Opera 9.50",
    "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; en) Opera 9.50",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:34.0) Gecko/20100101 Firefox/34.0",
    "Mozilla/5.0 (X11; U; Linux x86_64; zh-CN; rv:1.9.2.10) Gecko/20100922 Ubuntu/10.10 (maverick) Firefox/3.6.10",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2 ",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11",
    "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/534.16 (KHTML, like Gecko) Chrome/10.0.648.133 Safari/534.16",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.11 TaoBrowser/2.0 Safari/536.11",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.71 Safari/537.1 LBBROWSER",
    "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1; QQDownload 732; .NET4.0C; .NET4.0E)",
    "Mozilla/5.0 (Windows NT 5.1) AppleWebKit/535.11 (KHTML, like Gecko) Chrome/17.0.963.84 Safari/535.11 SE 2.X MetaSr 1.0",
    "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; Trident/4.0; SV1; QQDownload 732; .NET4.0C; .NET4.0E; SE 2.X MetaSr 1.0) ",
  ];

  const random = Math.floor(Math.random() * userAgents.length);

  return userAgents[random];
}

// 获取文件列表
function fileList(folder) {
  fs.readdir(folder, (err, files) => {
    if (err) console.error(err);
    files.forEach(async (file) => {
      const filePath = path.join(folder, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error(err);
        if (stats.isDirectory()) {
          fileList(filePath);
        } else if (
          // 必须是文件，小于5MB，后缀 jpg||png
          stats.size <= max &&
          stats.isFile() &&
          exts.includes(path.extname(file))
        ) {
          // fileUpload(filePath)
          // 判断是否已经压缩过
          if (cache.includes(calculateMD5(filePath))) {
              console.log(chalk.green('文件已经被压缩过了：'), filePath);
          } else {
            scheduler.add(() =>
                timeout(10000).then(() => {
                  fileUpload(filePath);
                })
            );
          }
        }
      });
    });
  });
}

// 异步API,压缩图片
// {"error":"Bad request","message":"Request is invalid"}
// {"input": { "size": 887, "type": "image/png" },"output": { "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885, "url": "https://tinypng.com/web/output/7aztz90nq5p9545zch8gjzqg5ubdatd6" }}
async function fileUpload(img) {
  try {
    const data = fs.readFileSync(img);
    const res = await axios({
      method: "post",
      url: "https://tinypng.com/backend/opt/shrink",
      data,
      headers: {
        rejectUnauthorized: false,
        "Postman-Token": Date.now(),
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": getRandomUserAgent(),
        "X-Forwarded-For": getRandomIP(),
      },
      responseType: "arraybuffer",
    });

    const obj = JSON.parse(res.data.toString());
    if (obj.error) {
      console.log(
        chalk.red(
          `${chalk.blue(`[${img}]`)}\n 压缩失败！报错：${obj.message}`
        )
      );
    } else {
      scheduler.success++;
      fileUpdate(img, obj);
    }
  } catch (err) {
    console.error(
      chalk.red(`${chalk.blue(`[${img}]`)}\n 压缩失败！报错：${err.message}`)
    );
    scheduler.failure++;
    scheduler.errorQueue.push(() =>
      timeout(1000).then(() => {
        fileUpload(img);
      })
    );
  }
}

// 该方法被循环调用,请求图片数据
async function fileUpdate(imgpath, obj) {
  const imgdir = path.dirname(imgpath);

  if (!fs.existsSync(imgdir)) {
    fs.mkdirSync(imgdir, { recursive: true });
  }

  try {
    const res = await axios.get(obj.output.url, {
      responseType: "arraybuffer",
    });
    await fs.writeFile(imgpath, res.data, "binary", (err) => {
      if (err) console.error(err);
      const md5 = calculateMD5(imgpath);
      cache.push(md5);
      console.log(
        chalk.green(
          `${chalk.blue(`[${imgpath}]`)} \n 压缩成功，原始大小：${formatSize(
            obj.input.size
          )}，压缩后大小：${formatSize(obj.output.size)}，优化比例：${100 - obj.output.ratio * 100
          }%`
        )
      );
    });
  } catch (err) {
    console.error(err.message);
  }
}

function formatSize(size) {
  return size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(2)}MB`
    : size > 1024
      ? `${(size / 1024).toFixed(2)}KB`
      : size.toFixed(2) + "B";
}
