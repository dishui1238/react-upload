import React, { useState, ChangeEvent, useEffect } from "react";
import { Row, Col, Input, Button, message } from "antd";
import { allowUpload, request } from "./utils";

function Upload() {
  const [objectURL, setObjectURL] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<File>();

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
    console.log(file);
    setCurrentFile(file);
  };

  const handleUpload = async () => {
    if (!currentFile) {
      return message.error("你尚未选择文件");
    }
    if (!allowUpload(currentFile)) return;
    const formData = new FormData();
    formData.append("chunk", currentFile);
    formData.append("filename", currentFile.name);

    const result = await request({
      url: "/upload",
      method: "POST",
      data: formData,
    });
    console.log("result", result);
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
