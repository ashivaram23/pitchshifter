let originalAudioChannels = []

const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: notifyMemoryGrowth}};
const wasmSource = WebAssembly.instantiateStreaming(fetch("repitch-autovec.wasm"), importObject).catch(() => {
  console.log("Using module without simd");
  return WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject);
});

onmessage = (message) => {
  if (message.data.action == "load") {
    originalAudioChannels = message.data.channelData;
    postMessage({action: "load"});
  } else if (message.data.action == "process") {
    processAudioBuffer(message.data.repitchSettings).catch((reason) => console.log(reason));
  }
};

async function processAudioBuffer(settings) {
  if (originalAudioChannels.length == 0) {
    postMessage({action: "process"});
    return;
  }

  const startTime = performance.now();
  const source = await wasmSource;
  let newAudioChannels = [];
  
  for (let i = 0; i < originalAudioChannels.length; i++) {
    const channelData = new Float32Array(originalAudioChannels[i]);
    const inputPointer = source.instance.exports.allocateInputMemory(channelData.length);
    new Float32Array(memory.buffer).set(channelData, inputPointer / 4);

    const outputPointer = source.instance.exports.repitchAndStretch(inputPointer, channelData.length, settings.stretch, settings.semitones, settings.segmentLengthMs, settings.outputOffsetMs, settings.maxShiftMs);
    const outputLength = new Int32Array(memory.buffer)[outputPointer / 4];
    const outputDataPointer = new Int32Array(memory.buffer)[1 + (outputPointer / 4)];

    const outputDataInMemory = new Float32Array(memory.buffer, outputDataPointer, outputLength);
    const outputDataCopy = new ArrayBuffer(outputLength * 4);
    new Float32Array(outputDataCopy).set(outputDataInMemory);
    source.instance.exports.freeAllocatedMemory(outputPointer);

    newAudioChannels.push(outputDataCopy);
  }
  
  console.log(`Returned ${Math.round(newAudioChannels[0].byteLength / (441 * 4)) / 100} s audio in ${Math.round(performance.now() - startTime) / 1000} s`);
  postMessage({action: "process", transfer: newAudioChannels}, newAudioChannels);
}

function notifyMemoryGrowth() {
  console.log("Growing WebAssembly memory");
}
