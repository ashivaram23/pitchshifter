const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

function openFile(event) {
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;

  const playback = document.getElementById("playback");
  playback.setAttribute("src", URL.createObjectURL(file));
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
  console.log(`${pitchSlider.value}, ${timeSlider.value}`);
}

const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const memoryFloat32View = new Float32Array(memory.buffer);
const memoryInt32View = new Int32Array(memory.buffer);
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: growMemory}};
WebAssembly.instantiateStreaming(fetch("out.wasm"), importObject).then(useWasm);

function useWasm(source) {
  const exports = source.instance.exports;
  console.log(exports.repitchAndStretch(0, 0, 0.0, 0));
}

function growMemory() {
  // Handle memory growth
}
