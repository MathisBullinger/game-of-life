import shaderSrc from "../shaders/update-cells.wgsl?raw";
import type { CellGroup } from "./cell-group";
import { device } from "../webgpu";

export class CellGroupStepper {
  static readonly shaderModule = device.createShaderModule({
    code: shaderSrc,
  });
  private readonly uniformBuffer: GPUBuffer;

  constructor(private readonly cellGroup: CellGroup) {
    this.uniformBuffer = device.createBuffer({
      size: 2 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Uint32Array([cellGroup.width, cellGroup.height])
    );
  }

  public step() {
    const bindGroup = device.createBindGroup({
      label: "cell bind group",
      layout: CellGroupStepper.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        {
          binding: 1,
          resource: { buffer: this.cellGroup.activeCellStateBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.cellGroup.inactiveCellStateBuffer },
        },
      ],
    });

    const encoder = device.createCommandEncoder({ label: "cell step encoder" });
    const pass = encoder.beginComputePass();
    pass.setPipeline(CellGroupStepper.pipeline);
    pass.setBindGroup(0, bindGroup);
    console.log("step dispatch", this.cellGroup.width, this.cellGroup.height);
    pass.dispatchWorkgroups(this.cellGroup.width, this.cellGroup.height);
    pass.end();
    device.queue.submit([encoder.finish()]);

    this.cellGroup.activeCellStateBuffer =
      this.cellGroup.inactiveCellStateBuffer;
  }

  static bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });

  static pipeline = device.createComputePipeline({
    label: "step cell pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [CellGroupStepper.bindGroupLayout],
    }),
    compute: {
      module: device.createShaderModule({
        label: "cell step module",
        code: shaderSrc,
      }),
    },
  });
}
