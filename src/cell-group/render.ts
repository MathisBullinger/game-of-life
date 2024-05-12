import shaderSrc from "../shaders/render-cells.wgsl?raw";
import type { CellGroup } from "./cell-group";
import { RollingAverage, Timing, device } from "../webgpu";
import { formatTime } from "../format-time";

const gpuRenderSpan =
  document.querySelector<HTMLSpanElement>(".gpu-render-time")!;

export class CellGroupRenderer {
  private static presentationFormat = navigator.gpu.getPreferredCanvasFormat();
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

  public async render(context: GPUCanvasContext) {
    const commandEncoder = device.createCommandEncoder({
      label: "render cell group",
    });

    const renderPass = this.timing.beginRenderPass(commandEncoder, {
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

    const bindGroup = device.createBindGroup({
      label: "bind group for cells",
      layout: CellGroupRenderer.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.cellGroup.activeCellStateBuffer },
        },
        { binding: 1, resource: { buffer: this.uniformBuffer } },
      ],
    });

    renderPass.setPipeline(CellGroupRenderer.renderPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    this.timingAvg.addSample(await this.timing.getResult());
    gpuRenderSpan.innerText = formatTime(this.timingAvg.get(), "ns");
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
      bindGroupLayouts: [CellGroupRenderer.bindGroupLayout],
    }),
    vertex: {
      module: CellGroupRenderer.shaderModule,
    },
    fragment: {
      module: CellGroupRenderer.shaderModule,
      targets: [{ format: CellGroupRenderer.presentationFormat }],
    },
  });
}
