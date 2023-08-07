#!/bin/bash

emcc repitch.c -o repitch.wasm -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_allocateInputMemory','_repitchAndStretch','_freeAllocatedMemory']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1
emcc repitch.c -o repitch-autovec.wasm -msimd128 -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_allocateInputMemory','_repitchAndStretch','_freeAllocatedMemory']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1
emcc repitchsimd.c -o repitch-intrinsics.wasm -msimd128 -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_allocateInputMemory','_repitchAndStretch','_freeAllocatedMemory']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1
