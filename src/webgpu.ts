const adapter = await navigator.gpu?.requestAdapter();

export const canTimestamp = adapter?.features.has("timestamp-query") ?? false;

const device = await adapter?.requestDevice({
  requiredFeatures: [...(canTimestamp ? (["timestamp-query"] as const) : [])],
})!;
if (!device) throw new Error("browser does not support WebGPU");

export { device };

export class Timing {
  public static readonly canTimestamp = canTimestamp;

  #querySet = device.createQuerySet({
    type: "timestamp",
    count: 2,
  });

  #resolveBuffer = device.createBuffer({
    size: this.#querySet.count * 8,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
  #resultBuffer?: GPUBuffer;
  #resultBuffers: GPUBuffer[] = [];

  #state: "free" | "need resolve" | "pending" = "free";

  #beginTimestampPass<T extends "beginRenderPass" | "beginComputePass">(
    encoder: GPUCommandEncoder,
    fnName: T,
    descriptor: Parameters<GPUCommandEncoder[T]>[0]
  ): ReturnType<GPUCommandEncoder[T]> {
    if (!Timing.canTimestamp) return encoder[fnName](descriptor as any) as any;

    if (this.#state !== "free") throw new Error("timing state not free");

    this.#state = "need resolve";

    const pass = encoder[fnName]({
      ...descriptor,
      ...({
        timestampWrites: {
          querySet: this.#querySet,
          beginningOfPassWriteIndex: 0,
          endOfPassWriteIndex: 1,
        },
      } as any),
    });

    const resolve = () => this.#resolveTiming(encoder);
    const passEnd = pass.end.bind(pass);
    pass.end = () => {
      passEnd();
      resolve();
    };

    return pass as any;
  }

  beginRenderPass(
    encoder: GPUCommandEncoder,
    descriptor: GPURenderPassDescriptor
  ) {
    return this.#beginTimestampPass(encoder, "beginRenderPass", descriptor);
  }

  beginComputePass(
    encoder: GPUCommandEncoder,
    descriptor: GPUComputePassDescriptor = {}
  ) {
    return this.#beginTimestampPass(encoder, "beginComputePass", descriptor);
  }

  #resolveTiming(encoder: GPUCommandEncoder) {
    if (!Timing.canTimestamp) return;

    if (this.#state !== "need resolve") {
      throw new Error("must call addTimstampToPass");
    }
    this.#state = "pending";

    this.#resultBuffer =
      this.#resultBuffers.pop() ||
      device.createBuffer({
        size: this.#resolveBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

    encoder.resolveQuerySet(
      this.#querySet,
      0,
      this.#querySet.count,
      this.#resolveBuffer,
      0
    );
    encoder.copyBufferToBuffer(
      this.#resolveBuffer,
      0,
      this.#resultBuffer,
      0,
      this.#resultBuffer.size
    );
  }

  async getResult() {
    if (!Timing.canTimestamp) return 0;
    if (this.#state !== "pending") throw new Error("must call resolveTiming");
    this.#state = "free";

    const resultBuffer = this.#resultBuffer!;
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigInt64Array(resultBuffer.getMappedRange());
    const duration = Number(times[1] - times[0]);
    resultBuffer.unmap();
    this.#resultBuffers.push(resultBuffer);
    return duration;
  }
}

export class RollingAverage {
  #total = 0;
  #samples: number[] = [];
  #cursor = 0;
  #numSamples: number;

  constructor(numSamples = 30) {
    this.#numSamples = numSamples;
  }

  addSample(v: number) {
    this.#total += v - (this.#samples[this.#cursor] || 0);
    this.#samples[this.#cursor] = v;
    this.#cursor = (this.#cursor + 1) % this.#numSamples;
  }

  get() {
    return this.#total / this.#samples.length;
  }
}
