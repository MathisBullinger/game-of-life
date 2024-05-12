struct Uniforms {
  width: u32,
  height: u32
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> cellsCurrent: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellsUpdated: array<u32>;

const chunkWidth = 64;
const chunkHeight = 1;

@compute @workgroup_size(chunkWidth, chunkHeight, 1)
fn updateCells(
  @builtin(global_invocation_id) global_invocation_id: vec3u
) {
  let indexU32 = global_invocation_id.y * uniforms.width + global_invocation_id.x;
  let countU32 = (uniforms.width * uniforms.height) / 32;
  if (indexU32 >= countU32) {
    return;
  }

  let currentU32 = cellsCurrent[indexU32];

  var updatedU32: u32 = 0u;

  for (var i = 0u; i < 32u; i += 1u) {
    let bitIndex = indexU32 * 32 + i;
    let x = bitIndex % uniforms.width;
    let y = bitIndex / uniforms.width;
    let currentBit = readBit(x, y);

    let updatedBit = stepCell(x, y);

    if (updatedBit == 1u) {
      updatedU32 = updatedU32 | (1u << i);
    }
  }

  cellsUpdated[indexU32] = updatedU32;
}

fn readBit(x: u32, y: u32) -> u32 {
  let bitIndex = y * uniforms.width + x;
  let valU32 = cellsCurrent[bitIndex / 32];
  let valBit = (valU32 >> (bitIndex % 32)) & 1;
  return valBit;
}

fn stepCell(x: u32, y: u32) -> u32 {
  var livingNeighborCount = 0u;

  for (var ix = max(x - 1, 0); ix <= min(x + 1, uniforms.width - 1); ix += 1) {
    for (var iy = max(y - 1, 0); iy <= min(y + 1, uniforms.height - 1); iy += 1) {
      if (ix == x && iy == y) {
        continue;
      }
      if (readBit(ix, iy) == 1) {
        livingNeighborCount += 1;
      }
    }
  }

  if (livingNeighborCount < 2 || livingNeighborCount > 3) {
    return 0;
  }
  
  if (livingNeighborCount == 3) { 
    return 1u;
  }

  return readBit(x, y);
}
