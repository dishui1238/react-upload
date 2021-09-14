import express, { Request, Response, NextFunction } from "express";
import logger from "morgan";
import { INTERNAL_SERVER_ERROR } from "http-status-codes"; //500 服务器内部错误
import createError from "http-errors";
import cors from "cors";
import path from "path";
import fs from "fs-extra";
// import multiparty from "multiparty"; // 处理文件上传
import { TEMP_DIR, mergeChunks } from "./utils";

const app = express();
app.use(logger("dev")); // 开发日志格式
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // 跨域 设置响应头
app.use(express.static(path.resolve(__dirname, "public"))); // 静态文件中间件

// 处理文件上传 不分片
app.post(
  "/upload/:filename/:chunk_name",
  async function (req: Request, res: Response, _next: NextFunction) {
    let { filename, chunk_name } = req.params;
    // let start: number = Number(req.params.start);
    let chunk_dir = path.resolve(TEMP_DIR, filename);
    let exist = await fs.pathExists(chunk_dir);
    if (!exist) {
      await fs.mkdirs(chunk_dir);
    }
    let chunkFilePath = path.resolve(chunk_dir, chunk_name);
    //flags append 后面断点续传
    let ws = fs.createWriteStream(chunkFilePath, { flags: "a" });
    req.on("end", () => {
      ws.close();
      res.json({ success: true });
    });
    req.on("error", () => {
      ws.close();
    });
    req.on("close", () => {
      ws.close();
    });
    req.pipe(ws);
  }
);
// 合并文件
app.get("/merge/:filename", async function (req: Request, res: Response) {
  let { filename } = req.params;
  await mergeChunks(filename);
  res.json({ success: true });
});

// 没有路由处理 就走404错误
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createError(404)); // next 会传给错误中间件
});
// 错误中间件
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.status || INTERNAL_SERVER_ERROR);
  res.json({
    success: false,
    error,
  });
});

export default app;
