@group(0) @binding(0) var<storage, read_write> data: array<u32>;

struct VertexOutput {
  @builtin(position) pos: vec4<f32>,
}

@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
  let pos = array(
    vec2f(-1.0,  3.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0, -1.0),
  );

  // data[0] = 0;

  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment fn fs(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.pos.x / 32.0, in.pos.y / 32.0, 0.0, 1.0);
}
