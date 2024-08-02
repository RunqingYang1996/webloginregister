import './App.css';

import { useEffect, useState, useRef } from 'react';
import { FaceLandmarker, 
          FaceLandmarkerOptions, 
          FilesetResolver,
          Landmark,
          PoseLandmarker,
          PoseLandmarkerOptions,
          HandLandmarker,
          HandLandmarkerOptions
        } from "@mediapipe/tasks-vision";
import { Color, Euler, Matrix4, Vector2, Vector3} from 'three';
import { Canvas, useFrame, useGraph } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { useDropzone } from 'react-dropzone';

let video: HTMLVideoElement;
let faceLandmarker: FaceLandmarker;
let poseLandmarker: PoseLandmarker;
let handLandmarker: HandLandmarker;
let lastVideoTime = -1;
let blendshapes: any[] = [];
let rotation: Euler;
let testangle: Number;
///////////////////////////////////
let leftshoulderposition: Vector3;
let leftshoulderrotation: Vector3= new Vector3();
let rightshoulderposition: Vector3;
let rightshoulderrotation: Vector3= new Vector3();
let leftarmposition: Vector3;
let leftarmrotation: Vector3= new Vector3();
let rightarmposition: Vector3;
let rightarmrotation: Vector3= new Vector3();
let lefthandposition: Vector3;
let lefthandrotation: Vector3= new Vector3();
//let righthandposition: Vector3= new Vector3();
let righthandrotation: Vector3= new Vector3()
///////////////////////////////
let headMesh: any[] = [];

const options: FaceLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    delegate: "GPU"
  },
  numFaces: 1,
  runningMode: "VIDEO",
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: true,
};

const poseoptions: PoseLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  numPoses: 2,
};

const handoptions: HandLandmarkerOptions = {
  baseOptions: {
    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
    delegate: "GPU"
  },
  runningMode: "VIDEO",
  numHands: 2,
};

function calculateVector(p1:Landmark, p2:Landmark) {
  return {
      x: p2.x - p1.x,
      y: p2.y - p1.y,
      z: p2.z - p1.z
  };
}

function dotProduct(v1:Landmark, v2:Landmark) {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function calculateCrossProductZComponent(vectorA:Vector3, vectorB:Vector3) {
  // 计算叉乘向量
  const crossProduct = new Vector3();
  crossProduct.crossVectors(vectorA, vectorB);

  // 返回z方向的分量
  return crossProduct.z;
}

function vectorMagnitude(v:Landmark) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function angleBetween3DCoords(p1:Landmark, p2:Landmark, p3:Landmark) {
  const v1 = calculateVector(p1, p2);
  const v2 = calculateVector(p2, p3);

  const dotProd = dotProduct(v1, v2);
  const magnitudes = vectorMagnitude(v1) * vectorMagnitude(v2);

  const angleRad = Math.acos(dotProd / magnitudes);
  const angleDeg = angleRad * (180 / Math.PI);

  return angleDeg;
}

function angleBetween2DCoords(p1:Landmark, p2:Landmark, p3:Landmark, plane:string) {
  let v1:any, v2:any;

  if (plane === "xy") {
      v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  } else if (plane === "yz") {
      v1 = { y: p2.y - p1.y, z: p2.z - p1.z };
      v2 = { y: p3.y - p2.y, z: p3.z - p2.z };
  } else if (plane === "zx") {
      v1 = { z: p2.z - p1.z, x: p2.x - p1.x };
      v2 = { z: p3.z - p2.z, x: p3.x - p2.x };
  }

  const dotProd = v1.x * v2.x + v1.y * v2.y + (v1.z || 0) * (v2.z || 0);
  const magnitude1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + (v1.z || 0) * (v1.z || 0));
  const magnitude2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + (v2.z || 0) * (v2.z || 0));

  const angleRad = Math.acos(dotProd / (magnitude1 * magnitude2));
  const angleDeg = angleRad * (180 / Math.PI);

  return angleDeg;
}
function mapRange(input:any, inputMin:any, inputMax:any, outputMin:any, outputMax:any) {
  // 线性映射公式
  const output = ((input - inputMin) / (inputMax - inputMin)) * (outputMax - outputMin) + outputMin;

  return output;
}
function calculateDirectionVector(point1: Landmark, point2: Landmark) {
  return new Vector3(point2.x - point1.x, point2.y - point1.y, point2.z - point1.z);
}
function fromToRotation(vectorA: Vector3, vectorB: Vector3) {
  const axis = new Vector3().crossVectors(vectorA, vectorB).normalize();
  const angle = Math.acos(vectorA.dot(vectorB) / (vectorA.length() * vectorB.length()));
  const quaternion = new Euler().setFromRotationMatrix(new Matrix4().makeRotationAxis(axis, angle));
  return quaternion;
}
function directionVectorToEuler(vector: Vector3) {
  const up = new Vector3(0, 1, 0);
  const rotationMatrix = new Matrix4().lookAt(new Vector3(0, 0, 0), vector, up);
  const rotation = new Euler().setFromRotationMatrix(rotationMatrix);
  return rotation;
}
function interpolateRotation(preRotation:any, curRotation:any, alpha:any) {
  return alpha * curRotation + (1 - alpha) * preRotation;
}
/////handusefunction///
function mapToTarget(inputValue:any, targetValue = 90, outputValue = 0.9, width = 10) {
  // 使用高斯分布公式进行映射
  const gaussian = Math.exp(-Math.pow(inputValue - targetValue, 2) / (2 * Math.pow(width, 2)));
  return outputValue * gaussian;
}
function calculateAngleBetweenVectors(vectorA: Vector3, vectorB: Vector3) {
  // 提取向量在xy平面的分量
  const Ax = vectorA.x, Ay = vectorA.y;
  const Bx = vectorB.x, By = vectorB.y;

  // 计算点积
  const dotProduct = Ax * Bx + Ay * By;

  // 计算向量的模长
  const magnitudeA = Math.sqrt(Ax * Ax + Ay * Ay);
  const magnitudeB = Math.sqrt(Bx * Bx + By * By);

  // 计算夹角的余弦值
  const cosTheta = dotProduct / (magnitudeA * magnitudeB);

  // 计算夹角（弧度）
  const angleRadians = Math.acos(cosTheta);

  // 转换弧度到角度（可选）
  const angleDegrees = angleRadians * (180 / Math.PI);

  return {
      radians: angleRadians,
      degrees: angleDegrees
  };
}

///////////
function Avatar({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { nodes } = useGraph(scene);
  const rightShoulderRef = useRef<HTMLDivElement>(null);
  console.log(nodes)

  useEffect(() => {
    if (nodes.Wolf3D_Head) headMesh.push(nodes.Wolf3D_Head);
    if (nodes.Wolf3D_Teeth) headMesh.push(nodes.Wolf3D_Teeth);
    if (nodes.Wolf3D_Beard) headMesh.push(nodes.Wolf3D_Beard);
    if (nodes.Wolf3D_Avatar) headMesh.push(nodes.Wolf3D_Avatar);
    if (nodes.Wolf3D_Head_Custom) headMesh.push(nodes.Wolf3D_Head_Custom);
  }, [nodes, url]);

  useFrame(() => {
    if (blendshapes.length > 0) {
      blendshapes.forEach(element => {
        headMesh.forEach(mesh => {
          let index = mesh.morphTargetDictionary[element.categoryName];
          if (index >= 0) {
            mesh.morphTargetInfluences[index] = element.score;
          }
        });
      });

      nodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
      nodes.Neck.rotation.set(rotation.x / 3 + 0.3, rotation.y / 3, rotation.z / 3);
      nodes.Spine1.rotation.set(rotation.x / 3, rotation.y / 3, rotation.z / 3);
      //nodes.LeftArm.rotation.set(rotation.x/0.7, rotation.x/0.7, rotation.z/2);
      //nodes.LeftArm.rotation.set(leftshoulderrotation.x/1, leftshoulderrotation.y/1, leftshoulderrotation.z/1);
      //nodes.RightArm.rotation.set(rightshoulderrotation.x/200+0.5, rightshoulderrotation.y/200+1.0, rightshoulderrotation.z/200-1.0);
      //nodes.LeftForeArm.rotation.set(leftarmrotation.x/100, leftarmrotation.y/100, -leftarmrotation.z/100+3.14/2);
      //nodes.RightForeArm.rotation.set(rightarmrotation.x, -rightarmrotation.y, -rightarmrotation.z);
      //nodes.RightForeArm.rotation.set(rightarmrotation.x/200-1.5, rightarmrotation.y/200+0.9, rightarmrotation.z/200-2.5);
      //nodes.LeftHand.rotation.set(lefthandrotation.x/1000, lefthandrotation.y/1000, lefthandrotation.z/1000);
      //nodes.RightHand.rotation.set(righthandrotation.x/3, righthandrotation.y/3, righthandrotation.z/3);
      //nodes.RightHand.position.set(righthandposition.x/2, righthandposition.y/2, righthandposition.z/2);



      ///////////////////////////
      const modelLeftShoulder = nodes.LeftShoulder.position;
      const modelRightShoulder = nodes.RightShoulder.position;
      const modelLeftElbow = nodes.LeftForeArm.position;
      const modelRightElbow = nodes.RightForeArm.position;
      const modelLeftWrist = nodes.LeftHand.position;
      const modelRightWrist = nodes.RightHand.position;

      const modelLeftUpperArm = calculateDirectionVector(modelLeftShoulder, modelLeftElbow);
      const modelRightUpperArm = calculateDirectionVector(modelRightShoulder, modelRightElbow);
      const modelLeftForeArm = calculateDirectionVector(modelLeftElbow, modelLeftWrist);
      const modelRightForeArm = calculateDirectionVector(modelRightElbow, modelRightWrist);

      // 计算从模型向量到 MediaPipe 向量的旋转
      const leftShoulderRotation1 = fromToRotation(modelLeftUpperArm, leftshoulderrotation);
      const rightShoulderRotation1 = fromToRotation(modelRightUpperArm, rightshoulderrotation);
      const leftArmRotation1 = fromToRotation(modelLeftForeArm, leftarmrotation);
      const rightArmRotation1 = fromToRotation(modelRightForeArm, rightarmrotation);
      const leftHandRotation1 = fromToRotation(modelLeftForeArm, lefthandrotation);
      const rightHandRotation1 = fromToRotation(modelRightForeArm, righthandrotation);
      //nodes.LeftArm.rotation.set(leftShoulderRotation1.x/100, leftShoulderRotation1.y/100, leftShoulderRotation1.z/100+3.14/2);
      //nodes.LeftForeArm.rotation.set(-leftArmRotation1.x/1, leftArmRotation1.y/1, leftArmRotation1.z);
      //nodes.RightArm.rotation.set(rightShoulderRotation1.x/100, rightShoulderRotation1.y/100, rightShoulderRotation1.z/100-3.14/2);
      //####nodes.RightForeArm.rotation.set(3.14/200,3.14/200,-3.14/2-0.7);
      const pre1=nodes.LeftArm.rotation.x;
      const cur1=(rightshoulderrotation.y-15)/155*Math.PI-Math.PI/2-0.1;
      const alpha1=0.2;
      
      nodes.LeftArm.rotation.set(interpolateRotation(pre1, cur1, alpha1), 0.0, 0);
      ////
      //nodes.RightForeArm.rotation.set(3.14/200,3.14/200,-rightshoulderrotation.z/(180 / Math.PI));
      const pre2=nodes.LeftForeArm.rotation.y;
      const cur2=0;//-0.9*mapToTarget(rightshoulderrotation.x);
      const alpha2=1/(Math.abs(pre2-cur2)+5);
      const pre3=nodes.LeftForeArm.rotation.x;
      const cur3=0;//-0.5+(leftshoulderrotation.z+1.75)/0.9*0.5;
      const alpha3=1/(Math.abs(pre3-cur3)+5);
      const pre4=nodes.LeftForeArm.rotation.x;
      const cur4=mapRange(rightshoulderrotation.z, -60, 30, 0, -Math.PI/2);
      const alpha4=1/(Math.abs(pre4-cur4)+2);
      //const alpha2=0.2;
      if (Math.abs(pre1-cur1)<90){
        const value= rightshoulderrotation.z
        if (Math.abs(value)<100){
          nodes.LeftForeArm.rotation.set(interpolateRotation(pre4, cur4, alpha4),-0.9,3.14/2+0.4);
        }
      }
      //////////////////////////////////////////
      nodes.LeftHand.rotation.set(-0.000,0.8*mapToTarget(rightshoulderrotation.x),0);
      //nodes.RightHand.rotation.set(-0.000,-1.9,-1.7);
      if (rightShoulderRef.current) {
        rightShoulderRef.current.innerHTML = `Right Shoulder Rotation: x: ${rightshoulderrotation.x.toFixed(2)}, y: ${rightshoulderrotation.y.toFixed(2)}, z: ${rightshoulderrotation.z.toFixed(2)}`;
      }
    }
  });

  return (
    <>
      <primitive object={scene} position={[0, -1.75, 3]} />
      <Html>
      <div ref={rightShoulderRef} style={{ color: 'white', backgroundColor: 'black', padding: '5px', borderRadius: '5px', transform: 'translateX(-180px)' }} >
        Right Shoulder Rotation: x: 0, y: 0, z: 0
      </div>
    </Html>
    </>
  );
}

/*

  return (
    <>
      <primitive object={scene} position={[0, -1.75, 3]} />
    </>
  );
}
*/
function App() {
  const [url, setUrl] = useState<string>("https://models.readyplayer.me/667f09dba357b441c2124ac4.glb?morphTargets=ARKit&textureAtlas=1024");
  const { getRootProps } = useDropzone({
    onDrop: files => {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setUrl(reader.result as string);
      }
      reader.readAsDataURL(file);
    }
  });

  const setup = async () => {
    const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, options);
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, poseoptions);     //xinjiade
    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, handoptions); 
    video = document.getElementById("video") as HTMLVideoElement;
    navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: false,
    }).then(function (stream) {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predict);
    });
  }

  const predict = async () => {
    let nowInMs = Date.now();
    if (lastVideoTime !== video.currentTime) {
      lastVideoTime = video.currentTime;
      const faceLandmarkerResult = faceLandmarker.detectForVideo(video, nowInMs);
      const poseLandmarkerResult = poseLandmarker.detectForVideo(video, nowInMs);//xinjiade
      const handLandmarkerResult = handLandmarker.detectForVideo(video, nowInMs);
      //console.log(poseLandmarkerResult)
      console.log(handLandmarkerResult)
      if (faceLandmarkerResult.faceBlendshapes && faceLandmarkerResult.faceBlendshapes.length > 0 && faceLandmarkerResult.faceBlendshapes[0].categories) {
        blendshapes = faceLandmarkerResult.faceBlendshapes[0].categories;

        const matrix = new Matrix4().fromArray(faceLandmarkerResult.facialTransformationMatrixes![0].data);
        rotation = new Euler().setFromRotationMatrix(matrix);
      }
      if (poseLandmarkerResult.landmarks && poseLandmarkerResult.landmarks.length> 0 ) {

        const leftshoulder = poseLandmarkerResult.landmarks[0][11];
        const rightshoulder = poseLandmarkerResult.landmarks[0][12];
        const leftelbow = poseLandmarkerResult.landmarks[0][13];
        const rightelbow = poseLandmarkerResult.landmarks[0][14];
        const leftwrist = poseLandmarkerResult.landmarks[0][15];
        const rightwrist = poseLandmarkerResult.landmarks[0][16];
        const leftyao=poseLandmarkerResult.landmarks[0][23]
        const leftwrist_world = poseLandmarkerResult.worldLandmarks[0][15];

        leftshoulderrotation =(calculateDirectionVector(leftshoulder, leftelbow));
        rightshoulderrotation = (calculateDirectionVector(rightshoulder, rightelbow));
        leftarmrotation = (calculateDirectionVector(leftelbow, leftwrist));
        rightarmrotation = (calculateDirectionVector(rightelbow, rightwrist));
        lefthandrotation = (calculateDirectionVector(leftwrist, leftelbow));
        righthandrotation = (calculateDirectionVector(rightwrist, rightelbow));
        ///
        const shouldertoshouder=(calculateDirectionVector(rightshoulder, leftshoulder));
        const left_forearm_vector = (calculateDirectionVector(leftelbow, leftwrist));
        const left_arm_vector = (calculateDirectionVector(leftshoulder, leftelbow));
        const L_forearmangle= calculateAngleBetweenVectors(shouldertoshouder,left_forearm_vector);
        ////

        const angle3D = angleBetween3DCoords(leftyao, leftshoulder, leftelbow);
        const angle30 = angleBetween3DCoords(leftshoulder, leftelbow, leftwrist);
        const angleXY = angleBetween2DCoords(leftyao, leftshoulder, leftelbow, "xy");
        const angleYZ30 = angleBetween2DCoords(leftshoulder, leftelbow,leftwrist, "xy");
  
        // if (leftwrist.y<100.8){
        // rightshoulderrotation.x=L_forearmangle.degrees;
        // leftshoulderrotation.z=leftwrist.z;
        // }
        // else{
        //   rightshoulderrotation.x=0;
        //   leftshoulderrotation.z=-1.75;
        // }
        const wavehand_sign=calculateCrossProductZComponent(left_arm_vector,left_forearm_vector)/Math.abs(calculateCrossProductZComponent(left_arm_vector,left_forearm_vector));
        rightshoulderrotation.y=angleXY;
        if (angleYZ30>50){
          rightshoulderrotation.z=(170-angleYZ30)*wavehand_sign;
        }
        //rightshoulderrotation.x=calculateCrossProductZComponent(left_arm_vector,left_forearm_vector)
        // rightshoulderrotation.x=leftwrist.x;
        // rightshoulderrotation.y=leftwrist.y;
        // rightshoulderrotation.z=leftwrist.z;

        

        
      }
    }

    window.requestAnimationFrame(predict);
  }

  const handleOnChange = (event: any) => {
    setUrl(`${event.target.value}?morphTargets=ARKit&textureAtlas=1024`);
  }

  useEffect(() => {
    setup();
  }, []);

  return (
    <div className="App">
      <div {...getRootProps({ className: 'dropzone' })}>
        <p>Drag & drop RPM avatar GLB file here</p>
      </div>
      <input className='url' type="text" placeholder="Paste RPM avatar URL" onChange={handleOnChange} />
      <video className='camera-feed' id="video" autoPlay></video>
      <Canvas style={{ height: 600 }} camera={{ fov: 55 }} shadows>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} color={new Color(1, 1, 0)} intensity={0.5} castShadow />
        <pointLight position={[-10, 0, 10]} color={new Color(1, 0, 0)} intensity={0.5} castShadow />
        <pointLight position={[0, 0, 10]} intensity={0.5} castShadow />
        <Avatar url={url} />
      </Canvas>
      <img className='logo' src="./logo.png" />
    </div>
  );
}

export default App;
