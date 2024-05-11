import { device } from "../webgpu";
import { CellGroupRenderer } from "./render";
import { CellGroupStepper } from "./step";

export class CellGroup {
  public readonly cellStateBuffers: [GPUBuffer, GPUBuffer];
  public activeCellStateBuffer: GPUBuffer;
  public get inactiveCellStateBuffer(): GPUBuffer {
    return this.cellStateBuffers[
      (this.cellStateBuffers.indexOf(this.activeCellStateBuffer) + 1) % 2
    ];
  }

  private readonly renderer: CellGroupRenderer;
  private readonly stepper: CellGroupStepper;

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

    this.cellStateBuffers = [
      device.createBuffer({
        label: "cell state a",
        size: byteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      device.createBuffer({
        label: "cell state b",
        size: byteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
    this.activeCellStateBuffer = this.cellStateBuffers[0];

    this.renderer = new CellGroupRenderer(this);
    this.stepper = new CellGroupStepper(this);
  }

  public render(context: GPUCanvasContext) {
    this.renderer.render(context);
  }

  public step() {
    this.stepper.step();
  }

  public async initialize(bits: number[], buffer = this.activeCellStateBuffer) {
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
      buffer,
      0,
      data.byteLength
    );

    device.queue.submit([commandEncoder.finish()]);

    uploadBuffer.destroy();
  }
}
