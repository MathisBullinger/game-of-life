## Timings 1024 x 124 grid

### `f119893` (workgroup size = 1)

. | .
-|-
fps | 60.1
dispatch | 1024x32=1056
gpu step | 7.41ms
gpu render | 209.7µs

### `0e05075` (workgroup size > 1)

#### workgroup size = 64,1,1

. | .
-|-
fps | 60.0
dispatch | 512
gpu step | 419.4µs
gpu render | 144.2µs

#### workgroup size = 128,1,1

. | .
-|-
fps | 60.1
dispatch | 256
gpu step | 408.5µs
gpu render | 137.6µs

#### workgroup size = 256,1,1

. | .
-|-
fps | 60.2
dispatch | 128
gpu step | 436.9µs
gpu render | 139.8µs
