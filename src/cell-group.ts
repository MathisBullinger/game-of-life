import shaderSrc from "./shaders/render-cells.wgsl?raw";
import { device } from "./webgpu";

export class CellGroup {
  private readonly cellStateBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  static readonly shaderModule = device.createShaderModule({
    code: shaderSrc,
  });
  private static presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  constructor(
    public readonly width: number,
    public readonly height: number
  ) {
    const bitSize = width * height;
    if (bitSize % 8) {
      throw new Error(
        "Cell state buffer width x height must be multiple of 8!"
      );
    }
    const byteSize = bitSize / 8;
    if (byteSize % 4) {
      throw new Error("Cell state buffer byte size must be multiple of 4!");
    }

    this.cellStateBuffer = device.createBuffer({
      label: "cell state",
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const uniformBuffer = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Uint32Array([width, height])
    );

    this.bindGroup = device.createBindGroup({
      label: "bind group for cells",
      layout: CellGroup.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cellStateBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
  }

  public render(context: GPUCanvasContext) {
    const commandEncoder = device.createCommandEncoder({
      label: "render cell group",
    });

    const renderPass = commandEncoder.beginRenderPass({
      label: "render pass cells",
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [1, 1, 1, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(CellGroup.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  static bindGroupLayout = device.createBindGroupLayout({
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

  static renderPipeline = device.createRenderPipeline({
    label: "render cells pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [CellGroup.bindGroupLayout],
    }),
    vertex: {
      module: CellGroup.shaderModule,
    },
    fragment: {
      module: CellGroup.shaderModule,
      targets: [{ format: CellGroup.presentationFormat }],
    },
  });

  public async initialize(bits: number[]) {
    if (bits.length !== this.width * this.height) {
      throw new Error(
        `${this.width}x${this.height} cell group must have ${this.width * this.height} bits`
      );
    }

    const dataU32 = Array((this.width * this.height) / 32).fill(0n);

    for (let i = 0; i < bits.length; i++) {
      const u32Index = Math.floor(i / 8 / 4);
      const bitIndex = BigInt(i % (8 * 4));
      if (bits[i]) {
        dataU32[u32Index] = dataU32[u32Index] | (1n << bitIndex);
      }
    }

    const data = new Uint32Array(dataU32.map((n) => Number(n)));

    const uploadBuffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
    });

    await uploadBuffer.mapAsync(GPUMapMode.WRITE);
    new Uint32Array(uploadBuffer.getMappedRange()).set(data);
    uploadBuffer.unmap();

    const commandEncoder = device.createCommandEncoder({
      label: "initialize cell buffer",
    });
    commandEncoder.copyBufferToBuffer(
      uploadBuffer,
      0,
      this.cellStateBuffer,
      0,
      data.byteLength
    );

    device.queue.submit([commandEncoder.finish()]);
  }
}
