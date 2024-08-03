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
let righthandnumber:any;
let lefthandnumber:any;
let rightshoulderrotation: Vector3= new Vector3();
/////////////renew//////////////////////
let leftshoulder_updown:any=0;
let leftforearm_LR:Vector3= new Vector3();
let rightshoulder_updown:any=0;
let rightforearm_LR:Vector3= new Vector3();
///////////////////////
//let leftshoulderrotation: Vector3= new Vector3();
let leftforearmrotation_idle: Vector3= new Vector3();
let lefthandrotation: Vector3= new Vector3();
let lefthandtwist: Vector3= new Vector3();
let rightforearmrotation_idle: Vector3= new Vector3();
let righthandrotation: Vector3= new Vector3();
let righthandtwist: Vector3= new Vector3();
///////////////////////////////

///////lefthand///////////
let left_index_finger_rotation: Vector3= new Vector3()
let left_middle_finger_rotation: Vector3= new Vector3()
let left_ring_finger_rotation: Vector3= new Vector3()
let left_pinky_finger_rotation: Vector3= new Vector3()
let left_thumb_finger_rotation: Vector3= new Vector3()
///////////////////////

///////righthand///////////
let right_index_finger_rotation: Vector3= new Vector3()
let right_middle_finger_rotation: Vector3= new Vector3()
let right_ring_finger_rotation: Vector3= new Vector3()
let right_pinky_finger_rotation: Vector3= new Vector3()
let right_thumb_finger_rotation: Vector3= new Vector3()
///////////////////////////
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

function vector3Magnitude(v:Vector3) {
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
      /* =====================
        = Section: head+body(fixed)    =
        ===================== */
      nodes.Head.rotation.set(rotation.x, rotation.y, rotation.z);
      nodes.Neck.rotation.set(rotation.x / 3 + 0.3, rotation.y / 3, rotation.z / 3);
      nodes.Spine1.rotation.set(rotation.x / 3, rotation.y / 3, rotation.z / 3);




      ///////////////////////////

      /* =====================
        = Section: left_part_of_half_body    =
        ===================== */
      /////////Leftarm_Up_and_down////////////////
      const pre1=nodes.LeftArm.rotation.x;
      const cur1=(leftshoulder_updown-15)/155*Math.PI-Math.PI/2-0.1;
      const alpha1=0.2;
      
      nodes.LeftArm.rotation.set(interpolateRotation(pre1, cur1, alpha1), 0, 0.3);
      /////////Rightarm_Up_and_down////////////////
      const pre1R=nodes.RightArm.rotation.x;
      const cur1R=(rightshoulder_updown-15)/155*Math.PI-Math.PI/2-0.1;
      const alpha1R=0.2;
      
      nodes.RightArm.rotation.set(interpolateRotation(pre1R, cur1R, alpha1R), 0, -0.3);
      ///////////////////////////////////////////////
      /////////Leftforearm_waving////////////////
      const pre4=nodes.LeftForeArm.rotation.x;
      const cur4=mapRange(leftforearm_LR.x, 8, -8, -Math.PI/4, Math.PI/4);
      const alpha4=1/(Math.abs(pre4-cur4)+2);

      nodes.LeftForeArm.rotation.set(interpolateRotation(pre4, cur4, alpha4),0,2.4*leftforearmrotation_idle.z);
      /////////Rightforearm_waving////////////////
      const pre4R=nodes.RightForeArm.rotation.x;
      const cur4R=mapRange(rightforearm_LR.x, -8, 8, -Math.PI/4, Math.PI/4);
      const alpha4R=1/(Math.abs(pre4R-cur4R)+2);

      nodes.RightForeArm.rotation.set(interpolateRotation(pre4R, cur4R, alpha4R),0,-2.4*rightforearmrotation_idle.z);

      //////////////////////////////////////////
      ///lefthandrotate_and_twist///////
      ///leftpalmoperation////
      const pre5=nodes.LeftHand.rotation.y;
      const cur5=mapRange(lefthandrotation.z, -0.4, 0.4, -1.9, 1.9);
      const alpha5=1/(Math.abs(pre5-cur5)+2);
      /////
      const pre6=nodes.LeftHand.rotation.x;
      const cur6=mapRange(lefthandtwist.x, -3, 3, -0.9, 0.9);
      const alpha6=1/(Math.abs(pre6-cur6)+2);
      nodes.LeftHand.rotation.set(interpolateRotation(pre6, cur6, alpha6),interpolateRotation(pre5, cur5, alpha5),0);//zhengfu1.2
      //////////////////////////
      //////////////////////////////////////////
      ///righthandrotate_and_twist///////
      ///rightpalmoperation////
      const pre5R = nodes.RightHand.rotation.y;
      const cur5R = mapRange(righthandrotation.z, -0.4, 0.4, -1.9, 1.2);
      const alpha5R = 1 / (Math.abs(pre5R - cur5R) + 2);
      /////
      const pre6R = nodes.RightHand.rotation.x;
      const cur6R = mapRange(righthandtwist.x, 3, -3, -0.9, 0.9);
      const alpha6R = 1 / (Math.abs(pre6R - cur6R) + 2);
      nodes.RightHand.rotation.set(-interpolateRotation(pre6R, cur6R, alpha6R), interpolateRotation(pre5R, cur5R, alpha5R) , 0); //zhengfu1.2
//////////////////////////


      ////////lefthand////////////
      ///indexfinger////
      nodes.LeftHandIndex1.rotation.set(left_index_finger_rotation.x*3.14/180,0,0);
      nodes.LeftHandIndex2.rotation.set(left_index_finger_rotation.y*3.14/180,0,0);
      nodes.LeftHandIndex3.rotation.set(left_index_finger_rotation.z*3.14/180,0,0);
      ///middlefinger////
      nodes.LeftHandMiddle1.rotation.set(left_middle_finger_rotation.x*3.14/180,0,0);
      nodes.LeftHandMiddle2.rotation.set(left_middle_finger_rotation.y*3.14/180,0,0);
      nodes.LeftHandMiddle3.rotation.set(left_middle_finger_rotation.z*3.14/180,0,0);
      ////ringfinger/////
      nodes.LeftHandRing1.rotation.set(left_ring_finger_rotation.x*3.14/180,0,0);
      nodes.LeftHandRing2.rotation.set(left_ring_finger_rotation.y*3.14/180,0,0);
      nodes.LeftHandRing3.rotation.set(left_ring_finger_rotation.z*3.14/180,0,0);
      ///pinkyfinger////
      nodes.LeftHandPinky1.rotation.set(left_pinky_finger_rotation.x*3.14/180,0,0);
      nodes.LeftHandPinky2.rotation.set(left_pinky_finger_rotation.y*3.14/180,0,0);
      nodes.LeftHandPinky3.rotation.set(left_pinky_finger_rotation.z*3.14/180,0,0);
      ///thumbfinger////
      nodes.LeftHandThumb1.rotation.set(0.3,0.3,0.3);
      nodes.LeftHandThumb2.rotation.set(0,0,-left_thumb_finger_rotation.y*3.14/180);
      nodes.LeftHandThumb3.rotation.set(0,0,-left_thumb_finger_rotation.z*3.14/180);
      //nodes.RightHand.rotation.set(-0.000,-1.9,-1.7);


      ////////righthand////////////
      ///indexfinger////
      nodes.RightHandIndex1.rotation.set(right_index_finger_rotation.x*3.14/180,0,0);
      nodes.RightHandIndex2.rotation.set(right_index_finger_rotation.y*3.14/180,0,0);
      nodes.RightHandIndex3.rotation.set(right_index_finger_rotation.z*3.14/180,0,0);
      ///middlefinger////
      nodes.RightHandMiddle1.rotation.set(right_middle_finger_rotation.x*3.14/180,0,0);
      nodes.RightHandMiddle2.rotation.set(right_middle_finger_rotation.y*3.14/180,0,0);
      nodes.RightHandMiddle3.rotation.set(right_middle_finger_rotation.z*3.14/180,0,0);
      ////ringfinger/////
      nodes.RightHandRing1.rotation.set(right_ring_finger_rotation.x*3.14/180,0,0);
      nodes.RightHandRing2.rotation.set(right_ring_finger_rotation.y*3.14/180,0,0);
      nodes.RightHandRing3.rotation.set(right_ring_finger_rotation.z*3.14/180,0,0);
      ///pinkyfinger////
      nodes.RightHandPinky1.rotation.set(right_pinky_finger_rotation.x*3.14/180,0,0);
      nodes.RightHandPinky2.rotation.set(right_pinky_finger_rotation.y*3.14/180,0,0);
      nodes.RightHandPinky3.rotation.set(right_pinky_finger_rotation.z*3.14/180,0,0);
      ///thumbfinger////
      nodes.RightHandThumb1.rotation.set(0.3,-0.3,-0.3);
      nodes.RightHandThumb2.rotation.set(0,0,right_thumb_finger_rotation.y*3.14/180);
      nodes.RightHandThumb3.rotation.set(0,0,right_thumb_finger_rotation.z*3.14/180);

      if (rightShoulderRef.current) {
        rightShoulderRef.current.innerHTML = `Right Shoulder Rotation: x: ${rightshoulderrotation.x.toFixed(2)}, y: ${rightshoulderrotation.y.toFixed(2)}, z: ${rightshoulderrotation.z.toFixed(2)}`;
      }
    }
  });

  return (
    <>
      <primitive object={scene} position={[0, -1.75, 3]} />
      <Html>
      <div ref={rightShoulderRef} style={{ color: 'white', backgroundColor: 'black', padding: '5px', borderRadius: '5px', transform: 'translateX(180px)' }} >
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
      //console.log(handLandmarkerResult)
      if (faceLandmarkerResult.faceBlendshapes && faceLandmarkerResult.faceBlendshapes.length > 0 && faceLandmarkerResult.faceBlendshapes[0].categories) {
        blendshapes = faceLandmarkerResult.faceBlendshapes[0].categories;

        const matrix = new Matrix4().fromArray(faceLandmarkerResult.facialTransformationMatrixes![0].data);
        rotation = new Euler().setFromRotationMatrix(matrix);
      }
      if (poseLandmarkerResult.landmarks && poseLandmarkerResult.landmarks.length> 0 ) {
        /* =====================
        = Section: left arm fore—arm   =
        ===================== */

        const leftshoulder = poseLandmarkerResult.landmarks[0][11];
        const leftelbow = poseLandmarkerResult.landmarks[0][13];
        const leftwrist = poseLandmarkerResult.landmarks[0][15];
        const leftyao=poseLandmarkerResult.landmarks[0][23]
        ///
        //rightshoulderrotation = (calculateDirectionVector(rightshoulder, rightelbow));
        ///
        const left_forearm_vector = (calculateDirectionVector(leftelbow, leftwrist));
        const left_arm_vector = (calculateDirectionVector(leftshoulder, leftelbow));
        ////

        const leftshoulder_up_down_angleXY = angleBetween2DCoords(leftyao, leftshoulder, leftelbow, "xy");
        leftshoulder_updown=leftshoulder_up_down_angleXY;
        ////
        const leftforearm_LR1=calculateCrossProductZComponent(left_arm_vector,left_forearm_vector);
        rightshoulderrotation.x=leftforearm_LR1*100;
        leftforearm_LR.x=leftforearm_LR1*100;
        ///////////////////
        /* =====================
        = Section: right arm fore—arm   =
        ===================== */
        const rightshoulder = poseLandmarkerResult.landmarks[0][12];
        const rightelbow = poseLandmarkerResult.landmarks[0][14];
        const rightwrist = poseLandmarkerResult.landmarks[0][16];
        const rightyao=poseLandmarkerResult.landmarks[0][24]
        ///
        //rightshoulderrotation = (calculateDirectionVector(rightshoulder, rightelbow));
        ///
        const right_forearm_vector = (calculateDirectionVector(rightelbow, rightwrist));
        const right_arm_vector = (calculateDirectionVector(rightshoulder, rightelbow));
        ////

        const rightshoulder_up_down_angleXY = angleBetween2DCoords(rightyao, rightshoulder, rightelbow, "xy");
        rightshoulder_updown=rightshoulder_up_down_angleXY;
        ////
        const rightforearm_LR1=calculateCrossProductZComponent(right_arm_vector,right_forearm_vector);
        rightshoulderrotation.x=rightforearm_LR1*100;
        rightforearm_LR.x=rightforearm_LR1*100;

        //rightshoulderrotation.x=calculateCrossProductZComponent(left_arm_vector,left_forearm_vector)
        // rightshoulderrotation.x=leftwrist.x;
        // rightshoulderrotation.y=leftwrist.y;
        // rightshoulderrotation.z=leftwrist.z;


        ////////lefthand___righthand//////////
        leftforearmrotation_idle.z=0; //assume no hand deteted on screen, then forearmneeds to be idle position
        rightforearmrotation_idle.z=0;//assume no hand deteted on screen, then forearmneeds to be idle position
        if (handLandmarkerResult.landmarks && handLandmarkerResult.landmarks.length> 0 ) {
          righthandnumber=-1;
          lefthandnumber=-1;
          if (handLandmarkerResult.handednesses[0][0].categoryName==='Left'){
            righthandnumber=0;//this is true since google mixup the left and right
            console.log(righthandnumber);
          }
          else{
            lefthandnumber=0;
          }
          if (handLandmarkerResult.landmarks.length> 1 ) {
            if (handLandmarkerResult.handednesses[1][0].categoryName==='Left'){
              righthandnumber=1;//this is true since google mixup the left and right
            }
            else{
              lefthandnumber=1;
            }
          }
          if (lefthandnumber!==-1){
            leftforearmrotation_idle.z=1;
            const lefthandroot=handLandmarkerResult.landmarks[lefthandnumber][0];
            ////index_finger///////////////////////////
            const index_finger_position1=handLandmarkerResult.landmarks[lefthandnumber][5];
            const index_finger_position2=handLandmarkerResult.landmarks[lefthandnumber][6];
            const index_finger_position3=handLandmarkerResult.landmarks[lefthandnumber][7];
            const index_finger_position4=handLandmarkerResult.landmarks[lefthandnumber][8];
            const indexfinger_3d_roation0 = angleBetween3DCoords(lefthandroot, index_finger_position1, index_finger_position2);
            const indexfinger_3d_roation1 = angleBetween3DCoords(index_finger_position1, index_finger_position2, index_finger_position3);
            const indexfinger_3d_roation2 = angleBetween3DCoords(index_finger_position2, index_finger_position3, index_finger_position4);
            left_index_finger_rotation.x=indexfinger_3d_roation0 ;
            left_index_finger_rotation.y=indexfinger_3d_roation1 ;
            left_index_finger_rotation.z=indexfinger_3d_roation2 ;
            ////middle_finger///////////////////////////
            const middle_finger_position1=handLandmarkerResult.landmarks[lefthandnumber][9];
            const middle_finger_position2=handLandmarkerResult.landmarks[lefthandnumber][10];
            const middle_finger_position3=handLandmarkerResult.landmarks[lefthandnumber][11];
            const middle_finger_position4=handLandmarkerResult.landmarks[lefthandnumber][12];
            const middlefinger_3d_roation0 = angleBetween3DCoords(lefthandroot, middle_finger_position1, middle_finger_position2);
            const middlefinger_3d_roation1 = angleBetween3DCoords(middle_finger_position1, middle_finger_position2, middle_finger_position3);
            const middlefinger_3d_roation2 = angleBetween3DCoords(middle_finger_position2, middle_finger_position3, middle_finger_position4);
            left_middle_finger_rotation.x=middlefinger_3d_roation0 ;
            left_middle_finger_rotation.y=middlefinger_3d_roation1 ;
            left_middle_finger_rotation.z=middlefinger_3d_roation2 ;
            ////ring_finger///////////////////////////
            const ring_finger_position1=handLandmarkerResult.landmarks[lefthandnumber][13];
            const ring_finger_position2=handLandmarkerResult.landmarks[lefthandnumber][14];
            const ring_finger_position3=handLandmarkerResult.landmarks[lefthandnumber][15];
            const ring_finger_position4=handLandmarkerResult.landmarks[lefthandnumber][16];
            const ringfinger_3d_roation0 = angleBetween3DCoords(lefthandroot, ring_finger_position1, ring_finger_position2);
            const ringfinger_3d_roation1 = angleBetween3DCoords(ring_finger_position1, ring_finger_position2, ring_finger_position3);
            const ringfinger_3d_roation2 = angleBetween3DCoords(ring_finger_position2, ring_finger_position3, ring_finger_position4);
            left_ring_finger_rotation.x=ringfinger_3d_roation0 ;
            left_ring_finger_rotation.y=ringfinger_3d_roation1 ;
            left_ring_finger_rotation.z=ringfinger_3d_roation2 ;

            ////pinky_finger///////////////////////////
            const pinky_finger_position1=handLandmarkerResult.landmarks[lefthandnumber][17];
            const pinky_finger_position2=handLandmarkerResult.landmarks[lefthandnumber][18];
            const pinky_finger_position3=handLandmarkerResult.landmarks[lefthandnumber][19];
            const pinky_finger_position4=handLandmarkerResult.landmarks[lefthandnumber][20];
            const pinkyfinger_3d_roation0 = angleBetween3DCoords(lefthandroot, pinky_finger_position1, pinky_finger_position2);
            const pinkyfinger_3d_roation1 = angleBetween3DCoords(pinky_finger_position1, pinky_finger_position2, pinky_finger_position3);
            const pinkyfinger_3d_roation2 = angleBetween3DCoords(pinky_finger_position2, pinky_finger_position3, pinky_finger_position4);
            left_pinky_finger_rotation.x=pinkyfinger_3d_roation0 ;
            left_pinky_finger_rotation.y=pinkyfinger_3d_roation1 ;
            left_pinky_finger_rotation.z=pinkyfinger_3d_roation2 ;

            ////pinky_finger///////////////////////////
            const thumb_finger_position1=handLandmarkerResult.landmarks[lefthandnumber][1];
            const thumb_finger_position2=handLandmarkerResult.landmarks[lefthandnumber][2];
            const thumb_finger_position3=handLandmarkerResult.landmarks[lefthandnumber][3];
            const thumb_finger_position4=handLandmarkerResult.landmarks[lefthandnumber][4];
            //const thumbfinger_3d_roation0 = angleBetween3DCoords();
            const thumbfinger_3d_roation1 = angleBetween3DCoords(thumb_finger_position1, thumb_finger_position2, thumb_finger_position3);
            const thumbfinger_3d_roation2 = angleBetween3DCoords(thumb_finger_position2, thumb_finger_position3, thumb_finger_position4);
            left_thumb_finger_rotation.x=0 ;
            left_thumb_finger_rotation.y=thumbfinger_3d_roation1 ;
            left_thumb_finger_rotation.z=thumbfinger_3d_roation2 ;
            //wristroattion/////////
            const leftrootup = (calculateDirectionVector(lefthandroot, middle_finger_position1));
            const leftpalm=(calculateDirectionVector(middle_finger_position1, pinky_finger_position1));
            const lefthandrotate=calculateCrossProductZComponent(leftrootup,leftpalm)
            lefthandrotation.x=lefthandrotate;
            lefthandrotation.y=vector3Magnitude(leftpalm)/vector3Magnitude(leftrootup);
            lefthandrotation.z=lefthandrotation.x*lefthandrotation.y*100;
            /////////
            const leftelbow_handtwist = poseLandmarkerResult.landmarks[0][13];
            const leftwrist_handtwist = handLandmarkerResult.landmarks[lefthandnumber][0];
            const leftmiddlefingertop_handtwist = handLandmarkerResult.landmarks[lefthandnumber][9];
            const lefthandtwistvector1=(calculateDirectionVector(leftelbow_handtwist, leftwrist_handtwist));
            const lefthandtwistvector2=(calculateDirectionVector(leftwrist_handtwist, leftmiddlefingertop_handtwist));
            const lefthand_twist=calculateCrossProductZComponent(lefthandtwistvector1,lefthandtwistvector2)
            lefthandtwist.x=lefthand_twist*100;





          }
          else{
            leftforearmrotation_idle.z=0;
          }
          if (righthandnumber!==-1){
            rightforearmrotation_idle.z=1;
            ////////////////////////
            const righthandroot = handLandmarkerResult.landmarks[righthandnumber][0];
            ////index_finger///////////////////////////
            const index_finger_position1R = handLandmarkerResult.landmarks[righthandnumber][5];
            const index_finger_position2R = handLandmarkerResult.landmarks[righthandnumber][6];
            const index_finger_position3R = handLandmarkerResult.landmarks[righthandnumber][7];
            const index_finger_position4R = handLandmarkerResult.landmarks[righthandnumber][8];
            const indexfinger_3d_roation0R = angleBetween3DCoords(righthandroot, index_finger_position1R, index_finger_position2R);
            const indexfinger_3d_roation1R = angleBetween3DCoords(index_finger_position1R, index_finger_position2R, index_finger_position3R);
            const indexfinger_3d_roation2R = angleBetween3DCoords(index_finger_position2R, index_finger_position3R, index_finger_position4R);
            right_index_finger_rotation.x = indexfinger_3d_roation0R;
            right_index_finger_rotation.y = indexfinger_3d_roation1R;
            right_index_finger_rotation.z = indexfinger_3d_roation2R;
            ////middle_finger///////////////////////////
            const middle_finger_position1R = handLandmarkerResult.landmarks[righthandnumber][9];
            const middle_finger_position2R = handLandmarkerResult.landmarks[righthandnumber][10];
            const middle_finger_position3R = handLandmarkerResult.landmarks[righthandnumber][11];
            const middle_finger_position4R = handLandmarkerResult.landmarks[righthandnumber][12];
            const middlefinger_3d_roation0R = angleBetween3DCoords(righthandroot, middle_finger_position1R, middle_finger_position2R);
            const middlefinger_3d_roation1R = angleBetween3DCoords(middle_finger_position1R, middle_finger_position2R, middle_finger_position3R);
            const middlefinger_3d_roation2R = angleBetween3DCoords(middle_finger_position2R, middle_finger_position3R, middle_finger_position4R);
            right_middle_finger_rotation.x = middlefinger_3d_roation0R;
            right_middle_finger_rotation.y = middlefinger_3d_roation1R;
            right_middle_finger_rotation.z = middlefinger_3d_roation2R;
            ////ring_finger///////////////////////////
            const ring_finger_position1R = handLandmarkerResult.landmarks[righthandnumber][13];
            const ring_finger_position2R = handLandmarkerResult.landmarks[righthandnumber][14];
            const ring_finger_position3R = handLandmarkerResult.landmarks[righthandnumber][15];
            const ring_finger_position4R = handLandmarkerResult.landmarks[righthandnumber][16];
            const ringfinger_3d_roation0R = angleBetween3DCoords(righthandroot, ring_finger_position1R, ring_finger_position2R);
            const ringfinger_3d_roation1R = angleBetween3DCoords(ring_finger_position1R, ring_finger_position2R, ring_finger_position3R);
            const ringfinger_3d_roation2R = angleBetween3DCoords(ring_finger_position2R, ring_finger_position3R, ring_finger_position4R);
            right_ring_finger_rotation.x = ringfinger_3d_roation0R;
            right_ring_finger_rotation.y = ringfinger_3d_roation1R;
            right_ring_finger_rotation.z = ringfinger_3d_roation2R;

            ////pinky_finger///////////////////////////
            const pinky_finger_position1R = handLandmarkerResult.landmarks[righthandnumber][17];
            const pinky_finger_position2R = handLandmarkerResult.landmarks[righthandnumber][18];
            const pinky_finger_position3R = handLandmarkerResult.landmarks[righthandnumber][19];
            const pinky_finger_position4R = handLandmarkerResult.landmarks[righthandnumber][20];
            const pinkyfinger_3d_roation0R = angleBetween3DCoords(righthandroot, pinky_finger_position1R, pinky_finger_position2R);
            const pinkyfinger_3d_roation1R = angleBetween3DCoords(pinky_finger_position1R, pinky_finger_position2R, pinky_finger_position3R);
            const pinkyfinger_3d_roation2R = angleBetween3DCoords(pinky_finger_position2R, pinky_finger_position3R, pinky_finger_position4R);
            right_pinky_finger_rotation.x = pinkyfinger_3d_roation0R;
            right_pinky_finger_rotation.y = pinkyfinger_3d_roation1R;
            right_pinky_finger_rotation.z = pinkyfinger_3d_roation2R;

            ////thumb_finger///////////////////////////
            const thumb_finger_position1R = handLandmarkerResult.landmarks[righthandnumber][1];
            const thumb_finger_position2R = handLandmarkerResult.landmarks[righthandnumber][2];
            const thumb_finger_position3R = handLandmarkerResult.landmarks[righthandnumber][3];
            const thumb_finger_position4R = handLandmarkerResult.landmarks[righthandnumber][4];
            //const thumbfinger_3d_roation0 = angleBetween3DCoords();
            const thumbfinger_3d_roation1R = angleBetween3DCoords(thumb_finger_position1R, thumb_finger_position2R, thumb_finger_position3R);
            const thumbfinger_3d_roation2R = angleBetween3DCoords(thumb_finger_position2R, thumb_finger_position3R, thumb_finger_position4R);
            right_thumb_finger_rotation.x = 0;
            right_thumb_finger_rotation.y = thumbfinger_3d_roation1R;
            right_thumb_finger_rotation.z = thumbfinger_3d_roation2R;
            //wristroattion/////////
            const rightrootup = (calculateDirectionVector(righthandroot, middle_finger_position1R));
            const rightpalm = (calculateDirectionVector(middle_finger_position1R, pinky_finger_position1R));
            const righthandrotate = calculateCrossProductZComponent(rightrootup, rightpalm)
            righthandrotation.x = righthandrotate;
            righthandrotation.y = vector3Magnitude(rightpalm) / vector3Magnitude(rightrootup);
            righthandrotation.z = righthandrotation.x * righthandrotation.y * 100;
            /////////
            const rightelbow_handtwist = poseLandmarkerResult.landmarks[0][14];
            const rightwrist_handtwist = handLandmarkerResult.landmarks[righthandnumber][0];
            const rightmiddlefingertop_handtwist = handLandmarkerResult.landmarks[righthandnumber][9];
            const righthandtwistvector1 = (calculateDirectionVector(rightelbow_handtwist, rightwrist_handtwist));
            const righthandtwistvector2 = (calculateDirectionVector(rightwrist_handtwist, rightmiddlefingertop_handtwist));
            const righthand_twist = calculateCrossProductZComponent(righthandtwistvector1, righthandtwistvector2)
            righthandtwist.x = righthand_twist * 100;

            


          }
          else{
            rightforearmrotation_idle.z=0;
          }
        }


        
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
      <Canvas style={{ height: 600 }} camera={{ fov: 25 }} shadows>
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
