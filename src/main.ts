import { CellGroup } from "./cell-group/cell-group";
import { device } from "./webgpu";

const width = 1024;
const height = width;

const initialBits = Array(width * height).fill(0);

// for (let i = 0; i < 5e4; i++) {
//   const x = Math.floor(Math.random() * width);
//   const y = Math.floor(Math.random() * height);
//   initialBits[y * width + x] = 1;
// }

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

const stepCounter = document.querySelector<HTMLSpanElement>(".step-count")!;
const fpsCounter = document.querySelector<HTMLSpanElement>(".fps-count")!;

let gen = 0;
let lastUpdate: number | null = null;

const step = () => {
  const now = performance.now();
  if (lastUpdate !== null) {
    const dt = now - lastUpdate;
    fpsCounter.innerText = (1000 / dt).toFixed(1);
  }
  lastUpdate = now;

  cellGroup.step();
  cellGroup.render(context);
  stepCounter.innerText = `${++gen}`;
};

let stop: (() => void) | null = null;
const run = async () => {
  let running = true;
  stop = () => {
    running = false;
    stop = null;
  };

  while (running) {
    step();
    await new Promise(requestAnimationFrame);
  }
};

window.addEventListener("click", () => {
  if (stop) stop();
  else run();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    step();
  }
});
