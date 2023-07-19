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

// emcc test.cpp -o out.wasm -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_repitchAndStretch']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1
const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const memoryView = new Float32Array(memory.buffer);
const importObject = {env: {memory: memory}}; // add memory base to be consistent, see the names used on MDN 
WebAssembly.instantiateStreaming(fetch("out1.wasm"), importObject).then(useWasm);

function useWasm(source) {
  console.log(source.instance.exports);
  memoryView[0] = 8;
  console.log(memoryView[0]);
  console.log(source.instance.exports.testMethod(0, 1, 2));
  console.log(memoryView[0]);
}

// emcc test.c -o out1.wasm -O3 --no-entry -s "EXPORTED_FUNCTIONS=['_testMethod']" -s IMPORTED_MEMORY=1 -s ALLOW_MEMORY_GROWTH=1
