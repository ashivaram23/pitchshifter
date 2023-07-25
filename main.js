// Check that browser supports key features here and add div to dom with message if not

const audioContext = new AudioContext();
let originalAudioBuffer;
let activeAudioBuffer;
let bufferSource;

const memory = new WebAssembly.Memory({initial: 256, maximum: 32768});
const importObject = {env: {memory: memory, emscripten_notify_memory_growth: growMemory}};
const wasmSource = WebAssembly.instantiateStreaming(fetch("repitch.wasm"), importObject);

const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

const playButton = document.getElementById("play");
playButton.addEventListener("click", playAudio);

const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-label");
pitchSlider.addEventListener("input", (e) => pitchLabel.innerText = pitchSlider.value);
pitchSlider.addEventListener("change", processAudioBuffer);

// const pitchNumber = document.getElementById("semitones-number");

const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-label");
const timeFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeSlider.addEventListener("input", (e) => timeLabel.innerText = timeFormat.format(timeSlider.value));
timeSlider.addEventListener("change", processAudioBuffer);
timeSlider.addEventListener("input", updateCanvas);

const canvas = document.getElementById("visualization");
const context = canvas.getContext("2d");
const canvasWidth = 600;
const canvasHeight = 200;
setupCanvas();
updateCanvas();

function openFile(event) {
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    audioContext.decodeAudioData(e.target.result).then((audioBuffer) => {
      originalAudioBuffer = audioBuffer;
      activeAudioBuffer = audioBuffer;
      processAudioBuffer();
    });
  };
  reader.readAsArrayBuffer(file);
}

function playAudio(event) {
  if (bufferSource != undefined) {
    bufferSource.disconnect(audioContext.destination);
  }
  bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = activeAudioBuffer;
  bufferSource.connect(audioContext.destination);
  bufferSource.start();
}

async function processAudioBuffer() {
  if (originalAudioBuffer == undefined) {
    return;
  }

  await wasmSource.then(source => {
    console.log("Loading..."); // Gray stuff out (like download button and playback bar) while this is processing
    let newAudioBuffer;
    
    for (let i = 0; i < originalAudioBuffer.numberOfChannels; i++) {
      const channelData = originalAudioBuffer.getChannelData(i);
      let inputPointer = source.instance.exports.allocateInputMemory(channelData.length);
      new Float32Array(memory.buffer).set(channelData, inputPointer / 4);

      let outputPointer = source.instance.exports.repitchAndStretch(inputPointer, channelData.length, timeSlider.value, pitchSlider.value);
      let outputLength = new Int32Array(memory.buffer)[outputPointer / 4];
      if (newAudioBuffer == undefined) {
        newAudioBuffer = audioContext.createBuffer(originalAudioBuffer.numberOfChannels, outputLength, 44100);
      }
      let outputDataPointer = new Int32Array(memory.buffer)[1 + (outputPointer / 4)];

      const outputDataInMemory = new Float32Array(memory.buffer, outputDataPointer, outputLength);
      const outputDataCopy = new ArrayBuffer(outputLength * 4);
      new Float32Array(outputDataCopy).set(outputDataInMemory);

      source.instance.exports.freeAllocatedMemory(outputPointer);
      newAudioBuffer.copyToChannel(new Float32Array(outputDataCopy), i, 0);
    } 
    
    activeAudioBuffer = newAudioBuffer;
    console.log("Done");
  });
}

function growMemory() {
  console.log("memory grow notify");
  // Handle memory growth
}

function setupCanvas() {
  canvas.style.width =  `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.width = canvasWidth * window.devicePixelRatio;
  canvas.height = canvasHeight * window.devicePixelRatio;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  context.save();
}

function updateCanvas() {
  context.restore();
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "gray";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const margin = 10;
  context.fillStyle = "blue";
  context.fillRect(margin, margin, canvasWidth - 2 * margin, 20);

  context.fillStyle = "lightblue";
  context.strokeStyle = "black";

  const barHeight = mix(timeSlider.value, 1, 2.5, 20, 10);
  const zoom = 1.5;
  let outputYBase = margin + 30;
  const offset = (70 / timeSlider.value) * zoom;
  const segmentWidth = 100 * zoom;

  for (let i = 0; i < 25; i++) {
    context.fillRect(10 + offset * i, outputYBase + barHeight * i, segmentWidth, barHeight);
    context.strokeRect(10 + offset * i, outputYBase + barHeight * i, segmentWidth, barHeight);
  }
}

function mix(x, xStart, xEnd, yStart, yEnd) {
  let xProgress = (x - xStart) / (xEnd - xStart);
  xProgress = Math.max(0, Math.min(1, xProgress));
  return yStart * (1 - xProgress) + yEnd * xProgress;
}

// Next step: make it faster. It works, but when eg try mp3 thats 2 mins long, it takes a second to process, which makes sense but make it faster and TEST it to make sure can see the fastness
// Especially when first upload (and it doesnt even put filename in the thing until prints Done to console for the wasm part. Why?)
// This means both on the JS and C side. On C side there's a few things can try out, but mainly on JS side be more efficient like copying arrays or like pre allocating input memory etc, or something

// Not good-- on firefox it lags when eg 1 minute audio file like if click high piutch, while the wasm is running, which takes too long (a second, not instant), if they try to change the slider, then that doesnt happen until the thing ends, then it does that late and lags further, and so on.
  // It should at least block user action and visibly show that it's working on it, and/or not process slider changes while still doing the last thing so can still ffeel responsive
  // but better to also make it faster in the first place and ALSO either block action or nor run it if something still going on.