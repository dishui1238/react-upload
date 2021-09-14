import { message } from "antd";

const DEFAULT_SIZE = 1024 * 1024 * 10; // 10M

export function allowUpload(file: File) {
  let isValidFileType = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "video/mp4",
  ].includes(file.type);
  if (!isValidFileType) {
    message.error("不支持此类文件上传");
  }
  //文件大小的单位是字节  1024bytes=1k*1024=1M*1024=1G*2=2G
  const isLessThan2G = file.size < 1024 * 1024 * 1024 * 2;
  if (!isLessThan2G) {
    message.error("上传的文件不能大于2G");
  }
  return isValidFileType && isLessThan2G;
}

export interface Part {
  chunk: Blob;
  size: number;
  filename?: string;
  chunk_name?: string;
  loaded?: number;
  percent?: number;
  xhr?: XMLHttpRequest;
}

export function createChunks(file: File): Part[] {
  let current = 0;
  let partList: Part[] = [];
  while (current < file.size) {
    const chunk: Blob = file.slice(current, current + DEFAULT_SIZE);
    partList.push({ chunk, size: chunk.size });
    current += DEFAULT_SIZE;
  }
  return partList;
}

interface OPTIONS {
  headers?: any;
  method?: string;
  baseURL?: string;
  url: string;
  data?: any;
}

export function request(options: OPTIONS): Promise<any> {
  let defaultOption = {
    method: "GET",
    baseURL: "http://localhost:8000",
    headers: {}, // 请求头
    data: {}, //请求体
  };
  options = {
    ...defaultOption,
    ...options,
    headers: { ...defaultOption.headers, ...(options.headers || {}) },
  };

  return new Promise((resolve: Function, reject: Function) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method!, `${options.baseURL!}${options.url!}`);

    for (const key in options.headers) {
      xhr.setRequestHeader(key, options.headers[key]);
    }
    xhr.responseType = "json";

    /**
      XHR.readyState == 状态（0，1，2，3，4），而且状态也是不可逆的：

      0：请求未初始化，还没有调用 open()。
      1：请求已经建立，但是还没有发送，还没有调用 send()。
      2：请求已发送，正在处理中（通常现在可以从响应中获取内容头）。
      3：请求在处理中；通常响应中已有部分数据可用了，没有全部完成。
      4：响应已完成；您可以获取并使用服务器的响应了。
     */
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(xhr.response);
        }
      }
    };
    xhr.send(options.data);
  });
}
