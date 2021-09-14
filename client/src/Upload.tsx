import React, { useState, ChangeEvent, useEffect } from "react";
import { Row, Col, Input, Button, message } from "antd";
import { allowUpload, createChunks, Part, request } from "./utils";

function Upload() {
  const [objectURL, setObjectURL] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<File>();
  const [filename, setFilename] = useState<string>("");
  const [hashPercent, setHashPercent] = useState<number>(0); // 计算 hash 的百分比
  const [partList, setPartList] = useState<Part[]>([]);

  useEffect(() => {
    if (currentFile) {
      const reader = new FileReader();
      reader.readAsDataURL(currentFile);
      // 读完之后会 load
      reader.addEventListener("load", () =>
        setObjectURL(reader.result as string)
      );
    }
  }, [currentFile]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file: File = event.target.files![0];
    setCurrentFile(file);
  };

  const calculateHash = (partList: Part[]) => {
    return new Promise((resolve) => {
      const worker = new Worker("/hash.js");
      worker.postMessage({ partList });
      worker.onmessage = function (event) {
        let { percent, hash } = event.data;
        console.log("percent", percent);
        setHashPercent(percent);
        if (hash) {
          resolve(hash);
        }
      };
    });
  };

  const handleUpload = async () => {
    if (!currentFile) {
      return message.error("你尚未选择文件");
    }
    if (!allowUpload(currentFile)) return;
    // 普通整个文件上传
    // const formData = new FormData();
    // formData.append("chunk", currentFile);
    // formData.append("filename", currentFile.name);

    // const result = await request({
    //   url: "/upload",
    //   method: "POST",
    //   data: formData,
    // });
    // console.log("result", result);

    // 分片上传
    const partList: Part[] = createChunks(currentFile);
    // 计算文件 hash 值，通过 webworker 子进程计算，不阻塞主进程
    const fileHash = await calculateHash(partList);
    let lastDotIndex = currentFile.name.lastIndexOf("."); //xxx.jpg
    let extName = currentFile.name.slice(lastDotIndex); //.jpg
    let filename = `${fileHash}${extName}`; // hash.jpg
    setFilename(filename);
    partList.forEach((item: Part, index) => {
      item.filename = filename;
      item.chunk_name = `${filename}-${index}`;
      item.loaded = 0;
      item.percent = 0;
    });
    setPartList(partList);
    await uploadParts(partList, filename);
  };

  const uploadParts = async (partList: Part[], filename: string) => {
    console.log('uploadParts');
    try {
      let requests = createRequests(partList, filename);
      await Promise.all(requests);
      // 上传完成之后进行合并
      await request({ url: `/merge/${filename}` });
      message.success("上传成功");
    } catch (error) {
      message.error("上传失败或暂停");
      //uploadParts(partList, filename);
    }
  };

  const createRequests = (partList: Part[], filename: string) => {
    return partList.map((part) =>
      request({
        url: `/upload/${filename}/${part.chunk_name}`,
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        data: part.chunk,
      })
    );
  };
  return (
    <Row>
      <Col span={12}>
        <Input type="file" style={{ width: 300 }} onChange={handleChange} />
        <Button
          type="primary"
          onClick={handleUpload}
          style={{ marginLeft: 10 }}
        >
          上传
        </Button>
      </Col>
      <Col span={12}>
        {objectURL && <img src={objectURL} alt="" style={{ width: 100 }} />}
      </Col>
    </Row>
  );
}

export default Upload;
