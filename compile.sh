#!/bin/bash

# emcc test.c -o out.wasm -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_repitchAndStretch']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1