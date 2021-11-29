import { line, curveCatmullRomClosed } from "d3-shape";
import { map } from "./utils";

export function draw(ctx, objects, dotsOpacity, lineCount) {
  ctx.font = "20px Arial";
  objects.value.forEach((o, i) => {
    o.buffer.forEach((b, j) => {
      ctx.fillStyle = `hsl(60,100%,50%,${0.05 * dotsOpacity.value})`;
      ctx.beginPath();
      ctx.arc(b[0], b[1], 10 + j * (o.still ? 2 : 0.5), 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();
    });
    if (o.still) {
      //     ctx.lineWidth = 5;
      //     // ctx.strokeStyle = "red";
      //      ctx.arc(...o.currentCenter, 50, 0, 2 * Math.PI);
      //      ctx.stroke();
    }
    ctx.lineWidth = map(lineCount.value, 0, 50, 10, 5);
    ctx.strokeStyle = `rgba(255,255,0,${map(
      lineCount.value,
      0,
      50,
      0.1,
      0.08
    )})`;
    const obj = objects.value
      .filter((oo) => oo.still)
      .map((oo) => oo.currentCenter);
    Array.from({ length: lineCount.value })
      .map((_, i) => (Math.random() - 0.75) * (1.0005 * i))
      .forEach((a) =>
        line().curve(curveCatmullRomClosed.alpha(a)).context(ctx)(obj)
      );
    ctx.stroke();
    ctx.closePath();
  });
}
