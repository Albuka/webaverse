import * as THREE from 'three';
import {BufferGeometryUtils} from 'BufferGeometryUtils';
import React from 'react';
const {Fragment, useState, useEffect, useRef} = React;
import ReactDOM from 'react-dom';
import ReactThreeFiber from '@react-three/fiber';
import Babel from '@babel/standalone';
import JSZip from 'jszip';
// import {jsx} from 'jsx-tmpl';
import {world} from './world.js';
import transformControls from './transform-controls.js';
import physicsManager from './physics-manager.js';
import {downloadFile} from './util.js';
import App from '/app.js';
import {getRenderer} from '/app-object.js';
import {storageHost} from './constants.js';
// import TransformGizmo from './TransformGizmo.js';
// import transformControls from './transform-controls.js';
import easing from './easing.js';
import ghDownloadDirectory from './gh-download-directory.js';

const cubicBezier = easing(0, 1, 0, 1);
// const cubicBezier2 = easing(0, 0.7, 0, 0.7);
const ghDownload = ghDownloadDirectory.default;
// window.ghDownload = ghDownload;

/* import BrowserFS from '/browserfs.js';
BrowserFS.configure({
    fs: "IndexedDB",
    options: {
       storeName : "webaverse-editor",
    }
  }, function(e) {
    if (e) {
      // An error happened!
      throw e;
    }
    // Otherwise, BrowserFS is ready-to-use!
  });
const fs = (() => {
  const exports = {};
  BrowserFS.install(exports);
  const {require} = exports;
  const fs = require('fs');
  return fs;
})();
window.BrowserFS = BrowserFS;
window.fs = fs; */

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();
const localMatrix2 = new THREE.Matrix4();
const localMatrix3 = new THREE.Matrix4();

let getEditor = () => null;
let getFiles = () => null;
let getSelectedFileIndex = () => null;
let getErrors = () => null;
let setErrors = () => {};

function createPointerEvents(store) {
  // const { handlePointer } = createEvents(store)
  const handlePointer = key => e => {
    // const handlers = eventObject.__r3f.handlers;
    // console.log('handle pointer', key, e);
  };
  const names = {
    onClick: 'click',
    onContextMenu: 'contextmenu',
    onDoubleClick: 'dblclick',
    onWheel: 'wheel',
    onPointerDown: 'pointerdown',
    onPointerUp: 'pointerup',
    onPointerLeave: 'pointerleave',
    onPointerMove: 'pointermove',
    onPointerCancel: 'pointercancel',
    onLostPointerCapture: 'lostpointercapture',
  }

  return {
    connected: false,
    handlers: (Object.keys(names).reduce(
      (acc, key) => ({ ...acc, [key]: handlePointer(key) }),
      {},
    )),
    connect: (target) => {
      const { set, events } = store.getState()
      events.disconnect?.()
      set((state) => ({ events: { ...state.events, connected: target } }))
      Object.entries(events?.handlers ?? []).forEach(([name, event]) =>
        target.addEventListener(names[name], event, { passive: true }),
      )
    },
    disconnect: () => {
      const { set, events } = store.getState()
      if (events.connected) {
        Object.entries(events.handlers ?? []).forEach(([name, event]) => {
          if (events && events.connected instanceof HTMLElement) {
            events.connected.removeEventListener(names[name], event)
          }
        })
        set((state) => ({ events: { ...state.events, connected: false } }))
      }
    },
  }
}

class CameraGeometry extends THREE.BufferGeometry {
  constructor() {
    super();
    
    const boxGeometry = new THREE.BoxBufferGeometry(1, 1, 1);
    const positions = new Float32Array(boxGeometry.attributes.position.array.length * 8);
    const indices = new Uint16Array(boxGeometry.index.array.length * 8);
    
    const _pushBoxGeometry = m => {
      const g = boxGeometry.clone();
      g.applyMatrix4(m);
      positions.set(g.attributes.position.array, positionIndex);
      for (let i = 0; i < g.index.array.length; i++) {
        indices[indexIndex + i] = g.index.array[i] + positionIndex/3;
      }
      positionIndex += g.attributes.position.array.length;
      indexIndex += g.index.array.length;
    };
    
    const topLeft = new THREE.Vector3(-1, 0.5, -2);
    const topRight = new THREE.Vector3(1, 0.5, -2);
    const bottomLeft = new THREE.Vector3(-1, -0.5, -2);
    const bottomRight = new THREE.Vector3(1, -0.5, -2);
    const back = new THREE.Vector3(0, 0, 0);
    
    const _setMatrixBetweenPoints = (m, p1, p2) => {
      const quaternion = localQuaternion.setFromRotationMatrix(
        localMatrix.lookAt(
          p1,
          p2,
          localVector.set(0, 1, 0)
        )
      );
      const position = localVector.copy(p1)
        .add(p2)
        .divideScalar(2)
        // .add(new THREE.Vector3(0, 2, 0));
      const sc = 0.01;
      const scale = localVector2.set(sc, sc, p1.distanceTo(p2));
      m.compose(position, quaternion, scale);
      return m;
    };
    
    let positionIndex = 0;
    let indexIndex = 0;
    [
      [topLeft, back],
      [topRight, back],
      [bottomLeft, back],
      [bottomRight, back],
      [topLeft, topRight],
      [topRight, bottomRight],
      [bottomRight, bottomLeft],
      [bottomLeft, topLeft],
    ].forEach(e => {
      const [p1, p2] = e;
      _pushBoxGeometry(
        _setMatrixBetweenPoints(localMatrix, p1, p2)
      );
    });
    
    this.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.setIndex(new THREE.BufferAttribute(indices, 1));
  }
}
const _makeUiMesh = () => {
  const geometry = new THREE.PlaneBufferGeometry(2, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    map: new THREE.Texture(),
    side: THREE.DoubleSide,
    transparent: true,
  });
  
  (async () => {
    const img = await new Promise((accept, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        accept(img);
      };
      img.onerror = reject;
      img.src = `/assets/popup.svg`;
    });
    material.map.image = img;
    material.map.needsUpdate = true;
    material.map.minFilter = THREE.THREE.LinearMipmapLinearFilter;
    material.map.magFilter = THREE.LinearFilter;
    material.map.anisotropy = 16;
  })();
  
  const m = new THREE.Mesh(geometry, material);
  m.frustumCulled = false;
  return m;
};
const eps = 0.00001;
const cardPreviewHost = `https://card-preview.exokit.org`;

const cardWidth = 0.063;
const cardHeight = cardWidth / 2.5 * 3.5;
const cardsBufferFactor = 1.1;
const menuWidth = cardWidth * cardsBufferFactor * 4;
const menuHeight = cardHeight * cardsBufferFactor * 4;
const menuRadius = 0.0025;
const _loadImage = u => new Promise((accept, reject) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  
  img.src = u;
  img.onload = () => {
    accept(img);
  };
  img.onerror = reject;
});
function makeShape(shape, x, y, width, height, radius, smoothness) {
  shape.absarc( x, y, radius, -Math.PI / 2, -Math.PI, true );
  shape.absarc( x, y + height - radius * 2, radius, Math.PI, Math.PI / 2, true );
  shape.absarc( x + width - radius * 2, y + height -  radius * 2, radius, Math.PI / 2, 0, true );
  shape.absarc( x + width - radius * 2, y, radius, 0, -Math.PI / 2, true );
  return shape;
}
function createBoxWithRoundedEdges( width, height, depth, radius0, smoothness ) {
  const shape = makeShape(new THREE.Shape(), 0, 0, width, height, radius0, smoothness);
  const innerFactor = 0.99;
  const hole = makeShape(new THREE.Path(), radius0/2, radius0/2, width * innerFactor, height * innerFactor, radius0, smoothness);
  shape.holes.push(hole);

  let geometry = new THREE.ExtrudeBufferGeometry( shape, {
    amount: 0,
    bevelEnabled: true,
    bevelSegments: smoothness * 2,
    steps: 1,
    bevelSize: radius0,
    bevelThickness: 0,
    curveSegments: smoothness
  });
  
  geometry.center();
  
  return geometry;
}
const cardFrontGeometry = new THREE.PlaneBufferGeometry(cardWidth, cardHeight);
const cardBackGeometry = cardFrontGeometry.clone()
  .applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, -0.001),
      new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      new THREE.Vector3(1, 1, 1)
    )
  );
const _makeCardBackMaterial = () => {
  const material = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    map: new THREE.Texture(),
    transparent: true,
  });
  (async () => {
    const img = await _loadImage('./assets/cardback.png');
    material.map.image = img;
    material.map.minFilter = THREE.LinearMipmapLinearFilter;
    material.map.magFilter = THREE.LinearFilter;
    material.map.anisotropy = 16;
    material.map.needsUpdate = true;
  })();
  return material;
};
const _makeCardMesh = img => {
  const geometry = cardFrontGeometry;
  const material = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
    map: new THREE.Texture(img),
    side: THREE.DoubleSide,
    transparent: true,
  });
  material.map.minFilter = THREE.LinearMipmapLinearFilter;
  material.map.magFilter = THREE.LinearFilter;
  material.map.anisotropy = 16;
  material.map.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, material);
  
  {
    const geometry = cardBackGeometry;
    const material = _makeCardBackMaterial();
    const back = new THREE.Mesh(geometry, material);
    mesh.add(back);
    mesh.back = back;
  }
  
  return mesh;
};
const _makeInventoryMesh = () => {
  const w = menuWidth + menuRadius*2;
  const h = menuHeight + menuRadius*2;
  const geometry = createBoxWithRoundedEdges(w, h, 0, menuRadius, 1);
  const boundingBox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
  console.log('got bounding box', boundingBox);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBoundingBox: {
        type: 'vec4',
        value: new THREE.Vector4(
          boundingBox.min.x,
          boundingBox.min.y,
          boundingBox.max.x - boundingBox.min.x,
          boundingBox.max.y - boundingBox.min.y
        ),
        needsUpdate: true,
      },
      uTime: {
        type: 'f',
        value: 0,
        needsUpdate: true,
      },
      uTimeCubic: {
        type: 'f',
        value: 0,
        needsUpdate: true,
      },
    },
    vertexShader: `\
      precision highp float;
      precision highp int;

      // uniform float uTime;
      uniform vec4 uBoundingBox;
      varying vec3 vPosition;
      // varying vec3 vNormal;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        vPosition = (
          position - vec3(uBoundingBox.x, uBoundingBox.y, 0.)
        ) / vec3(uBoundingBox.z, uBoundingBox.w, 1.);
        // vNormal = normal;
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      // uniform vec4 uBoundingBox;
      uniform float uTime;
      uniform float uTimeCubic;
      varying vec3 vPosition;
      // varying vec3 vNormal;

      vec3 hueShift( vec3 color, float hueAdjust ){
        const vec3  kRGBToYPrime = vec3 (0.299, 0.587, 0.114);
        const vec3  kRGBToI      = vec3 (0.596, -0.275, -0.321);
        const vec3  kRGBToQ      = vec3 (0.212, -0.523, 0.311);

        const vec3  kYIQToR     = vec3 (1.0, 0.956, 0.621);
        const vec3  kYIQToG     = vec3 (1.0, -0.272, -0.647);
        const vec3  kYIQToB     = vec3 (1.0, -1.107, 1.704);

        float   YPrime  = dot (color, kRGBToYPrime);
        float   I       = dot (color, kRGBToI);
        float   Q       = dot (color, kRGBToQ);
        float   hue     = atan (Q, I);
        float   chroma  = sqrt (I * I + Q * Q);

        hue += hueAdjust;

        Q = chroma * sin (hue);
        I = chroma * cos (hue);

        vec3    yIQ   = vec3 (YPrime, I, Q);

        return vec3( dot (yIQ, kYIQToR), dot (yIQ, kYIQToG), dot (yIQ, kYIQToB) );
    }

      void main() {
        if (
          (1. - vPosition.y) < uTimeCubic &&
          abs(vPosition.x - 0.5) < uTimeCubic
        ) {
          gl_FragColor = vec4(hueShift(vPosition, uTime * PI * 2.), 1.);
        } else {
          discard;
        }
      }
    `,
    // transparent: true,
    // polygonOffset: true,
    // polygonOffsetFactor: -1,
    // polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  
  const cards = [];
  (async () => {
    const cardImgs = [];
    const numCols = 4;
    const numRows = 6;
    const promises = [];
    let i = 0;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const promise = (async () => {
          const index = i;
          const id = ++i;
          const w = 1024;
          const ext = 'png';
          const u = `${cardPreviewHost}/?t=${id}&w=${w}&ext=${ext}`;
          const img = await _loadImage(u);
          
          const cardMesh = _makeCardMesh(img);
          cardMesh.basePosition = new THREE.Vector3(
            menuRadius - menuWidth/2 + cardWidth/2 + col * cardWidth * cardsBufferFactor,
            -menuRadius + menuHeight/2 - cardHeight/2 - row * cardHeight * cardsBufferFactor,
            0
          );
          cardMesh.position.copy(cardMesh.basePosition);
          cardMesh.index = index;
          mesh.add(cardMesh);
          cards.push(cardMesh);
        })();
        promises.push(promise);
      }
    }
    await Promise.all(promises);
  })();

  
  mesh.update = () => {
    const maxTime = 2000;
    const f = (Date.now() % maxTime) / maxTime;
    
    material.uniforms.uTime.value = f;
    material.uniforms.uTime.needsUpdate = true;
    material.uniforms.uTimeCubic.value = cubicBezier(f);
    material.uniforms.uTimeCubic.needsUpdate = true;
    
    // window.cards = cards;
    for (const card of cards) {
      const {index} = card;
      const cardStartTime = index * 0.02;
      const g = cubicBezier(f - cardStartTime);
      const h = 1 - g;
      card.position.copy(card.basePosition)
        .lerp(
          card.basePosition.clone()
            .add(new THREE.Vector3(0, -0.1, 0))
          ,
          h
        );
      card.material.opacity = g;
      card.back.material.opacity = g;
    }
  };
  
  return mesh;
};
const _makeVaccumMesh = () => {
  const size = 0.1;
  const count = 5;
  const crunchFactor = 0.9;
  const innerSize = size * crunchFactor;
  const cubeGeometry = new THREE.BoxBufferGeometry(innerSize, innerSize, innerSize);
  
  let numCubes = 0;
  for (let x = 0; x < count; x++) {
    for (let y = 0; y < count; y++) {
      for (let z = 0; z < count; z++) {
        if (
          (x === 0 || x === (count - 1)) ||
          (y === 0 || y === (count - 1)) ||
          (z === 0 || z === (count - 1))
        ) {
          numCubes++;
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cubeGeometry.attributes.position.array.length * numCubes), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(cubeGeometry.attributes.normal.array.length * numCubes), 3));
  geometry.setAttribute('time', new THREE.BufferAttribute(new Float32Array(cubeGeometry.attributes.position.array.length/3 * numCubes), 1));
  geometry.setAttribute('position2', new THREE.BufferAttribute(new Float32Array(cubeGeometry.attributes.position.array.length * numCubes), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(cubeGeometry.index.array.length * numCubes), 1));
  
  geometry.attributes.time.array.fill(-1);
  
  let positionIndex = 0;
  let normalIndex = 0;
  let indexIndex = 0;
  for (let x = 0; x < count; x++) {
    for (let y = 0; y < count; y++) {
      for (let z = 0; z < count; z++) {
        if (
          (x === 0 || x === (count - 1)) ||
          (y === 0 || y === (count - 1)) ||
          (z === 0 || z === (count - 1))
        ) {
          /* const g = cubeGeometry.clone()
            .applyMatrix4(
              new THREE.Matrix4()
                .compose(
                  new THREE.Vector3(x * size, y * size, z * size),
                  new THREE.Quaternion(),
                  new THREE.Vector3(1, 1, 1)
                )
            ); */
          // console.log('got g offset', [x * size, y * size, z * size]);
          
          
          
          geometry.attributes.position.array.set(cubeGeometry.attributes.position.array, positionIndex);
          geometry.attributes.normal.array.set(cubeGeometry.attributes.normal.array, normalIndex);
          for (let i = 0; i < cubeGeometry.attributes.position.array.length/3; i++) {
            geometry.attributes.position2.array[positionIndex + i*3] = -(count * size / 2) + x * size;
            geometry.attributes.position2.array[positionIndex + i*3+1] = -(count * size / 2) + y * size;
            geometry.attributes.position2.array[positionIndex + i*3+2] = -(count * size / 2) + z * size;
          }
          for (let i = 0; i < cubeGeometry.index.array.length; i++) {
            geometry.index.array[indexIndex + i] = positionIndex/3 + cubeGeometry.index.array[i];
          }
          
          positionIndex += cubeGeometry.attributes.position.array.length;
          normalIndex += cubeGeometry.attributes.normal.array.length;
          indexIndex += cubeGeometry.index.array.length;
        }
      }
    }
  }
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      /* uBoundingBox: {
        type: 'vec4',
        value: new THREE.Vector4(
          boundingBox.min.x,
          boundingBox.min.y,
          boundingBox.max.x - boundingBox.min.x,
          boundingBox.max.y - boundingBox.min.y
        ),
        needsUpdate: true,
      }, */
      uTime: {
        type: 'f',
        value: 0,
        needsUpdate: true,
      },
      uTimeCubic: {
        type: 'f',
        value: 0,
        needsUpdate: true,
      },
    },
    vertexShader: `\
      precision highp float;
      precision highp int;

      // uniform float uTime;
      // uniform vec4 uBoundingBox;
      // varying vec3 vPosition;
      // varying vec3 vNormal;
      attribute vec3 position2;
      attribute float time;
      varying vec3 vPosition2;
      varying vec3 vNormal;
      varying float vTime;

      float getBezierT(float x, float a, float b, float c, float d) {
        return float(sqrt(3.) * 
          sqrt(-4. * b * d + 4. * b * x + 3. * c * c + 2. * c * d - 8. * c * x - d * d + 4. * d * x) 
            + 6. * b - 9. * c + 3. * d) 
            / (6. * (b - 2. * c + d));
      }
      float easing(float x) {
        return getBezierT(x, 0., 1., 0., 1.);
      }
      float easing2(float x) {
        return easing(easing(x));
      }
      
      const float moveDistance = 20.;
      const float q = 0.7;

      void main() {
        float offsetTime = min(max((time + (1. - q)) / q, 0.), 1.);
        
        vec4 mvPosition = modelViewMatrix * vec4(
          position * offsetTime +
          position2 * (1. + moveDistance * (1. - easing(offsetTime))), 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vPosition2 = position2;
        vNormal = normal;
        vTime = time;
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      // uniform vec4 uBoundingBox;
      // uniform float uTime;
      // uniform float uTimeCubic;
      varying vec3 vPosition2;
      varying vec3 vNormal;
      varying float vTime;

      vec3 hueShift( vec3 color, float hueAdjust ){
        const vec3  kRGBToYPrime = vec3 (0.299, 0.587, 0.114);
        const vec3  kRGBToI      = vec3 (0.596, -0.275, -0.321);
        const vec3  kRGBToQ      = vec3 (0.212, -0.523, 0.311);

        const vec3  kYIQToR     = vec3 (1.0, 0.956, 0.621);
        const vec3  kYIQToG     = vec3 (1.0, -0.272, -0.647);
        const vec3  kYIQToB     = vec3 (1.0, -1.107, 1.704);

        float   YPrime  = dot (color, kRGBToYPrime);
        float   I       = dot (color, kRGBToI);
        float   Q       = dot (color, kRGBToQ);
        float   hue     = atan (Q, I);
        float   chroma  = sqrt (I * I + Q * Q);

        hue += hueAdjust;

        Q = chroma * sin (hue);
        I = chroma * cos (hue);

        vec3    yIQ   = vec3 (YPrime, I, Q);

        return vec3( dot (yIQ, kYIQToR), dot (yIQ, kYIQToG), dot (yIQ, kYIQToB) );
      }
    
      float getBezierT(float x, float a, float b, float c, float d) {
        return float(sqrt(3.) * 
          sqrt(-4. * b * d + 4. * b * x + 3. * c * c + 2. * c * d - 8. * c * x - d * d + 4. * d * x) 
            + 6. * b - 9. * c + 3. * d) 
            / (6. * (b - 2. * c + d));
      }
      float easing(float x) {
        return getBezierT(x, 0., 1., 0., 1.);
      }

      const float q = 0.7;
      const float q2 = 0.9;
      
      void main() {
        float offsetTime = max(vTime - q, 0.) * 20.;
        float offsetTime2 = vTime * 20.;
        if (offsetTime2 > 0.) {
          gl_FragColor = vec4(
            vNormal * 0.1 +
              vec3(${new THREE.Color(0x29b6f6).toArray().join(', ')}),
            1. - max((vTime-q2)/(1.-q2), 0.)
          );
          gl_FragColor.rgb *= offsetTime;
        } else {
          discard;
        }
      }
    `,
    transparent: true,
    // polygonOffset: true,
    // polygonOffsetFactor: -1,
    // polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  
  let dots = [];
  const interval = setInterval(() => {
    const now = Date.now();
    const x = Math.floor(Math.random() * count);
    const y = Math.floor(Math.random() * count);
    const z = Math.floor(Math.random() * count);
    const index = Math.floor(Math.random() * numCubes);
    dots.push({
      x,
      y,
      z,
      index,
      startTime: now,
      endTime: now + 500,
    });
  }, 50);
  
  mesh.update = () => {
    geometry.attributes.time.array.fill(-1);
    
    const now = Date.now();
    dots = dots.filter(dot => {
      const {x, y, z, index, startTime, endTime} = dot;
      const f = (now - startTime) / (endTime - startTime);
      if (f <= 1) {
        const numTimesPerGeometry = cubeGeometry.attributes.position.array.length/3;
        const startIndex = index * numTimesPerGeometry;
        const endIndex = (index + 1) * numTimesPerGeometry;
        /* if (startIndex < 0) {
          debugger;
        }
        if (endIndex > geometry.attributes.time.array.length) {
          debugger;
        } */
        
        for (let i = startIndex; i < endIndex; i++) {
          geometry.attributes.time.array[i] = f;
        }
        return true;
      } else {
        return false;
      }
    });
    geometry.attributes.time.needsUpdate = true;
  };
  return mesh;
};
const _makeLoadingBarMesh = basePosition => {
  const o = new THREE.Object3D();

  const geometry1 = BufferGeometryUtils.mergeBufferGeometries([
    new THREE.BoxBufferGeometry(1.04, 0.02, 0.02)
      .applyMatrix4(
        new THREE.Matrix4()
          .compose(
            new THREE.Vector3(0, 0.03, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          )
      ),
    new THREE.BoxBufferGeometry(1.04, 0.02, 0.02)
      .applyMatrix4(
        new THREE.Matrix4()
          .compose(
            new THREE.Vector3(0, -0.03, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          )
      ),
    new THREE.BoxBufferGeometry(0.02, 0.13, 0.02)
      .applyMatrix4(
        new THREE.Matrix4()
          .compose(
            new THREE.Vector3(-1/2 - 0.02, 0, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          )
      ),
    new THREE.BoxBufferGeometry(0.02, 0.13, 0.02)
      .applyMatrix4(
        new THREE.Matrix4()
          .compose(
            new THREE.Vector3(1/2 + 0.02, 0, 0),
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          )
      ),
  ]);
  const material1 = new THREE.MeshBasicMaterial({
    color: 0x000000,
  });
  const outerMesh = new THREE.Mesh(geometry1, material1);
  o.add(outerMesh);

  const geometry2 = new THREE.PlaneBufferGeometry(1, 0.03)
    .applyMatrix4(
      new THREE.Matrix4()
        .compose(
          new THREE.Vector3(1/2, 0, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(1, 1, 1)
        )
    );
  const material2 = new THREE.ShaderMaterial({
    uniforms: {
      /* uBoundingBox: {
        type: 'vec4',
        value: new THREE.Vector4(
          boundingBox.min.x,
          boundingBox.min.y,
          boundingBox.max.x - boundingBox.min.x,
          boundingBox.max.y - boundingBox.min.y
        ),
        needsUpdate: true,
      }, */
      color: {
        type: 'c',
        value: new THREE.Color(),
        needsUpdate: true,
      },
    },
    vertexShader: `\
      precision highp float;
      precision highp int;

      // uniform float uTime;
      // uniform vec4 uBoundingBox;
      // varying vec3 vPosition;
      // varying vec3 vNormal;
      // uniform vec3 color;
      // attribute float time;
      // varying vec3 vPosition2;
      // varying vec3 vNormal;
      // varying float vTime;
      varying vec2 vUv;
      varying vec3 vColor;

      float getBezierT(float x, float a, float b, float c, float d) {
        return float(sqrt(3.) * 
          sqrt(-4. * b * d + 4. * b * x + 3. * c * c + 2. * c * d - 8. * c * x - d * d + 4. * d * x) 
            + 6. * b - 9. * c + 3. * d) 
            / (6. * (b - 2. * c + d));
      }
      float easing(float x) {
        return getBezierT(x, 0., 1., 0., 1.);
      }
      float easing2(float x) {
        return easing(easing(x));
      }
      
      // const float moveDistance = 20.;
      // const float q = 0.7;

      void main() {
        // float offsetTime = min(max((time + (1. - q)) / q, 0.), 1.);
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
        // vPosition2 = position2;
        // vColor = color;
        // vNormal = normal;
        // vTime = time;
        vUv = uv;
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      uniform vec3 color;
      // uniform vec4 uBoundingBox;
      // uniform float uTime;
      // uniform float uTimeCubic;
      // varying vec3 vPosition2;
      varying vec2 vUv;
      // varying vec3 vColor;
      // varying float vTime;

      vec3 hueShift( vec3 color, float hueAdjust ){
        const vec3  kRGBToYPrime = vec3 (0.299, 0.587, 0.114);
        const vec3  kRGBToI      = vec3 (0.596, -0.275, -0.321);
        const vec3  kRGBToQ      = vec3 (0.212, -0.523, 0.311);

        const vec3  kYIQToR     = vec3 (1.0, 0.956, 0.621);
        const vec3  kYIQToG     = vec3 (1.0, -0.272, -0.647);
        const vec3  kYIQToB     = vec3 (1.0, -1.107, 1.704);

        float   YPrime  = dot (color, kRGBToYPrime);
        float   I       = dot (color, kRGBToI);
        float   Q       = dot (color, kRGBToQ);
        float   hue     = atan (Q, I);
        float   chroma  = sqrt (I * I + Q * Q);

        hue += hueAdjust;

        Q = chroma * sin (hue);
        I = chroma * cos (hue);

        vec3    yIQ   = vec3 (YPrime, I, Q);

        return vec3( dot (yIQ, kYIQToR), dot (yIQ, kYIQToG), dot (yIQ, kYIQToB) );
      }
    
      float getBezierT(float x, float a, float b, float c, float d) {
        return float(sqrt(3.) * 
          sqrt(-4. * b * d + 4. * b * x + 3. * c * c + 2. * c * d - 8. * c * x - d * d + 4. * d * x) 
            + 6. * b - 9. * c + 3. * d) 
            / (6. * (b - 2. * c + d));
      }
      float easing(float x) {
        return getBezierT(x, 0., 1., 0., 1.);
      }

      // const float q = 0.7;
      // const float q2 = 0.9;
      
      void main() {
        gl_FragColor = vec4(hueShift(color, vUv.x * PI) * 1.5, 1.);
      }
    `,
    // transparent: true,
    side: THREE.DoubleSide,
    // polygonOffset: true,
    // polygonOffsetFactor: -1,
    // polygonOffsetUnits: 1,
  });
  const innerMesh = new THREE.Mesh(geometry2, material2);
  innerMesh.position.x = -1/2;
  innerMesh.update = () => {
    const f = (Date.now() % 1000) / 1000;
    innerMesh.scale.x = f;
    innerMesh.material.uniforms.color.value.setHSL((f * 5) % 5, 0.5, 0.5);
    innerMesh.material.uniforms.color.needsUpdate = true;
  };
  o.add(innerMesh);

  o.update = () => {
    innerMesh.update();
    
    o.position.copy(basePosition)
      .add(
        localVector
          .set(
            -1 + Math.random() * 2,
            -1 + Math.random() * 2,
            -1 + Math.random() * 2
          )
          .normalize()
          .multiplyScalar(0.02)
        );
  };

  return o;
};

const _makeLoaderMesh = () => {
  const o = new THREE.Object3D();
  
  const vaccumMesh = _makeVaccumMesh();
  o.add(vaccumMesh);
  
  const loadingBarMesh = _makeLoadingBarMesh(new THREE.Vector3(0, 0.5, 0));
  o.add(loadingBarMesh);
  
  o.update = () => {
    vaccumMesh.update();
    loadingBarMesh.update();
  };
  
  return o;
};

const fetchAndCompileBlob = async (file, files) => {
  const res = file;
  const scriptUrl = file.name;
  let s = await file.text();
  
  const urlCache = {};
  const _mapUrl = async (u, scriptUrl) => {
    const cachedContent = urlCache[u];
    if (cachedContent !== undefined) {
      // return u;
      // nothing
    } else {
      const baseUrl = /https?:\/\//.test(scriptUrl) ? scriptUrl : `https://webaverse.com/${scriptUrl}`;
      const pathUrl = new URL(u, baseUrl).pathname.replace(/^\//, '');
      const file = files.find(file => file.name === pathUrl);
      // console.log('got script url', {scriptUrl, baseUrl, pathUrl, file});
      if (file) {
        let importScript = await file.blob.text();
        importScript = await _mapScript(importScript, pathUrl);
        // const p = new URL(fullUrl).pathname.replace(/^\//, '');
        urlCache[pathUrl] = importScript;
      } else {
        // const fullUrl = new URL(u, scriptUrl).href;
        const res = await fetch(u);
        if (res.ok) {
          let importScript = await res.text();
          importScript = await _mapScript(importScript, fullUrl);
          const p = new URL(fullUrl).pathname.replace(/^\//, '');
          urlCache[p] = importScript;
        } else {
          throw new Error('failed to load import url: ' + u);
        }
     }
    }
  };
  const _mapScript = async (script, scriptUrl) => {
    // const r = /^(\s*import[^\n]+from\s*['"])(.+)(['"])/gm;
    // console.log('map script');
    const r = /((?:im|ex)port(?:["'\s]*[\w*{}\n\r\t, ]+from\s*)?["'\s])([@\w_\-\.\/]+)(["'\s].*);?$/gm;
    // console.log('got replacements', script, Array.from(script.matchAll(r)));
    const replacements = await Promise.all(Array.from(script.matchAll(r)).map(async match => {
      let u = match[2];
      // console.log('replacement', u);
      if (/^\.+\//.test(u)) {
        await _mapUrl(u, scriptUrl);
      }
      return u;
    }));
    let index = 0;
    script = script.replace(r, function() {
      return arguments[1] + replacements[index++] + arguments[3];
    });
    const spec = Babel.transform(script, {
      presets: ['react'],
      // compact: false,
    });
    script = spec.code;
    return script;
  };

  s = await _mapScript(s, scriptUrl);
  const o = new URL(scriptUrl, `https://webaverse.com/`);
  const p = o.pathname.replace(/^\//, '');
  urlCache[p] = s;
  return urlCache;
  // return s;
  /* const o = new URL(scriptUrl, `https://webaverse.com/`);
  const p = o.pathname.replace(/^\//, '');
  urlCache[p] = s;

  urlCache['.metaversefile'] = JSON.stringify({
    start_url: p,
  });
  
  const zip = new JSZip();
  for (const p in urlCache) {
    const d = urlCache[p];
    // console.log('add file', p);
    zip.file(p, d);
  }
  const ab = await zip.generateAsync({
    type: 'arraybuffer',
  });
  return new Uint8Array(ab); */
};
const fetchZipFiles = async zipData => {
  const zip = await JSZip.loadAsync(zipData);
  // console.log('load file 4', zip.files);

  const fileNames = [];
  // const localFileNames = {};
  for (const fileName in zip.files) {
    fileNames.push(fileName);
  }
  const files = await Promise.all(fileNames.map(async fileName => {
    const file = zip.file(fileName);
    
    const b = file && await file.async('blob');
    return {
      name: fileName,
      data: b,
    };
  }));
  return files;
};

const isDirectoryName = fileName => /\/$/.test(fileName);
const uploadFiles = async files => {
  const fd = new FormData();
  const directoryMap = {};
  const metaverseFile = files.find(f => f.name === '.metaversefile');
  // console.log('got', metaverseFile);
  const metaverseJson = await (async () => {
    const s = await metaverseFile.data.text();
    const j = JSON.parse(s);
    return j;    
  })();
  const {start_url} = metaverseJson;
  [
    // mainDirectoryName,
    '',
  ].forEach(p => {
    if (!directoryMap[p]) {
      // console.log('add missing main directory', [p]);
      fd.append(
        p,
        new Blob([], {
          type: 'application/x-directory',
        }),
        p
      );
    }
  });

  for (const file of files) {
    const {name} = file;
    const basename = name; // localFileNames[name];
    // console.log('append', basename, name);
    if (isDirectoryName(name)) {
      const p = name.replace(/\/+$/, '');
      console.log('append dir', p);
      fd.append(
        p,
        new Blob([], {
          type: 'application/x-directory',
        }),
        p
      );
      directoryMap[p] = true;
    } else {
      // console.log('append file', name);
      fd.append(name, file.data, basename);
    }
  }

  const uploadFilesRes = await fetch(storageHost, {
    method: 'POST',
    body: fd,
  });
  const hashes = await uploadFilesRes.json();

  const rootDirectory = hashes.find(h => h.name === '');
  console.log('got hashes', {rootDirectory, hashes});
  const rootDirectoryHash = rootDirectory.hash;
  return rootDirectoryHash;
  /* const ipfsUrl = `${storageHost}/ipfs/${rootDirectoryHash}`;
  console.log('got ipfs url', ipfsUrl);
  return ipfsUrl; */
};
/* let rootDiv = null;
// let state = null;
const loadModule = async u => {
  const m = await import(u);
  const fn = m.default;
  // console.log('got fn', fn);

  // window.ReactThreeFiber = ReactThreeFiber;

  if (rootDiv) {
    const roots = ReactThreeFiber._roots;
    const root = roots.get(rootDiv);
    const fiber = root?.fiber
    if (fiber) {
      const state = root?.store.getState()
      if (state) state.internal.active = false
      await new Promise((accept, reject) => {
        ReactThreeFiber.reconciler.updateContainer(null, fiber, null, () => {
          if (state) {
            // setTimeout(() => {
              state.events.disconnect?.()
              // state.gl?.renderLists?.dispose?.()
              // state.gl?.forceContextLoss?.()
              ReactThreeFiber.dispose(state)
              roots.delete(canvas)
              // if (callback) callback(canvas)
            // }, 500)
          }
          accept();
        });
      });
    }
  }

  const sizeVector = renderer.getSize(new THREE.Vector2());
  rootDiv = document.createElement('div');

  await app.waitForLoad();
  app.addEventListener('frame', () => {
    ReactThreeFiber.render(
      React.createElement(fn),
      rootDiv,
      {
        gl: renderer,
        camera,
        size: {
          width: sizeVector.x,
          height: sizeVector.y,
        },
        events: createPointerEvents,
        onCreated: state => {
          // state = newState;
          // scene.add(state.scene);
          console.log('got state', state);
        },
        frameloop: 'demand',
      }
    );
  });
}; */
const downloadZip = async () => {
  const zipData = await collectZip();
  // console.log('got zip data', zipData);
  const blob = new Blob([zipData], {
    type: 'application/zip',
  });
  await downloadFile(blob, 'nft.zip');
};
const collectZip = async () => {
  const zip = new JSZip();
  const files = getFiles();
  const metaversefile = files.find(file => file.name === '.metaversefile');
  const metaversefileJson = JSON.parse(metaversefile.doc.getValue());
  const {start_url} = metaversefileJson;
  // console.log('got start url', start_url);
  const startUrlFile = files.find(file => file.name === start_url);
  if (startUrlFile) {
    if (startUrlFile.doc) {
      startUrlFile.blob = new Blob([startUrlFile.doc.getValue()], {
        type: 'application/javascript',
      });
    }
    startUrlFile.blob.name = start_url;
    const urlCache = await fetchAndCompileBlob(startUrlFile.blob, files);
    for (const name in urlCache) {
      const value = urlCache[name];
      const file = files.find(file => file.name === name);
      if (file) {
        /* if (file.doc) {
          file.doc.setValue(value);
        } */
        file.blob = new Blob([value], {
          type: 'application/javascript',
        });
      } else {
        console.warn('could not find compiled file updat target', {files, name, urlCache});
      }
    }
    // console.log('compiled', startUrlFile.blob, urlCache);
    // startUrlFile.blob = ;
  } else {
    console.warn('could not find start file');
  }
  for (const file of files) {
    zip.file(file.name, file.blob);
  }
  const ab = await zip.generateAsync({
    type: 'arraybuffer',
  });
  // console.log('got b', ab);
  const uint8Array = new Uint8Array(ab);
  return uint8Array;
};
const uploadHash = async () => {
  // console.log('collect zip 1');
  const zipData = await collectZip();
  // console.log('collect zip 2');
  const files = await fetchZipFiles(zipData);
  const hash = await uploadFiles(files);
  // console.log('got hash', hash);
  return hash;
};
const run = async () => {
  const hash = await uploadHash();
  // console.log('load hash', hash);
  // const el = await loadModule(u);
  await loadHash(hash);
};
let loadedObject = null;
const loadHash = async hash => {
  if (loadedObject) {
    await world.removeObject(loadedObject.instanceId);
    loadedObject = null;
  }

  const u = `${storageHost}/ipfs/${hash}/.metaversefile`;
  const position = new THREE.Vector3();
  const quaternion  = new THREE.Quaternion();
  loadedObject = await world.addObject(u, null, position, quaternion, {
    // physics,
    // physics_url,
    // autoScale,
  });
  loadedObject.name = loadedObject.contentId.match(/([^\/]*)$/)[1];
};
const mintNft = async () => {
  const hash = await uploadHash();
  console.log('upload nft', hash);
  window.location.href = `https://webaverse.com/mint?hash=${hash}&ext=metaversefile`;
};

window.onload = async () => {

const bindTextarea = codeEl => {
  const editor = CodeMirror.fromTextArea(codeEl, {
    lineNumbers: true,
    styleActiveLine: true,
    matchBrackets: true,
    lineWrapping: true,
    extraKeys: {
      'Ctrl-S': async cm => {
        try {
          await run();
        } catch (err) {
          console.warn(err);
          const errors = [err].concat(getErrors());
          setErrors(errors);
        }
      },
      'Ctrl-L': async cm => {
        try {
          await mintNft();
        } catch (err) {
          console.warn(err);
          const errors = [err].concat(getErrors());
          setErrors(errors);
        }
      },
    },
  });
  {
    const stopPropagation = e => {
      e.stopPropagation();
    };
    [
      'wheel',
      'keydown',
      'keypress',
      'keyup',
      'paste',
    ].forEach(n => {
      editor.display.wrapper.addEventListener(n, stopPropagation);
    });
  }
  // console.log('got editor', editor);
  editor.setOption('theme', 'material');
  // editor.setOption('theme', 'material-ocean');
  // editor.setOption('theme', 'icecoder');
  /* editor.on('keydown', e => {
    if (e.ctrlKey && e.which === 83) { // ctrl-s
      console.log('got save', e);
      e.preventDefault();
    }
  }); */
  return editor;
};
{
  const container = document.getElementById('container');
  
  const jsx = await (async () => {
    const res = await fetch('./editor.jsx');
    const s = await res.text();
    return s;
  })();
  
  const reset = () => {
    console.log('reset');
  };
  let cameraMode = 'camera';
  const setCameraMode = newCameraMode => {
    cameraMode = newCameraMode;
    console.log('got new camera mode', {cameraMode});
    if (cameraMode === 'avatar') {
      app.setAvatarUrl(`https://webaverse.github.io/assets/sacks3.vrm`, 'vrm');
    } else {
      app.setAvatarUrl(null);
    }
  };
  const spec = Babel.transform(jsx, {
    presets: ['react'],
    // compact: false,
  });
  const {code} = spec;
  // console.log('got code', code);
  const fn = eval(code);
  // console.log('got fn', fn);
  
  ReactDOM.render(
    React.createElement(fn),
    container
  );
}

const app = new App();
// app.bootstrapFromUrl(location);
app.bindLogin();
app.bindInput();
app.bindInterface();
const canvas = document.getElementById('canvas');
app.bindCanvas(canvas);
/* const uploadFileInput = document.getElementById('upload-file-input');
app.bindUploadFileInput(uploadFileInput);
const mapCanvas = document.getElementById('map-canvas')
app.bindMinimap(mapCanvas);

const enterXrButton = document.getElementById('enter-xr-button');
const noXrButton = document.getElementById('no-xr-button');
app.bindXr({
  enterXrButton,
  noXrButton,
  onSupported(ok) {
    if (ok) {
      enterXrButton.style.display = null;
      noXrButton.style.display = 'none';
    }
  },
}); */
app.waitForLoad()
  .then(async () => {
    app.contentLoaded = true;
    app.startLoop();
    
    // hacks
    {
      const scene = app.getScene();
        
      const g = new CameraGeometry();
      const m = new THREE.MeshBasicMaterial({
        color: 0x333333,
      });
      const cameraMesh = new THREE.Mesh(g, m);
      cameraMesh.position.set(0, 2, -5);
      cameraMesh.frustumCulled = false;
      scene.add(cameraMesh);

      const uiMesh = _makeUiMesh();
      uiMesh.position.set(0, 2, -5);
      uiMesh.frustumCulled = false;
      scene.add(uiMesh);

      const inventoryMesh = _makeInventoryMesh();
      inventoryMesh.position.set(2, 1.2, -1);
      inventoryMesh.frustumCulled = false;
      scene.add(inventoryMesh);
      app.addEventListener('frame', () => {
        inventoryMesh.update();
      });
      
      const loaderMesh = _makeLoaderMesh();
      loaderMesh.position.set(0, 1.2, -1);
      loaderMesh.frustumCulled = false;
      scene.add(loaderMesh);
      app.addEventListener('frame', () => {
        loaderMesh.update();
      });
    }
    
    const defaultScene = [
      {
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
        u: `https://avaer.github.io/home/home.glb`,
      },
      {
        position: new THREE.Vector3(-3, 0, -2),
        quaternion: new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(-1, 0, 0),
        ),
        u: `https://webaverse.github.io/assets/table.glb`,
      },
      {
        position: new THREE.Vector3(2, 0, -3),
        quaternion: new THREE.Quaternion()/* .setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(-1, 0, 0),
        ) */,
        u: `https://avaer.github.io/mirror/index.js`,
      },
      {
        position: new THREE.Vector3(-1, 1.5, -1.5),
        quaternion: new THREE.Quaternion(),
        u: `https://silk.webaverse.com/index.t.js`,
      },
      /* {
        position: new THREE.Vector3(-3, 1.5, -1),
        quaternion: new THREE.Quaternion(),
        u: `https://avaer.github.io/lightsaber/manifest.json`,
      },
      {
        position: new THREE.Vector3(-3, 1.5, -2),
        quaternion: new THREE.Quaternion(),
        u: `https://avaer.github.io/hookshot/index.js`,
      }, */
    ];
    for (const e of defaultScene) {
      const {position, quaternion, u} = e;
      const loadedObject = await world.addObject(u, null, position, quaternion, {
        // physics,
        // physics_url,
        // autoScale,
      });
      loadedObject.name = u.match(/([^\/]*)$/)[1];
    }
  });

// make sure to update renderer when canvas size changes
const ro = new ResizeObserver(entries => {
  const resizeEvent = new UIEvent('resize');
  window.dispatchEvent(resizeEvent);
});
ro.observe(canvas);

const renderer = app.getRenderer();
const scene = app.getScene();
const camera = app.getCamera();

// console.log('got react three fiber', ReactThreeFiber);

};