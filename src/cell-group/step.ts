import shaderSrc from "../shaders/update-cells.wgsl?raw";
import type { CellGroup } from "./cell-group";
import { RollingAverage, Timing, device } from "../webgpu";
import { formatTime } from "../format-time";

const gpuStepSpan = document.querySelector<HTMLSpanElement>(".gpu-step-time")!;
const dispatchCount =
  document.querySelector<HTMLSpanElement>(".dispatch-count")!;

export class CellGroupStepper {
  static readonly shaderModule = device.createShaderModule({
    code: shaderSrc,
  });
  private readonly uniformBuffer: GPUBuffer;
  private readonly timing = new Timing();
  private readonly timingAvg = new RollingAverage();

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

  public async step() {
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
    const pass = this.timing.beginComputePass(encoder);
    pass.setPipeline(CellGroupStepper.pipeline);
    pass.setBindGroup(0, bindGroup);
    const dispatches = [
      Math.ceil((this.cellGroup.width * this.cellGroup.height) / 32 / 64),
    ] as const;
    pass.dispatchWorkgroups(...dispatches);

    dispatchCount.innerText = [
      dispatches.join("x"),
      dispatches.length > 1 ? dispatches.reduce((a, c) => a + c, 0) : null,
    ]
      .filter(Boolean)
      .join("=");

    pass.end();
    device.queue.submit([encoder.finish()]);

    this.cellGroup.activeCellStateBuffer =
      this.cellGroup.inactiveCellStateBuffer;

    this.timingAvg.addSample(await this.timing.getResult());
    gpuStepSpan.innerText = formatTime(this.timingAvg.get(), "ns");
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
