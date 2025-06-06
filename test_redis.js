require('dotenv').config();
const Redis = require('ioredis');
// 创建连接
console.log(process.env.REDIS_HOST, process.env.REDIS_PORT, process.env.REDIS_PASSWORD);
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  tls: {} // Azure Redis 需要启用 TLS
});
async function testRedis() {
  try {
    console.log("Connecting to Redis...");
    await redis.set("test:key", "Hello from Azure Redis!", "EX", 60); // 过期时间 60 秒
    const value = await redis.get("test:key");
    console.log("Redis connection successful!");
    console.log("Retrieved value:", value);
    await redis.quit();
  } catch (err) {
    console.error("Redis connection failed:", err);
    process.exit(1);
  }
}
testRedis();