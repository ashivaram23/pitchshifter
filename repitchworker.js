const audioContext = new AudioContext({sampleRate: 44100}); // Unfortunately this doesnt work since you cant use audiocontext in web worker, so going to have to decode in the main and somehow efficiently pass THAT to this...
let originalAudioBuffer;

const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: notifyMemoryGrowth}};
const wasmSource = WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject);

onmessage = (message) => {
  if (message.data.action == "decode") {
    decodeArrayBuffer(message.data.transfer).catch((reason) => console.log(reason));
  } else if (message.data.action == "process") {
    processAudioBuffer(message.data.repitchSettings).catch((reason) => console.log(reason));
  }
};

async function decodeArrayBuffer(buffer) {
  const audioBuffer = await audioContext.decodeAudioData(buffer);
  originalAudioBuffer = audioBuffer;

  const originalAudioDuration = audioBuffer.duration;
  postMessage({action: "decode", duration: originalAudioDuration});
}

async function processAudioBuffer(settings) {
  if (originalAudioBuffer == undefined) {
    postMessage({action: "process"});
    return;
  }

  const source = await wasmSource;
  let newAudioBuffer;
  
  for (let i = 0; i < originalAudioBuffer.numberOfChannels; i++) {
    const channelData = originalAudioBuffer.getChannelData(i);
    const inputPointer = source.instance.exports.allocateInputMemory(channelData.length);
    new Float32Array(memory.buffer).set(channelData, inputPointer / 4);

    const outputPointer = source.instance.exports.repitchAndStretch(inputPointer, channelData.length, settings.stretch, settings.semitones, settings.segmentLengthMs, settings.outputOffsetMs, settings.maxShiftMs);
    const outputLength = new Int32Array(memory.buffer)[outputPointer / 4];
    const outputDataPointer = new Int32Array(memory.buffer)[1 + (outputPointer / 4)];

    const outputDataInMemory = new Float32Array(memory.buffer, outputDataPointer, outputLength);
    const outputDataCopy = new ArrayBuffer(outputLength * 4);
    new Float32Array(outputDataCopy).set(outputDataInMemory);
    source.instance.exports.freeAllocatedMemory(outputPointer);

    if (newAudioBuffer == undefined) {
      newAudioBuffer = audioContext.createBuffer(originalAudioBuffer.numberOfChannels, outputLength, 44100); // This wont work either
    }

    newAudioBuffer.copyToChannel(new Float32Array(outputDataCopy), i, 0);
  } 
  
  postMessage({action: "process", transfer: newAudioBuffer}, [newAudioBuffer]); // this is an audio buffer you couldnt transfer it back in the first place anyway... so instead just let main own the audiobuffers, just transfer the arraybuffers (getChannelData's for each channel and new channel arraybuffers from this worker) back and forth, make a for loop in the main code for each channel and just send that here, will be messier of course
}

function notifyMemoryGrowth() {
  console.log("Growing WebAssembly memory");
}
