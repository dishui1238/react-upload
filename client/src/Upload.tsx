import React, { useState, ChangeEvent, useEffect } from "react";
import { Row, Col, Input, Button, message, Progress, Table } from "antd";
import { allowUpload, createChunks, Part, request } from "./utils";

enum UploadStatus {
  INIT,
  PAUSE,
  UPLOADING,
}
interface Uploaded {
  filename: string;
  size: number;
}

function Upload() {
  const [objectURL, setObjectURL] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<File>();
  const [filename, setFilename] = useState<string>("");
  const [hashPercent, setHashPercent] = useState<number>(0); // 计算 hash 的百分比
  const [partList, setPartList] = useState<Part[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(
    UploadStatus.INIT
  );

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

  // 点击上传
  const handleUpload = async () => {
    if (!currentFile) {
      return message.error("你尚未选择文件");
    }
    if (!allowUpload(currentFile)) return;
    setUploadStatus(UploadStatus.UPLOADING);
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

  async function verify(filename: string) {
    return await request({
      url: `/verify/${filename}`,
    });
  }

  const uploadParts = async (partList: Part[], filename: string) => {
    let { needUpload, uploadList } = await verify(filename);
    if (!needUpload) {
      return message.success("秒传成功");
    }
    try {
      let requests = createRequests(partList, filename, uploadList);
      await Promise.all(requests);
      // 上传完成之后进行合并
      await request({ url: `/merge/${filename}` });
      message.success("上传成功");
      reset();
    } catch (error) {
      message.error("上传失败或暂停");
    }
  };

  const createRequests = (
    partList: Part[],
    filename: string,
    uploadList: Uploaded[]
  ) => {
    const needUploadList = partList.filter((part: Part) => {
      let uploadFile = uploadList.find(
        (item) => item.filename === part.chunk_name
      );
      if (!uploadFile) {
        part.loaded = 0; //已经上传的字节数0
        part.percent = 0; //已经上传的百分比就是0 分片的上传过的百分比
        return true;
      }
      if (uploadFile.size < part.chunk.size) {
        part.loaded = uploadFile.size; // 已经上传的字节数
        part.percent = Number(
          ((part.loaded / part.chunk.size) * 100).toFixed(2)
        ); //已经上传的百分比
        return true;
      }
      return false;
    });
    return needUploadList.map((part) =>
      request({
        url: `/upload/${filename}/${part.chunk_name}/${part.loaded}`,
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        data: part.chunk.slice(part.loaded),
        setXHR: (xhr: XMLHttpRequest) => (part.xhr = xhr),
        onProgress: (event: ProgressEvent) => {
          part.percent = Number(
            (((part.loaded! + event.loaded) / part.chunk.size) * 100).toFixed(2)
          );
          console.log("part.percent", part.chunk_name, part.percent);
          setPartList([...partList]);
        },
      })
    );
  };

  async function handlePause() {
    partList.forEach((part: Part) => part.xhr && part.xhr.abort());
    setUploadStatus(UploadStatus.PAUSE);
  }
  async function handleResume() {
    setUploadStatus(UploadStatus.UPLOADING);
    await uploadParts(partList, filename);
  }

  function reset() {
    setUploadStatus(UploadStatus.INIT);
    setHashPercent(0);
    setPartList([]);
    setFilename("");
  }

  const columns = [
    {
      title: "切片名称",
      dataIndex: "filename",
      key: "filename",
      width: "20%",
    },
    {
      title: "进度",
      dataIndex: "percent",
      key: "percent",
      width: "80%",
      render: (value: number) => {
        return <Progress percent={value} />;
      },
    },
  ];
  let totalPercent =
    partList.length > 0
      ? (partList.reduce((acc: number, curr: Part) => acc + curr.percent!, 0) /
          (partList.length * 100)) *
        100
      : 0;
  let uploadProgress = (
    <>
      <Row>
        <Col span={4}>HASH总进度:</Col>
        <Col span={20}>
          <Progress percent={hashPercent} />
        </Col>
      </Row>
      <Row>
        <Col span={4}>总进度:</Col>
        <Col span={20}>
          <Progress percent={totalPercent} />
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={partList}
        rowKey={(row) => row.chunk_name!}
      />
    </>
  );
  return (
    <>
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
          <Button
            type="primary"
            onClick={handlePause}
            style={{ marginLeft: 10 }}
          >
            暂停
          </Button>
          <Button
            type="primary"
            onClick={handleResume}
            style={{ marginLeft: 10 }}
          >
            恢复
          </Button>
        </Col>
        <Col span={12}>
          {objectURL && <img src={objectURL} style={{ width: 100 }} />}
        </Col>
      </Row>

      {uploadProgress}
    </>
  );
}

export default Upload;
