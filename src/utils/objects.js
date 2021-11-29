import standardDeviation from "just-standard-deviation";
import { pointInsideCircle } from "./utils";

const bufferSize = 20;

export function mapObject(p, objects, maxDev) {
  const objectIndex = objects.value.findIndex((o) =>
    pointInsideCircle(...p.center, ...o.center, 150)
  );
  if (objectIndex > -1) {
    objects.value[objectIndex].currentCenter = p.center;
    if (objects.value[objectIndex].buffer.length > bufferSize - 1) {
      objects.value[objectIndex].buffer.shift();
    }
    objects.value[objectIndex].buffer.push(p.center);
    objects.value[objectIndex].xDev = standardDeviation(
      objects.value[objectIndex].buffer.map(([x, y]) => x)
    );
    objects.value[objectIndex].yDev = standardDeviation(
      objects.value[objectIndex].buffer.map(([x, y]) => y)
    );
    objects.value[objectIndex].still =
      objects.value[objectIndex].xDev < maxDev.value;
  } else {
    objects.value.forEach((_, i) => (objects.value[i].updated = false));
    objects.value.push({
      ...p,
      currentCenter: p.center,
      updated: true,
      buffer: [p.center],
      still: false,
    });
  }
}
