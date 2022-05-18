import * as THREE from 'three';
import {
  getRenderer,
  scene,
  sceneHighPriority,
  sceneLowPriority,
  rootScene,
  camera,
  dolly,
  bindCanvas,
  getComposer,
} from './renderer.js';
import metaversefile from 'metaversefile';

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();

const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localQuaternion3 = new THREE.Quaternion();

const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();

const localArray = [];
const localArray2 = [];
const localArray3 = [];
const localArray4 = [];
const localArray5 = [];

const sessionMode = 'immersive-vr';
const sessionOpts = {
  requiredFeatures: [
    'local-floor',
    // 'bounded-floor',
  ],
  optionalFeatures: [
    'hand-tracking',
  ],
};

class XRManager extends EventTarget {
  constructor() {
    super();
  }
  updatePost(timestamp, timeDiff) {
    // console.log('camera manager update post');

    const localPlayer = metaversefile.useLocalPlayer();
    const renderer = getRenderer();
    const session = renderer.xr.getSession();
    //const startMode = this.getMode();
  }
  async isXrSupported() {
    if (navigator.xr) {
      let ok = false;
      try {
        ok = await navigator.xr.isSessionSupported(sessionMode);
      } catch (err) {
        console.warn(err);
      }
      return ok;
    } else {
      return false;
    }
  }
  async enterXr() {
    const renderer = getRenderer();
    const session = renderer.xr.getSession();
    if (session === null) {
      let session = null;
      try {
        session = await navigator.xr.requestSession(sessionMode, sessionOpts);
      } catch(err) {
        try {
          session = await navigator.xr.requestSession(sessionMode);
        } catch(err) {
          console.warn(err);
        }
      }
      if (session) {
        function onSessionEnded(e) {
          session.removeEventListener('end', onSessionEnded);
          renderer.xr.setSession(null);
        }
        session.addEventListener('end', onSessionEnded);
        renderer.xr.setSession(session);
        // renderer.xr.setReferenceSpaceType('local-floor');
      }
    } else {
      await session.end();
    }
  }
  injectRigInput(frame) {
    let leftGamepadPosition, leftGamepadQuaternion, leftGamepadPointer, leftGamepadGrip, leftGamepadEnabled;
    let rightGamepadPosition, rightGamepadQuaternion, rightGamepadPointer, rightGamepadGrip, rightGamepadEnabled;

    const localPlayer = metaversefile.useLocalPlayer();
    const renderer = getRenderer();
    const session = renderer.xr.getSession();
    if (session && localPlayer.avatar) {
      let inputSources = Array.from(session.inputSources);
      inputSources = ['right', 'left']
        .map(handedness => inputSources.find(inputSource => inputSource.handedness === handedness));
      let pose;
      if (inputSources[0] && (pose = frame.getPose(inputSources[0].gripSpace, renderer.xr.getReferenceSpace()))) {
        localMatrix.fromArray(pose.transform.matrix)
          .premultiply(dolly.matrix)
          .decompose(localVector2, localQuaternion2, localVector3);
        if (!inputSources[0].profiles.includes('oculus-hand')) {
          localQuaternion2.multiply(localQuaternion3.setFromAxisAngle(localVector3.set(1, 0, 0), -Math.PI*0.5));
        } else {
          localQuaternion2.multiply(localQuaternion3.setFromAxisAngle(localVector3.set(0, 0, 1), Math.PI*0.5)).multiply(localQuaternion3.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI*0.2));
        }
        leftGamepadPosition = localVector2.toArray(localArray);
        leftGamepadQuaternion = localQuaternion2.toArray(localArray2);

        const {gamepad} = inputSources[0];
        if (gamepad && gamepad.buttons.length >= 2) {
          const {buttons} = gamepad;
          leftGamepadPointer = buttons[0].value;
          leftGamepadGrip = buttons[1].value;
        } else {
          leftGamepadPointer = 0;
          leftGamepadGrip = 0;
        }
        leftGamepadEnabled = true;
      } else {
        leftGamepadEnabled = false;
      }
      if (inputSources[1] && (pose = frame.getPose(inputSources[1].gripSpace, renderer.xr.getReferenceSpace()))) {
        localMatrix.fromArray(pose.transform.matrix)
          .premultiply(dolly.matrix)
          .decompose(localVector2, localQuaternion2, localVector3);
        if (!inputSources[1].profiles.includes('oculus-hand')) {
          localQuaternion2.multiply(localQuaternion3.setFromAxisAngle(localVector3.set(1, 0, 0), -Math.PI*0.5));
        } else {
          localQuaternion2.multiply(localQuaternion3.setFromAxisAngle(localVector3.set(0, 0, 1), -Math.PI*0.5)).multiply(localQuaternion3.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI*0.2));
        }
        rightGamepadPosition = localVector2.toArray(localArray3);
        rightGamepadQuaternion = localQuaternion2.toArray(localArray4);

        const {gamepad} = inputSources[1];
        if (gamepad && gamepad.buttons.length >= 2) {
          const {buttons} = gamepad;
          rightGamepadPointer = buttons[0].value;
          rightGamepadGrip = buttons[1].value;
        } else {
          rightGamepadPointer = 0;
          rightGamepadGrip = 0;
        }
        rightGamepadEnabled = true;
      } else {
        rightGamepadEnabled = false;
      }
    } else {
      localMatrix.copy(localPlayer.matrixWorld)
        .decompose(localVector, localQuaternion, localVector2);
    }

    const handOffsetScale = 1; //localPlayer ? localPlayer.avatar.height / 1.5 : 1;
    const leftHandOffset = new THREE.Vector3(0.2, -0.2, -0.4);
    const rightHandOffset = new THREE.Vector3(-0.2, -0.2, -0.4);
    if (!leftGamepadPosition) {
      leftGamepadPosition = localVector2.copy(localVector)
        .add(localVector3.copy(leftHandOffset).multiplyScalar(handOffsetScale).applyQuaternion(localQuaternion))
        .toArray();
      leftGamepadQuaternion = localQuaternion.toArray();
      leftGamepadPointer = 0;
      leftGamepadGrip = 0;
      leftGamepadEnabled = false;
    }
    if (!rightGamepadPosition) {
      rightGamepadPosition = localVector2.copy(localVector)
        .add(localVector3.copy(rightHandOffset).multiplyScalar(handOffsetScale).applyQuaternion(localQuaternion))
        .toArray();
      rightGamepadQuaternion = localQuaternion.toArray();
      rightGamepadPointer = 0;
      rightGamepadGrip = 0;
      rightGamepadEnabled = false;
    }

    if(localPlayer.avatar) {

      localPlayer.avatar.inputs.hmd.position.copy(localVector);
      localPlayer.avatar.inputs.hmd.quaternion.copy(localQuaternion);

      localPlayer.avatar.inputs.leftGamepad.position.copy(new THREE.Vector3().fromArray(leftGamepadPosition));
      localPlayer.avatar.inputs.rightGamepad.position.copy(new THREE.Vector3().fromArray(rightGamepadPosition));

      //console.log(leftGamepadPosition, rightGamepadPosition);
      localPlayer.avatar.inputs.leftGamepad.quaternion.copy(new THREE.Quaternion().fromArray(leftGamepadQuaternion));
      localPlayer.avatar.inputs.rightGamepad.quaternion.copy(new THREE.Quaternion().fromArray(rightGamepadQuaternion));

      localPlayer.avatar.inputs.leftGamepad.pointer = leftGamepadPointer;
      localPlayer.avatar.inputs.rightGamepad.pointer = rightGamepadPointer;

      localPlayer.avatar.inputs.leftGamepad.grip = leftGamepadGrip;
      localPlayer.avatar.inputs.rightGamepad.grip = rightGamepadGrip;

      localPlayer.avatar.inputs.leftGamepad.enabled = leftGamepadEnabled;
      localPlayer.avatar.inputs.rightGamepad.enabled = rightGamepadEnabled;

      //localPlayer.avatar.setTopEnabled(true);
      //localPlayer.avatar.setBottomEnabled(true);
      //localPlayer.avatar.setHandEnabled(0, true);
      //localPlayer.avatar.setHandEnabled(1, true);

      //localPlayer.leftHand.position.copy(new THREE.Vector3().fromArray(leftGamepadPosition));
      //localPlayer.leftHand.quaternion.copy(new THREE.Quaternion().fromArray(leftGamepadQuaternion));

      //localPlayer.rightHand.position.copy(new THREE.Vector3().fromArray(rightGamepadPosition));
      //localPlayer.rightHand.quaternion.copy(new THREE.Quaternion().fromArray(rightGamepadQuaternion));

      //console.log(localPlayer.avatar.inputs);

      //camera.position.copy(localVector);
      //camera.updateMatrixWorld();
      //dolly.position.copy(localPlayer.avatar.inputs.hmd.position);
      //dolly.updateMatrixWorld();

    }

    

    /*rigManager.setLocalAvatarPose([ 
      [localVector.toArray(), localQuaternion.toArray()],
      [leftGamepadPosition, leftGamepadQuaternion, leftGamepadPointer, leftGamepadGrip, leftGamepadEnabled],
      [rightGamepadPosition, rightGamepadQuaternion, rightGamepadPointer, rightGamepadGrip, rightGamepadEnabled],
    ]);*/
  }
};
const xrManager = new XRManager();
export default xrManager;