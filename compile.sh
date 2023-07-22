#!/bin/bash

emcc repitch.c -o repitch.wasm -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_allocateInputMemory','_repitchAndStretch','_freeAllocatedMemory']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1