const adapter = await navigator.gpu?.requestAdapter();

const device = await adapter?.requestDevice()!;
if (!device) throw new Error("browser does not support WebGPU");

export { device };
