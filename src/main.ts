import shaderSrc from "./shaders/render-cells.wgsl?raw";

const adapter = await navigator.gpu?.requestAdapter();

const device = await adapter?.requestDevice();
if (!device) throw new Error("browser does not support WebGPU");

const commandEncoder = device.createCommandEncoder();

type CellStateBufferOpts = {
  label?: string;
  width: number;
  height: number;
  initialBits: number[];
};

const createCellStateBuffer = async ({
  label = "cell state",
  width,
  height,
  initialBits,
}: CellStateBufferOpts) => {
  const bitSize = width * height;
  if (bitSize % 8) {
    throw new Error("Cell state buffer width x height must be multiple of 8!");
  }
  const byteSize = bitSize / 8;
  if (byteSize % 4) {
    throw new Error("Cell state buffer byte size must be multiple of 4!");
  }

  const cellStateBuffer = device.createBuffer({
    label,
    size: byteSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const dataU32 = Array((width * height) / 8 / 4).fill(0n);

  for (let i = 0; i < initialBits.length; i++) {
    const u32Index = Math.floor(i / 8 / 4);
    const bitIndex = BigInt(i % (8 * 4));
    if (initialBits[i]) {
      dataU32[u32Index] = dataU32[u32Index] | (1n << bitIndex);
    }
  }

  console.log({ dataU32 });

  const data = new Uint32Array(dataU32.map((n) => Number(n)));

  const uploadBuffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
  });

  await uploadBuffer.mapAsync(GPUMapMode.WRITE);
  new Uint32Array(uploadBuffer.getMappedRange()).set(data);
  uploadBuffer.unmap();

  commandEncoder.copyBufferToBuffer(
    uploadBuffer,
    0,
    cellStateBuffer,
    0,
    data.byteLength
  );
  console.log("byte length:", data.byteLength);

  const commandBuffer = commandEncoder.finish();
  device.queue.submit([commandBuffer]);

  return cellStateBuffer;
};

const width = 256;
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

const cellStateBuffer = await createCellStateBuffer({
  width,
  height,
  initialBits,
});

const uniformBuffer = device.createBuffer({
  size: 2 * 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, new Uint32Array([width, height]));

const canvas = document.querySelector("canvas")!;
canvas.width = width;
canvas.height = height;

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

const renderPassDescriptor = {
  label: "render pass cells",
  colorAttachments: [
    {
      clearValue: [1, 1, 1, 1],
      loadOp: "clear",
      storeOp: "store",
    },
  ],
} as any;

const bindGroupLayout = device.createBindGroupLayout({
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "storage" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
  ],
});

const bindGroup = device.createBindGroup({
  label: "bind group for cells",
  layout: bindGroupLayout,
  entries: [
    { binding: 0, resource: { buffer: cellStateBuffer } },
    { binding: 1, resource: { buffer: uniformBuffer } },
  ],
});

const pipeline = device.createRenderPipeline({
  label: "render cells pipeline",
  layout: device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  }),
  vertex: {
    module,
  },
  fragment: {
    module,
    targets: [{ format: presentationFormat }],
  },
});

function render() {
  renderPassDescriptor.colorAttachments[0].view = context!
    .getCurrentTexture()
    .createView();

  const encoder = device!.createCommandEncoder({ label: "render cells" });

  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(3);
  pass.end();

  const commandBuffer = encoder.finish();
  device!.queue.submit([commandBuffer]);
}

render();
