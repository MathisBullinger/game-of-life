import { CellGroup } from "./cell-group/cell-group";
import { device } from "./webgpu";

const width = 64;
const height = width;

const initialBits = Array(width * height).fill(0);

for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    const dx = width / 2 - x;
    const dy = height / 2 - y;
    const mag = Math.sqrt(dx ** 2 + dy ** 2);
    if (Math.abs(mag - width * 0.4) < 0.5) {
      initialBits[y * width + x] = 1;
    }
    if (Math.abs(x - width / 2) === Math.abs(y - height / 2)) {
      initialBits[y * width + x] = 1;
    }
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      initialBits[y * width + x] = 1;
    }
  }
}

const cellGroup = new CellGroup(width, height);
await cellGroup.initialize(initialBits);

const canvas = document.querySelector("canvas")!;
canvas.width = width;
canvas.height = height;

const context = canvas.getContext("webgpu");
if (!context) throw new Error("failed to get webgpu context");
context.configure({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
});

cellGroup.render(context);
await new Promise((res) => setTimeout(res, 1000));
cellGroup.step();
await new Promise((res) => setTimeout(res, 1000));
cellGroup.render(context);
