/* eslint-disable no-restricted-globals */

// self代表子线程自身，即子线程的全局对象

// sparkMD5 计算文件的 md5 值 是一个 32 位的字符串
self.importScripts("https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.js"); // 同步

// onmessage 监听函数，接收主线程发的数据， 也可以使用 self.addEventListener('message',callback)
self.onmessage = async (event) => {
  const { partList } = event.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percent = 0; // 进度
  const perSize = 100 / partList.length; // 每计算完一个part,相当于完成了百分之几 25%
  const buffers = await Promise.all(
    partList.map(
      ({ chunk, size }) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsArrayBuffer(chunk);
          reader.onload = (event) => {
            percent += perSize;
            self.postMessage({ percent: Number(percent.toFixed(2)) });
            resolve(event.target.result);
          };
        })
    )
  );
  buffers.forEach(buffer => spark.append(buffer));
  //通知主进程，当前的哈希已经全部完成，并且把最终的hash值给主进程发过去
  self.postMessage({ percent: 100, hash: spark.end() });
  self.close();

};
