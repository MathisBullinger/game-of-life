struct Uniforms {
  width: u32,
  height: u32
}

@group(0) @binding(0) var<storage, read_write> cells: array<u32>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) pos: vec4<f32>,
}

@vertex 
fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f(-1.0,  3.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0, -1.0),
  );

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

const size = 64;

@fragment 
fn fs(in: VertexOutput) -> @location(0) vec4f {
  let x = u32(in.pos.x);
  let y = u32(in.pos.y);

  let bitIndex = y * uniforms.width + x;
  let u32Index = bitIndex / 32;

  let u32Value = cells[u32Index];

  let bitOffset = bitIndex % 32;
  let bitMask = 1u << bitOffset;
  let bitValue = ((u32Value & bitMask) >> bitOffset) & 1u;

  let cl = f32(bitValue);

  return vec4(cl, cl, cl, 1.0);
}
