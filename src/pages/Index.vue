<script setup lang="ts">
//@ts-nocheck
import { ref, onMounted, computed } from "vue";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { useRafFn } from "@vueuse/core";
import { onKeyStroke } from "@vueuse/core";

import { draw } from "../utils/draw";
import { mapObject } from "../utils/objects";
import { center } from "../utils/utils";

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const predictions = ref<cocoSsd.DetectedObject[] | OnErrorEventHandlerNonNull>(
  null
);
const width = ref(0);
const height = ref(0);
const objects = ref([]);
const playing = ref(false);

const overlayOpacity = ref(0.2);
const dotsOpacity = ref(1);
const lineCount = ref(2);
const prob = ref(0.5);
const onlyPersons = ref(1);
const minDev = 30;
const maxDev = ref(minDev);
const showOverlay = ref(true);

onKeyStroke("o", (e) => {
  showOverlay.value = !showOverlay.value;
});

onMounted(async () => {
  // const devices = await navigator.mediaDevices.enumerateDevices();
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: {
      fps: 10,
      // deviceId:
      //   "4e51f67844f0d40aa0a002fe8d8413faf5230dd328d8235f6b9b87d9ad9dfb1c",
    },
  });
  videoRef.value.srcObject = videoStream;

  videoRef.value.addEventListener("loadedmetadata", (e) => {
    width.value = e.target.videoWidth;
    height.value = e.target.videoHeight;
  });

  videoRef.value.addEventListener("playing", (e) => {
    playing.value = true;
  });

  videoRef.value.addEventListener("seeking", (e) => {
    playing.value = false;
  });

  const ctx = canvasRef.value.getContext("2d");

  const model = await cocoSsd.load();

  let frameCount = 0;
  const limit = 60;
  const HAVE_ENOUGH_DATA = 4;

  useRafFn(async () => {
    if (videoRef.value?.readyState === HAVE_ENOUGH_DATA) {
      predictions.value = await model.detect(videoRef.value, 100, prob.value);

      if (predictions.value) {
        predictions.value
          .map((p) => {
            p.center = center(p.bbox);
            return p;
          })
          .filter((p) => (onlyPersons.value ? p.class === "person" : true))
          .map((p) => mapObject(p, objects, maxDev));

        ctx.drawImage(videoRef.value, 0, 0, width.value, height.value);
        ctx.fillStyle = `rgba(0,0,0,${overlayOpacity.value})`;
        ctx.fillRect(0, 0, width.value, height.value);
        draw(ctx, objects, dotsOpacity, lineCount);

        if (frameCount > limit) {
          //objects.value = [];
          frameCount = 0;
        } else {
          frameCount++;
        }
        if (videoRef.value.currentTime > 2) {
          //videoRef.value.currentTime = 0;
        }
      }
    }
  });
});
</script>

<template>
  <div>
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      style="width: 100vw; transform: scale(1, 1)"
    ></canvas>
    <!-- <video
      ref="videoRef"
      autoplay
      muted
      loop
      src="/sample3.mp4"
      style="width: 50vw"
    /> -->
    <p>Status: {{ playing ? "Playing" : "Not playing" }}</p>
    <p v-if="!predictions">Loading...</p>
    <div
      style="
        opacity: 1;
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 200px;
        padding: 20px;
        /* background: #000000dd; */
        font-family: monospace;
        color: rgba(255, 255, 255, 1);
      "
    >
      <video ref="videoRef" autoplay muted loop style="width: 150px" />
      <p />
      <div v-show="showOverlay">
        <div>overlayOpacity {{ overlayOpacity }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="overlayOpacity"
          max="1"
          step="0.01"
        />
        <br />
        <div>dotsOpacity {{ dotsOpacity }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="dotsOpacity"
          max="1"
          step="0.01"
        />
        <br />
        <div>LinCount {{ lineCount }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="lineCount"
          max="50"
        />
        <br />
        <div>detectionProbability {{ prob }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="prob"
          min="0.01"
          max="1"
          step="0.01"
        />
        <br />
        <div>stillnessThresold {{ maxDev }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="maxDev"
          :min="minDev"
        />
        <br />
        <div>Detect: {{ ["Only persons", "All items"][1 - onlyPersons] }}</div>
        <input
          style="width: 100%; display: block"
          type="range"
          v-model="onlyPersons"
          max="1"
        />
      </div>
    </div>
  </div>
</template>
