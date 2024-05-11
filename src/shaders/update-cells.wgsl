struct Uniforms {
  width: u32,
  height: u32
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> cellsCurrent: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellsUpdated: array<u32>;

@compute @workgroup_size(1, 1, 1)
fn updateCells(
  @builtin(global_invocation_id) global_invocation_id: vec3u
) {
  // TODO: bit extraction & packing

  let indexU32 = global_invocation_id.y * uniforms.width + global_invocation_id.x;

  let currentU32 = cellsCurrent[indexU32];

  cellsUpdated[indexU32] = ~currentU32;
}

fn getVal() -> u32 {
  return 1u;
}
