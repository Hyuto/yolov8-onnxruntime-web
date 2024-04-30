import React, { useState, useRef, useEffect, useLayoutEffect  } from "react";
import Player from 'xgplayer';
import FlvPlugin from 'xgplayer-flv';
import cv from "@techstark/opencv-js";
import { Tensor, InferenceSession } from "onnxruntime-web";
import { detectImage } from "./utils/detect";
import "./style/App.css";
import 'xgplayer/dist/index.min.css';
window.cv = cv;
const App = () => {
  const [session, setSession] = useState(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const modelInputShape = [1, 3, 640, 640];
  const topk = 100;
  const iouThreshold = 0.45;
  const scoreThreshold = 0.25;

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  let videoPlay = null;

  let canvasArr = []

  // const [canvasArr, setCanvasArr] = useState([]);
  const [saveImageArr, setSaveImageArr] = useState([]);

  useEffect (() => {
      const initializeOpenCV = async () => {
        await cv.onRuntimeInitialized;
        const yolov8 = await InferenceSession.create("/yolov8-onnxruntime-web/model/yolov8n.onnx");
        const nms = await InferenceSession.create("/yolov8-onnxruntime-web/model/nms-yolov8.onnx");
        const tensor = new Tensor(
          "float32",
          new Float32Array(modelInputShape.reduce((a, b) => a * b)),
          modelInputShape
        );
        await yolov8.run({ images: tensor });
        setSession({ net: yolov8, nms: nms });
      };

      if (!session) {
        initializeOpenCV();
      }
    }, [session]);

  useEffect(() => {
    if (session && !videoLoaded) {
      initVideo();
      setVideoLoaded(true);
    }
  }, [session, videoLoaded]);


  const initVideo = async () => {
    videoPlay = new Player({
      id: 'video-box',
      isLive: true,
      url: 'https://76f14f8552b89647c0363f2fbd465c34.h2.smtcdns.net/pull-flv-l11.douyincdn.com/third/stream-114863454049534428_sd.flv?expire=1712207267&sign=abc078b1b739e3726f911c2b012f9e24&abr_pts=-800&_session_id=037-20240328130747BCB631DDDEB1BE12485F.1711602467812.69583&TxLiveCode=cold_stream&TxDispType=3&svr_type=live_oc&tencent_test_client_ip=58.34.146.82&dispatch_from=OC_MGR115.238.171.166&utime=1711602467811',
      plugins: [FlvPlugin],
      width: 640,
      height: 480,
      playbackRate: [1, 0.5, 0.3, 0.2, 0.1, 0.05],
      // playbackRate: [0.3],
      autoplayMuted: true,
      autoplay: true,
      ignores: ['cssfullscreen'],
    });

    initData();
  };

  const initData = () => {
    // processFrame();
    initProcessFrame()
  };

  //初始化循环方法
  const initProcessFrame = () => {
    const interval = 25 / 1; // 设置每秒 30 帧
    let lastFrameTime = 0;

    const video = videoPlay.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let frameImageList = []
    const process = async (timestamp) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      console.log(canvas.width, canvas.height)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (timestamp - lastFrameTime >= interval) {
        console.log('打印执行:===>')
        // 在指定的时间间隔内执行处理逻辑
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const src = cv.matFromImageData(imageData);
        console.time('程序执行时间');
        const boxes = await detectImage(src, session, topk, iouThreshold, scoreThreshold, modelInputShape);
        console.timeEnd('程序执行时间');
        // const boxes = [];
        
        //没有红色标识框
        if(!boxes.length){
          const dataURL = canvas.toDataURL('image/png');
          if(frameImageList.length >= 100){
            filterNumber(frameImageList)
            frameImageList = [dataURL]
          }else {
            frameImageList.push(dataURL)
          }
          // lastFrameTime = timestamp;
          // requestAnimationFrame(process);
        //有红色框
        }else{
          // console.log(boxes)
          const src1 = cv.matFromImageData(imageData);
          //当识别到红框时
          for(let i=0;i < boxes.length; i++){
            const i_box = boxes[i]["bounding"];
            // 绘制矩形框
            const color = new cv.Scalar(255, 0, 0, 255); // BGR 格式的颜色，这里是红色
            // 获取矩形框的坐标信息
            const x = Math.round(i_box[0]);
            const y = Math.round(i_box[1]);
            const w = Math.round(i_box[2]);
            const h = Math.round(i_box[3]);
            const point1 = new cv.Point(x, y);
            const point2 = new cv.Point(x + w, y + h);
            cv.rectangle(src1, point1, point2, color, 2, cv.LINE_AA, 0);
          }
          // 显示处理后的图像
          cv.imshow(canvas, src1)
          const dataURL = canvas.toDataURL('image/png');
          if(frameImageList.length >= 100){
            filterNumber(frameImageList)
            frameImageList = [dataURL]
          }else {
            frameImageList.push(dataURL)
          }
          src1.delete()
          // lastFrameTime = timestamp;
          // requestAnimationFrame(process);
        }
        lastFrameTime = timestamp;
      }
      requestAnimationFrame(process);
    }
    requestAnimationFrame(process);
  }

  const filterNumber = (list) => {
    const len = list.length;
    if ( len >= 100 ) {
      saveImageArr.push(list.pop());
      setSaveImageArr([...saveImageArr]);
    }
  };

 

  return (
    <div className='home-container'>
      <div className='wrap'>
        <div id='video-box' ref={videoRef}></div>
        <div className='canvas-box'>
          <canvas ref={canvasRef} width='640' height='480'></canvas>
        </div>
      </div>
      <div className='wrap'>
        {saveImageArr.map((item, index) => (
          <img className='item-img' key={index} src={item} alt='' />
        ))}
      </div>
    </div>
  );
};

export default App;
