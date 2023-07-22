const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

function openFile(event) {
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;

  const playback = document.getElementById("playback");
  playback.src = URL.createObjectURL(file);

  const reader = new FileReader();
  reader.onload = setUpAudioContext;
  reader.readAsArrayBuffer(file);
}

// Dont do this in the async route, do it first and do the async upon each change. fix this later once done checking if it works
function setUpAudioContext(event) {
  const audioContext = new AudioContext();
  audioContext.decodeAudioData(event.target.result).then((val) => sendToWasm(val));
}

// THIS IS ALL VERY MESSY and only to test that it works, must rewrite with a sensible flow of events after
function sendToWasm(audioBuffer) {
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);
  
  const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
  const memoryFloat32View = new Float32Array(memory.buffer);
  const memoryUint8View = new Uint8Array(memory.buffer);
  const importObject = {env: {memory: memory, emscripten_notify_memory_growth: growMemory}};
  WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject).then(source => {
    let inputPointer = source.instance.exports.allocateInputMemory(leftChannel.length);
    console.log(inputPointer);
    
    memoryUint8View.set(leftChannel, inputPointer); // should this be memoryfloat32 view but divide input pointer by 4 or how does it work
    let outputPointer = source.instance.exports.repitchAndStretch(inputPointer, leftChannel.length, 1.5, -5);
    console.log(outputPointer);
    
    // Again this nested promises code is very messy and also WONT WORK for updating multiple times, this is just for testing but rewrite to create the required readers and contexts and worklets at the start and set up callbackls for each update as appropriate and properly do all the async/promise/callback etc stuff
  });
}

// Write C function to allocate memory for input given length first and return pointer
// JS uses that pointer, copies the f32 samples into Wasm memory there, then sends that to repitchAndStretch
// Then uses the pointer for the output it gets to copy it back into something to play audio
// (And calls the functions needed to FREE result, and also make the C code free input, maybe in repitchAndStretch itself once done with it)

const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-label");
pitchSlider.addEventListener("input", (e) => pitchLabel.innerText = pitchSlider.value);
pitchSlider.addEventListener("change", updateAudio);

const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-label");
const timeFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeSlider.addEventListener("input", (e) => timeLabel.innerText = timeFormat.format(timeSlider.value));
timeSlider.addEventListener("change", updateAudio);

function updateAudio() {
  console.log(`${pitchSlider.value}, ${timeSlider.value}`);
}

const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const memoryFloat32View = new Float32Array(memory.buffer);
const memoryUint8View = new Uint8Array(memory.buffer);
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: growMemory}};
WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject).then(useWasm);

function useWasm(source) {
  // const exports = source.instance.exports;
  // console.log(exports.repitchAndStretch());
}

function growMemory() {
  // Handle memory growth
}
