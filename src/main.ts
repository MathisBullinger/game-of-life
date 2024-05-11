import shaderSrc from "./shaders/render-cells.wgsl?raw";

const adapter = await navigator.gpu?.requestAdapter();

const device = await adapter?.requestDevice();
if (!device) throw new Error("browser does not support WebGPU");

const commandEncoder = device.createCommandEncoder();

const createCellStateBuffer = (width: number, height: number) => {
  if ((width * height) % 8) {
    throw new Error(`buffer width * height must be divisible by 8`);
  }
  const byteSize = (width * height) / 8;
  if (byteSize % 4) {
    throw new Error("buffer byte size must be multiple of 4");
  }
  return device.createBuffer({
    label: "cell state",
    mappedAtCreation: true,
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
};

const bufferWidth = 32;
const bufferHeight = 32;

const gameState = [...Array(2)].map(() =>
  createCellStateBuffer(bufferWidth, bufferHeight)
);

const readBuffer = async (gpuBuffer: GPUBuffer) => {
  if (gpuBuffer.mapState !== "mapped") {
    await gpuBuffer.mapAsync(GPUMapMode.READ);
  }
  const mapped = gpuBuffer.getMappedRange().slice(0);
  gpuBuffer.unmap();
  return mapped;
};

const writeCellStateBuffer = async (
  gpuBuffer: GPUBuffer,
  activeBits: number[]
) => {
  const bufferBytes = new Uint8Array(await readBuffer(gpuBuffer));
  for (const i of activeBits) {
    const byteIndex = Math.floor(i / 8);
    bufferBytes[byteIndex] = bufferBytes[byteIndex] | (1 << i % 8);
  }

  const copySrcBuffer = device.createBuffer({
    label: "copy-src",
    size: gpuBuffer.size,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(
    copySrcBuffer,
    0,
    bufferBytes
    // 0,
    // bufferBytes.byteLength
  );

  commandEncoder.copyBufferToBuffer(
    copySrcBuffer,
    0,
    gpuBuffer,
    0,
    copySrcBuffer.size
  );

  copySrcBuffer.destroy();
};

await writeCellStateBuffer(gameState[0], [3, 4, bufferWidth + 3]);

const canvas = document.querySelector("canvas")!;
canvas.width = bufferWidth;
canvas.height = bufferHeight;

const context = canvas.getContext("webgpu");
if (!context) throw new Error("failed to get webgpu context");
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: presentationFormat,
});

const module = device.createShaderModule({
  code: shaderSrc,
});

const pipeline = device.createRenderPipeline({
  label: "render cells pipeline",
  layout: "auto",
  vertex: {
    // entryPoint: "vs",
    module,
  },
  fragment: {
    // entryPoint: "fs",
    module,
    targets: [{ format: presentationFormat }],
  },
});

const renderPassDescriptor = {
  label: "render pass cells",
  colorAttachments: [
    {
      // view: context.getCurrentTexture().createView(),
      clearValue: [1, 1, 1, 1],
      loadOp: "clear",
      storeOp: "store",
    },
  ],
} as any;

const bindGroup = device.createBindGroup({
  label: "bind group for cells",
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: gameState[0] } }],
});

function render() {
  // Get the current texture from the canvas context and
  // set it as the texture to render to.
  renderPassDescriptor.colorAttachments[0].view = context!
    .getCurrentTexture()
    .createView();

  // make a command encoder to start encoding commands
  const encoder = device!.createCommandEncoder({ label: "our encoder" });

  // make a render pass encoder to encode render specific commands
  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  // pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();

  const commandBuffer = encoder.finish();
  device!.queue.submit([commandBuffer]);
}

render();
