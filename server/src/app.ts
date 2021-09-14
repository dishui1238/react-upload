import express, { Request, Response, NextFunction } from "express";
import logger from "morgan";
import { INTERNAL_SERVER_ERROR } from "http-status-codes"; //500 服务器内部错误
import createError from "http-errors";
import cors from "cors";
import path from "path";
import fs from "fs-extra";
import multiparty from "multiparty"; // 处理文件上传
import { PUBLIC_DIR } from "./utils";

const app = express();
app.use(logger("dev")); // 开发日志格式
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // 跨域
app.use(express.static(path.resolve(__dirname, "public"))); // 静态文件中间件

app.post("/upload", (req: Request, res: Response, next: NextFunction) => {
  const form = new multiparty.Form();
  form.parse(req, async (err: any, fields, files) => {
    if (err) return next(err);
    console.log(fields, files);
    let filename = fields.filename[0]; //'dog.jpg'
    let chunk = files.chunk[0]; //{}
    await fs.move(chunk.path, path.resolve(PUBLIC_DIR, filename), {
      overwrite: true,
    });
    res.json({ success: true });
  });
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
