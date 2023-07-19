const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

function openFile(event) {
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;

  const playback = document.getElementById("playback");
  playback.setAttribute("src", URL.createObjectURL(file));

  // Get it into an array? / audio context? etc somehow and console log the type (Float32 should be) and size of it
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

// File to (offline?) audio context
// Check that accessing it as needed for processing works like an array of size 44100*sec, float32 uncompressed etc
// Allow playback with button etc
// How to connect with audio worker?
// How to send that to wasm
// Write some basic C++ -> wasm to test processing audio array and replaying back works well and FAST
// Then two currents of tasks: (1) the C++ part for translating the wsola, and (2) the js part for making the interface all work and properly moving the audio around to the module and back
