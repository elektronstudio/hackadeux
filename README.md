```ts
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";

import * as cocoSsd from "@tensorflow-models/coco-ssd";

import imageURL from "./image1.jpg";
import image2URL from "./image2.jpg";

let modelPromise;

window.onload = () => (modelPromise = cocoSsd.load());

const button = document.getElementById("toggle");
button.onclick = () => {
  image.src = image.src.endsWith(imageURL) ? image2URL : imageURL;
};

const select = document.getElementById("base_model");
select.onchange = async (event) => {
  const model = await modelPromise;
  model.dispose();
  modelPromise = cocoSsd.load({
    base: event.srcElement.options[event.srcElement.selectedIndex].value,
  });
};

const image = document.getElementById("image");
image.src = imageURL;

const runButton = document.getElementById("run");
runButton.onclick = async () => {
  const model = await modelPromise;
  console.log("model loaded");
  console.time("predict1");
  const result = await model.detect(image);
  console.timeEnd("predict1");

  const c = document.getElementById("canvas");
  const context = c.getContext("2d");
  context.drawImage(image, 0, 0);
  context.font = "10px Arial";

  console.log("number of detections: ", result.length);
  for (let i = 0; i < result.length; i++) {
    context.beginPath();
    context.rect(...result[i].bbox);
    context.lineWidth = 1;
    context.strokeStyle = "green";
    context.fillStyle = "green";
    context.stroke();
    context.fillText(
      result[i].score.toFixed(3) + " " + result[i].class,
      result[i].bbox[0],
      result[i].bbox[1] > 10 ? result[i].bbox[1] - 5 : 10
    );
  }
};
```

...

```vue
<template>
  <div id="app">
    <h3 v-if="!isVideoStreamReady && !initFailMessage">
      Initializing webcam stream ...
    </h3>
    <h3 v-if="!isModelReady && !initFailMessage">loading model ...</h3>
    <h3 v-if="initFailMessage">
      Failed to init stream and/or model - {{ initFailMessage }}
    </h3>

    <div class="resultFrame">
      <video ref="video" autoplay></video>
      <canvas ref="canvas" :width="resultWidth" :height="resultHeight"></canvas>
    </div>

    <select v-model="baseModel" @change="loadModelAndStartDetecting">
      <option
        v-for="modelName in selectableModels"
        :key="modelName"
        :value="modelName"
      >
        {{ modelName }}
      </option>
    </select>
  </div>
</template>

<script>
import * as cocoSsd from "@tensorflow-models/coco-ssd";
export default {
  name: "app",
  data() {
    return {
      // store the promises of initialization
      streamPromise: null,
      modelPromise: null,
      // control the UI visibilities
      isVideoStreamReady: false,
      isModelReady: false,
      initFailMessage: "",
      // tfjs model related
      model: null,
      baseModel: "lite_mobilenet_v2",
      selectableModels: ["lite_mobilenet_v2", "mobilenet_v1", "mobilenet_v2"],
      videoRatio: 1,
      resultWidth: 0,
      resultHeight: 0,
    };
  },
  methods: {
    initWebcamStream() {
      // if the browser supports mediaDevices.getUserMedia API
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return navigator.mediaDevices
          .getUserMedia({
            audio: false, // don't capture audio
            video: { facingMode: "environment" }, // use the rear camera if there is
          })
          .then((stream) => {
            // set <video> source as the webcam input
            let video = this.$refs.video;
            try {
              video.srcObject = stream;
            } catch (error) {
              // support older browsers
              video.src = URL.createObjectURL(stream);
            }
            /*
              model.detect uses tf.fromPixels to create tensors.
              tf.fromPixels api will get the <video> size from the width and height attributes,
                which means <video> width and height attributes needs to be set before called model.detect
              To make the <video> responsive, I get the initial video ratio when it's loaded (onloadedmetadata)
              Then addEventListener on resize, which will adjust the size but remain the ratio
              At last, resolve the Promise.
            */
            return new Promise((resolve, reject) => {
              // when video is loaded
              video.onloadedmetadata = () => {
                // calculate the video ratio
                this.videoRatio = video.offsetHeight / video.offsetWidth;
                // add event listener on resize to reset the <video> and <canvas> sizes
                window.addEventListener("resize", this.setResultSize);
                // set the initial size
                this.setResultSize();
                this.isVideoStreamReady = true;
                console.log("webcam stream initialized");
                resolve();
              };
            });
          })
          .catch((error) => {
            console.log("failed to initialize webcam stream", error);
            throw error;
          });
      } else {
        return Promise.reject(
          new Error(
            "Your browser does not support mediaDevices.getUserMedia API"
          )
        );
      }
    },
    setResultSize() {
      // get the current browser window size
      let clientWidth = document.documentElement.clientWidth;
      // set max width as 600
      this.resultWidth = Math.min(600, clientWidth);
      // set the height according to the video ratio
      this.resultHeight = this.resultWidth * this.videoRatio;
      // set <video> width and height
      /*
        Doesn't use vue binding :width and :height,
          because the initial value of resultWidth and resultHeight
          will affect the ratio got from the initWebcamStream()
      */
      let video = this.$refs.video;
      video.width = this.resultWidth;
      video.height = this.resultHeight;
    },
    loadModel() {
      this.isModelReady = false;
      // if model already exists => dispose it and load a new one
      if (this.model) this.model.dispose();
      // load model with the baseModel
      return cocoSsd
        .load(this.baseModel)
        .then((model) => {
          this.model = model;
          this.isModelReady = true;
          console.log("model loaded");
        })
        .catch((error) => {
          console.log("failed to load the model", error);
          throw error;
        });
    },
    async detectObjects() {
      if (!this.isModelReady) return;
      let predictions = await this.model.detect(this.$refs.video);
      this.renderPredictions(predictions);
      requestAnimationFrame(() => {
        this.detectObjects();
      });
    },
    loadModelAndStartDetecting() {
      this.modelPromise = this.loadModel();
      // wait for both stream and model promise finished
      // => start detecting objects
      Promise.all([this.streamPromise, this.modelPromise])
        .then(() => {
          this.detectObjects();
        })
        .catch((error) => {
          console.log("Failed to init stream and/or model");
          this.initFailMessage = error;
        });
    },
    renderPredictions(predictions) {
      // get the context of canvas
      const ctx = this.$refs.canvas.getContext("2d");
      // clear the canvas
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      predictions.forEach((prediction) => {
        ctx.beginPath();
        ctx.rect(...prediction.bbox);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "red";
        ctx.fillStyle = "red";
        ctx.stroke();
        ctx.shadowColor = "white";
        ctx.shadowBlur = 10;
        ctx.font = "24px Arial bold";
        ctx.fillText(
          `${(prediction.score * 100).toFixed(1)}% ${prediction.class}`,
          prediction.bbox[0],
          prediction.bbox[1] > 10 ? prediction.bbox[1] - 5 : 10
        );
      });
    },
  },
  mounted() {
    this.streamPromise = this.initWebcamStream();
    this.loadModelAndStartDetecting();
  },
};
</script>

<style lang="scss">
body {
  margin: 0;
}
.resultFrame {
  display: grid;
  video {
    grid-area: 1 / 1 / 2 / 2;
  }
  canvas {
    grid-area: 1 / 1 / 2 / 2;
  }
}
</style>
```

---

````js
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import * as tfjsWasm from "@tensorflow/tfjs-backend-wasm";
import * as tf from "@tensorflow/tfjs-core";
import Stats from "stats.js";

import { TRIANGULATION } from "./triangulation";

tfjsWasm.setWasmPaths(
  `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${tfjsWasm.version_wasm}/dist/`
);

const NUM_KEYPOINTS = 468;
const NUM_IRIS_KEYPOINTS = 5;
const GREEN = "#32EEDB";
const RED = "#FF2C35";
const BLUE = "#157AB3";
let stopRendering = false;

function isMobile() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return isAndroid || isiOS;
}

function distance(a, b) {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

function drawPath(ctx, points, closePath) {
  const region = new Path2D();
  region.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    region.lineTo(point[0], point[1]);
  }

  if (closePath) {
    region.closePath();
  }
  ctx.stroke(region);
}

let model,
  ctx,
  videoWidth,
  videoHeight,
  video,
  canvas,
  scatterGLHasInitialized = false,
  scatterGL,
  rafID;

const VIDEO_SIZE = 500;
const mobile = isMobile();
// Don't render the point cloud on mobile in order to maximize performance and
// to avoid crowding limited screen space.
const renderPointcloud = mobile === false;
const stats = new Stats();
const state = {
  backend: "webgl",
  maxFaces: 1,
  triangulateMesh: true,
  predictIrises: true,
};

if (renderPointcloud) {
  state.renderPointcloud = true;
}

function setupDatGui() {
  const gui = new dat.GUI();
  gui
    .add(state, "backend", ["webgl", "wasm", "cpu"])
    .onChange(async (backend) => {
      stopRendering = true;
      window.cancelAnimationFrame(rafID);
      await tf.setBackend(backend);
      stopRendering = false;
      requestAnimationFrame(renderPrediction);
    });

  gui.add(state, "maxFaces", 1, 20, 1).onChange(async (val) => {
    model = await faceLandmarksDetection.load(
      faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
      { maxFaces: val }
    );
  });

  gui.add(state, "triangulateMesh");
  gui.add(state, "predictIrises");

  if (renderPointcloud) {
    gui.add(state, "renderPointcloud").onChange((render) => {
      document.querySelector("#scatter-gl-container").style.display = render
        ? "inline-block"
        : "none";
    });
  }
}

async function setupCamera() {
  video = document.getElementById("video");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      // Only setting the video to a specified size in order to accommodate a
      // point cloud, so on mobile devices accept the default size.
      width: mobile ? undefined : VIDEO_SIZE,
      height: mobile ? undefined : VIDEO_SIZE,
    },
  });
  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

async function renderPrediction() {
  if (stopRendering) {
    return;
  }

  stats.begin();

  const predictions = await model.estimateFaces({
    input: video,
    returnTensors: false,
    flipHorizontal: false,
    predictIrises: state.predictIrises,
  });
  ctx.drawImage(
    video,
    0,
    0,
    videoWidth,
    videoHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (predictions.length > 0) {
    predictions.forEach((prediction) => {
      const keypoints = prediction.scaledMesh;

      if (state.triangulateMesh) {
        ctx.strokeStyle = GREEN;
        ctx.lineWidth = 0.5;

        for (let i = 0; i < TRIANGULATION.length / 3; i++) {
          const points = [
            TRIANGULATION[i * 3],
            TRIANGULATION[i * 3 + 1],
            TRIANGULATION[i * 3 + 2],
          ].map((index) => keypoints[index]);

          drawPath(ctx, points, true);
        }
      } else {
        ctx.fillStyle = GREEN;

        for (let i = 0; i < NUM_KEYPOINTS; i++) {
          const x = keypoints[i][0];
          const y = keypoints[i][1];

          ctx.beginPath();
          ctx.arc(x, y, 1 /* radius */, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      if (keypoints.length > NUM_KEYPOINTS) {
        ctx.strokeStyle = RED;
        ctx.lineWidth = 1;

        const leftCenter = keypoints[NUM_KEYPOINTS];
        const leftDiameterY = distance(
          keypoints[NUM_KEYPOINTS + 4],
          keypoints[NUM_KEYPOINTS + 2]
        );
        const leftDiameterX = distance(
          keypoints[NUM_KEYPOINTS + 3],
          keypoints[NUM_KEYPOINTS + 1]
        );

        ctx.beginPath();
        ctx.ellipse(
          leftCenter[0],
          leftCenter[1],
          leftDiameterX / 2,
          leftDiameterY / 2,
          0,
          0,
          2 * Math.PI
        );
        ctx.stroke();

        if (keypoints.length > NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS) {
          const rightCenter = keypoints[NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS];
          const rightDiameterY = distance(
            keypoints[NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS + 2],
            keypoints[NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS + 4]
          );
          const rightDiameterX = distance(
            keypoints[NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS + 3],
            keypoints[NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS + 1]
          );

          ctx.beginPath();
          ctx.ellipse(
            rightCenter[0],
            rightCenter[1],
            rightDiameterX / 2,
            rightDiameterY / 2,
            0,
            0,
            2 * Math.PI
          );
          ctx.stroke();
        }
      }
    });

    if (renderPointcloud && state.renderPointcloud && scatterGL != null) {
      const pointsData = predictions.map((prediction) => {
        let scaledMesh = prediction.scaledMesh;
        return scaledMesh.map((point) => [-point[0], -point[1], -point[2]]);
      });

      let flattenedPointsData = [];
      for (let i = 0; i < pointsData.length; i++) {
        flattenedPointsData = flattenedPointsData.concat(pointsData[i]);
      }
      const dataset = new ScatterGL.Dataset(flattenedPointsData);

      if (!scatterGLHasInitialized) {
        scatterGL.setPointColorer((i) => {
          if (i % (NUM_KEYPOINTS + NUM_IRIS_KEYPOINTS * 2) > NUM_KEYPOINTS) {
            return RED;
          }
          return BLUE;
        });
        scatterGL.render(dataset);
      } else {
        scatterGL.updateDataset(dataset);
      }
      scatterGLHasInitialized = true;
    }
  }

  stats.end();
  rafID = requestAnimationFrame(renderPrediction);
}

async function main() {
  await tf.setBackend(state.backend);
  setupDatGui();

  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  document.getElementById("main").appendChild(stats.dom);

  await setupCamera();
  video.play();
  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;
  video.width = videoWidth;
  video.height = videoHeight;

  canvas = document.getElementById("output");
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const canvasContainer = document.querySelector(".canvas-wrapper");
  canvasContainer.style = `width: ${videoWidth}px; height: ${videoHeight}px`;

  ctx = canvas.getContext("2d");
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = GREEN;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 0.5;

  model = await faceLandmarksDetection.load(
    faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
    { maxFaces: state.maxFaces }
  );
  renderPrediction();

  if (renderPointcloud) {
    document.querySelector(
      "#scatter-gl-container"
    ).style = `width: ${VIDEO_SIZE}px; height: ${VIDEO_SIZE}px;`;

    scatterGL = new ScatterGL(document.querySelector("#scatter-gl-container"), {
      rotateOnStart: false,
      selectEnabled: false,
    });
  }
}

main();

---

# Usage

This package adds a WebAssembly backend to TensorFlow.js. It currently supports
the following models from our
[models](https://github.com/tensorflow/tfjs-models) repo:
- BlazeFace
- BodyPix
- CocoSSD
- Face landmarks detection
- HandPose
- KNN classifier
- MobileNet
- PoseDetection
- Q&A
- AutoML Image classification
- AutoML Object detection

## Importing the backend

### Via NPM

```js
// Import @tensorflow/tfjs or @tensorflow/tfjs-core
import * as tf from '@tensorflow/tfjs';
// Adds the WASM backend to the global backend registry.
import '@tensorflow/tfjs-backend-wasm';
// Set the backend to WASM and wait for the module to be ready.
tf.setBackend('wasm').then(() => main());
````

### Via a script tag

```html
<!-- Import @tensorflow/tfjs or @tensorflow/tfjs-core -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"></script>

<!-- Adds the WASM backend to the global backend registry -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tf-backend-wasm.js"></script>
<script>
  tf.setBackend("wasm").then(() => main());
</script>
```

## Setting up cross-origin isolation

Starting from Chrome 92 (to be released around July 2021), **cross-origin
isolation** needs to be set up in your site in order to take advantage of
the multi-threading support in WASM backend. Without this, the backend
will fallback to the WASM binary with SIMD-only support (or the vanila version
if SIMD is not enabled). Without multi-threading support, certain models might
not achieve the best performance.

Here are the high-level steps to set up the cross-origin isolation. You can
learn more about this topic [here](https://web.dev/coop-coep/).

1. Send the following two HTTP headers when your main document (e.g.index.html)
   that uses the WASM backend is served. You may need to configure or ask your
   web host provider to enable these headers.

   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

1. If you are loading the WASM backend from `jsdelivr` through the script tag,
   you are good to go. No more steps are needed.

   If you are loading the WASM backend from your own or other third-party
   servers, you need to make sure the script is served with either CORS or CORP
   header.

   - CORS header: `Access-Control-Allow-Origin: *`. In addition, you will also
     need to add the "crossorigin" attribute to your script tags.

   - CORP header:

     - If the resource is loaded from the _same origin_ as your main site
       (e.g. main site: mysite.com/, script: mysite.com/script.js), set:

       `Cross-Origin-Resource-Policy: same-origin`

     - If the resource is loaded from the _same site but cross origin_
       (e.g. main site: mysite.com/, script: static.mysite.com:8080/script.js),
       set:

       `Cross-Origin-Resource-Policy: same-site`

     - If the resource is loaded from the _cross origin(s)_
       (e.g. main site: mysite.com/, script: mystatic.com/script.js), set:

       `Cross-Origin-Resource-Policy: cross-origin`

If the steps above are correctly done, you can check the Network tab from the
console and make sure the
<code>tfjs-backend-wasm-<b>threaded-simd</b>.wasm</code> WASM binary is loaded.

## Threads count

By default, the backend will use the number of logical CPU cores as the
threads count when creating the threadpool used by XNNPACK. You can use the
`setThreadsCount` API to manually set it (must be called before calling
`tf.setBackend('wasm')`). `getThreadsCount` API can be used to get the actual
number of threads being used (must be called after the WASM backend is
initialized).

### Via NPM

```js
import * as tf from "@tensorflow/tfjs";
import {
  getThreadsCount,
  setThreadsCount,
} from "@tensorflow/tfjs-backend-wasm";

setThreadsCount(2);
tf.setBackend("wasm").then(() => {
  console.log(getThreadsCount());
});
```

### Via script tag

```js
tf.wasm.setThreadsCount(2);
tf.setBackend("wasm").then(() => {
  consosle.log(tf.wasm.getThreadsCount());
});
```

## Running MobileNet

```js
async function main() {
  let img = tf.browser
    .fromPixels(document.getElementById("img"))
    .resizeBilinear([224, 224])
    .expandDims(0)
    .toFloat();

  let model = await tf.loadGraphModel(
    "https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/2",
    { fromTFHub: true }
  );
  const y = model.predict(img);

  y.print();
}
main();
```

Our WASM backend builds on top of the
[XNNPACK library](https://github.com/google/XNNPACK) which provides
high-efficiency floating-point neural network inference operators.

## Using bundlers

The shipped library on NPM consists of 2 files:

- the main js file (bundled js for browsers)
- the WebAssembly binary in `dist/tfjs-backend-wasm.wasm`

There is a [proposal](https://github.com/WebAssembly/esm-integration) to add
WASM support for ES6 modules. In the meantime, we have to manually read the wasm
file. When the WASM backend is initialized, we make a `fetch`/`readFile`
for `tfjs-backend-wasm.wasm` relative from the main js file. This means that
bundlers such as Parcel and WebPack need to be able to serve the `.wasm` file in
production. See [starter/parcel](./starter/parcel/) and
[starter/webpack](./starter/webpack/) for how to setup your favorite bundler.

If you are serving the `.wasm` files from a different directory, call
`setWasmPaths` with the location of that directory before you initialize the
backend:

```ts
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
// setWasmPaths accepts a `prefixOrFileMap` argument which can be either a
// string or an object. If passing in a string, this indicates the path to
// the directory where your WASM binaries are located.
setWasmPaths('www.yourdomain.com/');
tf.setBackend('wasm').then(() => {...});
```

If the WASM backend is imported through `<script>` tag, `setWasmPaths` needs to
be called on the `tf.wasm` object:

```ts
tf.wasm.setWasmPaths("www.yourdomain.com/");
```

Note that if you call `setWasmPaths` with a string, it will be used to load
each binary (SIMD-enabled, threading-enabled, etc.) Alternatively you can specify
overrides for individual WASM binaries via a file map object. This is also helpful
in case your binaries have been renamed.

For example:

```ts
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
setWasmPaths({
  'tfjs-backend-wasm.wasm': 'www.yourdomain.com/renamed.wasm',
  'tfjs-backend-wasm-simd.wasm': 'www.yourdomain.com/renamed-simd.wasm',
  'tfjs-backend-wasm-threaded-simd.wasm': 'www.yourdomain.com/renamed-threaded-simd.wasm'
  });
tf.setBackend('wasm').then(() => {...});
```

If you are using a platform that does not support fetch directly, please set the
optional `usePlatformFetch` argument to `true`:

```ts
import {setWasmPath} from '@tensorflow/tfjs-backend-wasm';
const usePlatformFetch = true;
setWasmPaths(yourCustomPathPrefix, usePlatformFetch);
tf.setBackend('wasm').then(() => {...});
```

## JS Minification

If your bundler is capable of minifying JS code, please turn off the option
that transforms `typeof foo == "undefined"` into `foo === void 0`. For
example, in [terser](https://github.com/terser/terser), the option is called
"typeofs" (located under the
[Compress options](https://github.com/terser/terser#compress-options) section).
Without this feature turned off, the minified code will throw "\_scriptDir is not
defined" error from web workers when running in browsers with
SIMD+multi-threading support.

## Use with Angular

If you see the `Cannot find name 'EmscriptenModule'` error when building your
Angular app, make sure to add `"@types/emscripten"` to the
`compilerOptions.types` field in your `tsconfig.app.json` (or `tsconfig.json`):

```
{
  ...
  "compilerOptions": {
    "types": [
      "@types/emscripten"
    ]
  },
  ...
}
```

By default, the generated Angular app sets this field to an empty array
which will prevent the Angular compiler from automatically adding
"global types" (such as `EmscriptenModule`) defined in `d.ts` files to your app.

## Benchmarks

The benchmarks below show inference times (ms) for two different edge-friendly
models: MobileNet V2 (a medium-sized model) and Face Detector (a lite model).
All the benchmarks were run in Chrome 79.0 using
[this benchmark page](../tfjs-core/benchmarks/index.html) across our three
backends: Plain JS (CPU), WebGL and WASM. Inference times are averaged
across 200 runs.

### MobileNet V2

MobileNet is a medium-sized model with 3.48M params and ~300M multiply-adds.
For this model, the WASM backend is between ~3X-11.5X faster than the plain
JS backend, and ~5.3-7.7X slower than the WebGL backend.

<img src="./mobilenet-v2-bench.png" width="750">

| MobileNet inference (ms) | WASM  | WebGL | Plain JS | WASM + SIMD | WASM + SIMD + threads |
| ------------------------ | ----- | ----- | -------- | ----------- | --------------------- |
| iPhone X                 | 147.1 | 20.3  | 941.3    | N/A         | N/A                   |
| iPhone XS                | 140   | 18.1  | 426.4    | N/A         | N/A                   |
| Pixel 4                  | 182   | 76.4  | 1628     | 82          | N/A                   |
| ThinkPad X1 Gen6 w/Linux | 122.7 | 44.8  | 1489.4   | 34.6        | 12.4                  |
| Desktop Windows          | 123.1 | 41.6  | 1117     | 37.2        | N/A                   |
| Macbook Pro 15 2019      | 98.4  | 19.6  | 893.5    | 30.2        | 10.3                  |
| Node v.14 on Macbook Pro | 290   | N/A   | 1404.3   | 64.2        | N/A                   |

### Face Detector

Face detector is a lite model with 0.1M params and ~20M multiply-adds. For this model,
the WASM backend is between ~8.2-19.8X faster than the plain JS backend and
comparable to the WebGL backend (up to ~1.7X faster, or 2X slower, depending on
the device).

<img src="./face-detector-bench.png" width="750">

| Face Detector inference (ms) | WASM | WebGL | Plain JS | WASM + SIMD | WASM + SIMD + threads |
| ---------------------------- | ---- | ----- | -------- | ----------- | --------------------- |
| iPhone X                     | 22.4 | 13.5  | 318      | N/A         | N/A                   |
| iPhone XS                    | 21.4 | 10.5  | 176.9    | N/A         | N/A                   |
| Pixel 4                      | 28   | 28    | 368      | 15.9        | N/A                   |
| Desktop Linux                | 12.6 | 12.7  | 249.5    | 8.0         | 6.2                   |
| Desktop Windows              | 16.2 | 7.1   | 270.9    | 7.5         | N/A                   |
| Macbook Pro 15 2019          | 13.6 | 22.7  | 209.1    | 7.9         | 4.0                   |

# FAQ

### When should I use the WASM backend?

You should always try to use the WASM backend over the plain JS backend since
it is strictly faster on all devices, across all model sizes.
Compared to the WebGL backend, the WASM backend has better numerical stability,
and wider device support. Performance-wise, our benchmarks show that:

- For medium-sized models (~100-500M multiply-adds), the WASM backend is several
  times slower than the WebGL backend.
- For lite models (~20-60M multiply-adds), the WASM backend has comparable
  performance to the WebGL backend
  (see the [Face Detector model](#face-detector) above).

We are committed to supporting the WASM backend and will continue to improve
performance. We plan to follow the WebAssembly standard closely and benefit from
its upcoming features such as multi-threading.

### How many ops have you implemented?

See [`register_all_kernels.ts`](https://github.com/tensorflow/tfjs/blob/master/tfjs-backend-wasm/src/register_all_kernels.ts)
for an up-to-date list of supported ops. We love contributions. See the
[contributing](https://github.com/tensorflow/tfjs/blob/master/CONTRIBUTING.md#adding-functionality)
document for more info.

### Do you support training?

Maybe. There are still a decent number of ops that we are missing in WASM that
are needed for gradient computation. At this point we are focused on making
inference as fast as possible.

### Do you work in node?

Yes. If you run into issues, please let us know.

### Do you support SIMD and multi-threading?

Yes. We take advantage of SIMD and multi-threading wherever they are supported by testing the capabilities of your runtime and loading the appropriate WASM binary. If you intend to serve the WASM binaries from a custom location (via `setWasmPaths`), please note that the SIMD-enabled and threading-enabled binaries are separate from the regular binary.

### How do I give feedback?

We'd love your feedback as we develop this backend! Please file an issue
[here](https://github.com/tensorflow/tfjs/issues/new).

# Development

## Emscripten installation

The Emscripten installation necessary to build the WASM backend is managed automatically by the [Bazel Emscripten Toolchain](https://github.com/emscripten-core/emsdk/tree/master/bazel).

## Building

```sh
yarn build
```

## Testing

```sh
yarn test
```

## Deployment

```sh
./scripts/build-npm.sh
npm publish
```
