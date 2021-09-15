import path from "path";
import fs, { WriteStream } from "fs-extra";

const DEFAULT_SIZE = 1024 * 1024 * 50; // 50M

export const PUBLIC_DIR = path.resolve(__dirname, "public");
export const TEMP_DIR = path.resolve(__dirname, "temp");

// 后端分片方法 分割buffer
export const splitChunks = async (
  filename: string,
  size: number = DEFAULT_SIZE
) => {
  const filePath = path.resolve(__dirname, filename); // 待分割文件的绝对路径
  const chunksDir = path.resolve(TEMP_DIR, filename); // 临时路径，存放分割后的文件
  await fs.mkdirp(chunksDir); //递归创建目录
  const content = await fs.readFile(filePath); // buffer

  let i = 0,
    current = 0,
    length = content.length;
  while (current < length) {
    await fs.writeFile(
      path.resolve(chunksDir, `${filename}-${i}`),
      content.slice(current, current + size)
    );
    i++;
    current += size;
  }
};

const pipeStream = (filePath: string, ws: WriteStream) =>
  new Promise(function (resolve: Function) {
    let rs = fs.createReadStream(filePath);
    rs.on("end", async () => {
      await fs.unlink(filePath); // 读取完 删除文件
      resolve();
    });
    rs.pipe(ws);
  });

/**
 * 1.读取temp目录里所有的文件,还要按尾部的索引号
 * 2.把它们累加在一起，另外一旦加过了要把temp目录里的文件删除
 * 3.为了提高性能，尽量用流来实现，不要readFile writeFile
 */
export async function mergeChunks(
  filename: string,
  size: number = DEFAULT_SIZE
) {
  const filePath = path.resolve(PUBLIC_DIR, filename); // 合并后输出的文件路径
  const chunksDir = path.resolve(TEMP_DIR, filename); // 待合并的文件路径

  const chunkFiles = await fs.readdir(chunksDir);
  //按文件名升序排列
  chunkFiles.sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
  await Promise.all(
    chunkFiles.map((chunkFile: string, index: number) =>
      pipeStream(
        path.resolve(chunksDir, chunkFile),
        fs.createWriteStream(filePath, {
          start: index * size,
        })
      )
    )
  );
  await fs.rmdir(chunksDir); // 删除整个临时目录
}

// splitChunks("WechatIMG20.jpeg");
// mergeChunks("WechatIMG20.jpeg");
