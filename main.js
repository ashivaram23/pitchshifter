const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: growMemory}};
const wasmSource = WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject);

const audioContext = new AudioContext();
const playback = document.getElementById("playback");
let originalAudioBuffer;

const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

function openFile(event) {
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;
  playback.src = URL.createObjectURL(file);

  const reader = new FileReader();
  reader.onload = (e) => {
    audioContext.decodeAudioData(e.target.result).then((audioBuffer) => {
      originalAudioBuffer = audioBuffer;
      processAudioBuffer(audioBuffer);
    });
  };
  reader.readAsArrayBuffer(file);

  // Maybe deal with allocating the input memory for wasm module here (and only free it with another method when new file opened), so same thing can be accessed
}

async function processAudioBuffer(audioBuffer) {
  // Do both channels properly and then send back to playback src (or change playback to be custom audiocontext play instead of basic html audio), make downloadable, etc
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);

  await wasmSource.then(source => {
    let inputPointer = source.instance.exports.allocateInputMemory(leftChannel.length);
    console.log(inputPointer);
    
    new Float32Array(memory.buffer).set(leftChannel, inputPointer / 4);
    let outputPointer = source.instance.exports.repitchAndStretch(inputPointer, leftChannel.length, timeSlider.value, pitchSlider.value);
    console.log(outputPointer);
    let outputLength = new Int32Array(memory.buffer)[outputPointer / 4];
    let outputDataPointer = new Int32Array(memory.buffer)[1 + (outputPointer / 4)];
    console.log(outputLength);
    console.log(outputDataPointer);

    console.log(new Float32Array(memory.buffer)[outputDataPointer / 4]);

    const outputDataInMemory = new Float32Array(memory.buffer, outputDataPointer, outputLength);
    const outputDataCopy = new ArrayBuffer(outputLength * 4);
    new Float32Array(outputDataCopy).set(outputDataInMemory);

    source.instance.exports.freeAllocatedMemory(outputPointer); // Comment this out to cause the memory growth errors in console and fix them independently, since those should be prevented regardless, then add this back in

    const bufferSource = audioContext.createBufferSource();
    let newAudioBuf = audioContext.createBuffer(1, outputLength, 44100);
    newAudioBuf.copyFromChannel(new Float32Array(outputDataCopy), 0, 0);
    bufferSource.buffer = newAudioBuf;
    bufferSource.connect(audioContext.destination);
    bufferSource.start(audioContext.currentTime);
    console.log(newAudioBuf);
  });
}

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
  // DONT do this. Buffer will get "detached" at least on firefox, instead store either before step or after step's _
  if (originalAudioArrayBuffer != undefined) {
    audioContext.decodeAudioData(originalAudioArrayBuffer).then((audioBuffer) => processAudioBuffer(audioBuffer));
    console.log(`${pitchSlider.value}, ${timeSlider.value}`);
  }
}

function growMemory() {
  memoryFloat32View = new Float32Array(memory.buffer);
  // Handle memory growth
}
