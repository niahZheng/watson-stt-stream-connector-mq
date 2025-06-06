const fs = require('fs');
const path = require('path');
const util = require('util');

// 控制是否写入文件的开关
let writeToFile = false;

// 确保日志文件夹存在
const logDir = path.join(__dirname, '../log');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 创建日志文件流
const logFile = path.join(logDir, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// 格式化对象为易读的字符串
function formatObject(obj) {
  return util.inspect(obj, {
    colors: true,  // 终端彩色输出
    depth: null,   // 完整深度
    compact: false // 格式化的输出
  });
}

// 自定义日志函数，同时输出到文件和终端
function log(level, message, error = null) {
  const timestamp = new Date().toISOString();
  let consoleMessage;  // 终端消息（带颜色）
  let fileMessage;     // 文件消息（纯文本）

  // 处理不同类型的消息
  if (error) {
    // 错误消息
    const errorDetails = `Error: ${error.message}\nStack: ${error.stack}`;
    consoleMessage = `\x1b[31m[${timestamp}] [${level.toUpperCase()}] ${message} - ${errorDetails}\x1b[0m`;
    fileMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} - ${errorDetails}\n`;
  } else if (typeof message === 'object') {
    // 对象消息
    const formattedObj = JSON.stringify(message, null, 2);
    consoleMessage = `\x1b[36m[${timestamp}] [${level.toUpperCase()}] ${formattedObj}\x1b[0m`;
    fileMessage = `[${timestamp}] [${level.toUpperCase()}] ${formattedObj}\n`;
  } else {
    // 普通字符串消息
    consoleMessage = `\x1b[32m[${timestamp}] [${level.toUpperCase()}] ${message}\x1b[0m`;
    fileMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  }

  // 输出到终端（带颜色）
  console.log(consoleMessage);

  // 只有在 writeToFile 为 true 时才写入文件
  if (writeToFile) {
    logStream.write(fileMessage);
  }
}

// 不同级别的颜色配置
const levelColors = {
  trace: '\x1b[90m',   // 灰色
  debug: '\x1b[36m',   // 青色
  info: '\x1b[32m',    // 绿色
  warn: '\x1b[33m',    // 黄色
  error: '\x1b[31m',   // 红色
  important: '\x1b[35m'// 紫色
};

// 导出统一的 logger
const logger = {
  trace: (message) => log('trace', message),
  debug: (message) => log('debug', message),
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message, error) => log('error', message, error),
  important: (message) => log('important', message),
  // 添加控制文件写入的方法
  setWriteToFile: (value) => {
    writeToFile = value;
  }
};

module.exports = logger;