// Check that browser supports key features here and add div to dom with message if not

let worker = new Worker("repitchworker.js");

const audioContext = new AudioContext({sampleRate: 44100});
let activeAudioBuffer;
let bufferSource;

const playButton = document.getElementById("play");
playButton.addEventListener("click", playAudio);
let originalAudioDuration = 0;
let currentAudioDuration = 0;
let currentAudioPosition = 0;
let lastAudioPlayTime = 0;
let playing = false;

const fileChooser = document.getElementById("file-select");
fileChooser.addEventListener("change", openFile);
document.getElementById("file-button").onclick = (e) => fileChooser.click();

// ALL THIS CODE IS EXTREMELY MESSY especially the slider/text input controld mess but also including the flex box things in html,, etc,...
// Should come up with organized way to deal with all the updates, like storing all the values in one place and calling update consistently for all of them because they all ddo the same thing (eg updatecanvas and processaudiobuffer, change vs input, etc same scheme)
document.getElementById("load-example").onclick = (e) => {
  document.getElementById("details").innerText = "Loading file...";
  document.getElementById("filename").innerText = "example.wav";
  fetch("example.wav").then((r) => r.arrayBuffer()).then((buffer) => decodeArrayBuffer(buffer)).then(updateCanvas).then(processAudioBuffer).catch((reason) => console.log(reason));
  e.target.hidden = true;
  document.getElementById("clear").hidden = false;
};

document.getElementById("clear").onclick = (e) => {
  endAudioPlayback();
  document.getElementById("filename").innerText = "";
  document.getElementById("details").innerText = "No file selected.";
  document.getElementById("download").innerText = "Download";
  document.getElementById("playback-length").innerText = "0:00";
  activeAudioBuffer = undefined;
  bufferSource = undefined;
  originalAudioDuration = 0;
  currentAudioDuration = 0;
  currentAudioPosition = 0;
  lastAudioPlayTime = 0;
  playing = false;
  worker.terminate();
  worker = new Worker("repitchworker.js"); // Do this so that a worker with wasm memory that has grown too large can be discarded (not ideal)
  // location.reload();
  e.target.hidden = true;
  document.getElementById("load-example").hidden = false;
}

const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-number");
pitchLabel.value = pitchSlider.value;
pitchSlider.addEventListener("input", (e) => {
  pitchSlider.step = 1;
  pitchSlider.value = Math.round(pitchSlider.value);
  pitchLabel.value = pitchSlider.value;
  updateCanvas();
});
pitchSlider.addEventListener("change", (e) => {
  processAudioBuffer();
  checkPitchTimeDefaults();
});
pitchLabel.addEventListener("change", (e) => {
  const newValue = Math.round(pitchLabel.value * 100) / 100;
  if (newValue < -12 || newValue > 12) {
    pitchLabel.value = pitchSlider.value;
    return;
  }

  pitchSlider.step = 0.01;
  pitchSlider.value = newValue;
  pitchLabel.value = newValue;
  updateCanvas();
  processAudioBuffer();
  checkPitchTimeDefaults();
});

const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-number");
const multiplierFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeLabel.value = multiplierFormat.format(timeSlider.value);
timeSlider.addEventListener("input", (e) => {
  timeLabel.value = multiplierFormat.format(timeSlider.value);
  updateCanvas();
});
timeSlider.addEventListener("change", (e) => {
  processAudioBuffer();
  checkPitchTimeDefaults();
});
timeLabel.addEventListener("change", (e) => {
  const newValue = Math.round(timeLabel.value * 100) / 100;
  if (newValue < 0.4 || newValue > 2.5) {
    timeLabel.value = timeSlider.value;
    return;
  }

  timeSlider.value = newValue;
  timeLabel.value = multiplierFormat.format(newValue);
  updateCanvas();
  processAudioBuffer();
  checkPitchTimeDefaults();
});

// add warnings in potentially slow individual choices AND COMBINATIONS of choices for these sliders, and also notices for potentially glitch/artifact causing (intended behavior) values and combinations of values
const segmentLengthSlider = document.getElementById("segment-length");
const segmentLengthLabel = document.getElementById("segment-length-number");
segmentLengthLabel.value = segmentLengthSlider.value;
segmentLengthSlider.addEventListener("input", (e) => {
  segmentLengthLabel.value = segmentLengthSlider.value;
  updateCanvas();
});
segmentLengthSlider.addEventListener("change", (e) => {
  processAudioBuffer();
  checkSettingsDefaults();
});
segmentLengthLabel.addEventListener("change", (e) => {
  const newValue = Math.round(segmentLengthLabel.value);
  if (newValue < 50 || newValue > 250) {
    segmentLengthLabel.value = segmentLengthSlider.value;
    return;
  }

  segmentLengthSlider.value = newValue;
  segmentLengthLabel.value = newValue;
  updateCanvas();
  processAudioBuffer();
});

const segmentOverlapSlider = document.getElementById("segment-overlap");
const segmentOverlapLabel = document.getElementById("segment-overlap-number");
segmentOverlapLabel.value = segmentOverlapSlider.value;
segmentOverlapSlider.addEventListener("input", (e) => {
  segmentOverlapLabel.value = segmentOverlapSlider.value;
  updateCanvas();
});
segmentOverlapSlider.addEventListener("change", (e) => {
  processAudioBuffer();
  checkSettingsDefaults();
});
segmentOverlapLabel.addEventListener("change", (e) => {
  const newValue = Math.round(segmentOverlapLabel.value);
  if (newValue < 0 || newValue > 40) {
    segmentOverlapLabel.value = segmentOverlapSlider.value;
    return;
  }

  segmentOverlapSlider.value = newValue;
  segmentOverlapLabel.value = newValue;
  updateCanvas();
  processAudioBuffer();
});

const maxShiftSlider = document.getElementById("max-shift");
const maxShiftLabel = document.getElementById("max-shift-number");
maxShiftLabel.value = maxShiftSlider.value;
maxShiftSlider.addEventListener("input", (e) => {
  maxShiftLabel.value = maxShiftSlider.value;
  updateCanvas();
});
maxShiftSlider.addEventListener("change", (e) => {
  processAudioBuffer();
  checkSettingsDefaults();
});
maxShiftLabel.addEventListener("change", (e) => {
  const newValue = Math.round(maxShiftLabel.value);
  if (newValue < 0 || newValue > 15) {
    maxShiftLabel.value = maxShiftSlider.value;
    return;
  }

  maxShiftSlider.value = newValue;
  maxShiftLabel.value = newValue;
  updateCanvas();
  processAudioBuffer();
});

document.getElementById("reset-pitch-time").onclick = (e) => {
  pitchSlider.value = 0;
  pitchLabel.value = pitchSlider.value;

  timeSlider.value = 1.00;
  timeLabel.value = multiplierFormat.format(timeSlider.value);
  
  updateCanvas();
  processAudioBuffer();
  e.target.hidden = true;
};

document.getElementById("reset-settings").onclick = (e) => {
  segmentLengthSlider.value = 100;
  segmentLengthLabel.value = segmentLengthSlider.value;

  segmentOverlapSlider.value = 30;
  segmentOverlapLabel.value = segmentOverlapSlider.value;

  maxShiftSlider.value = 10;
  maxShiftLabel.value = maxShiftSlider.value;

  updateCanvas();
  processAudioBuffer();
  e.target.hidden = true;
};

checkPitchTimeDefaults(); // this could alll be organized much much more neatly
checkSettingsDefaults();

function checkPitchTimeDefaults() {
  if (pitchSlider.value != 0 || timeSlider.value != 1.00) {
    document.getElementById("reset-pitch-time").hidden = false;
  } else {
    document.getElementById("reset-pitch-time").hidden = true;
  }
}

function checkSettingsDefaults() {
  if (segmentLengthSlider.value == 100 && segmentOverlapSlider.value == 30 && maxShiftSlider.value == 10) {
    document.getElementById("reset-settings").hidden = true;
  } else {
    document.getElementById("reset-settings").hidden = false;
  }
}

const canvas = document.getElementById("visualization");
const context = canvas.getContext("2d");
const canvasWidth = 600;
const canvasHeight = 160;
let mouseX = -1;
let mouseY = -1;
setupCanvas();
updateCanvas();

function openFile(event) {
  // Also eg under first panel in small details-size text notcice if upload eg 2-5 minutes
  // "Audio files longer than a couple minutes can use lots of memory and may take a few seconds to process."
  // And if longer than 5 minutes maybe just say no
  
  document.getElementById("load-example").hidden = true;
  document.getElementById("clear").hidden = false;
  document.getElementById("details").innerText = "Loading file...";

  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name;

  const reader = new FileReader();
  reader.onload = (e) => decodeArrayBuffer(e.target.result).then(updateCanvas).then(processAudioBuffer).catch((reason) => console.log(reason));
  reader.readAsArrayBuffer(file);
}

function setupWorkerPromise() {
  return new Promise((resolve) => {
    worker.addEventListener("message", function listener(message) {
      worker.removeEventListener("message", listener);
      resolve(message.data);
    });
  });
}

async function decodeArrayBuffer(arrayBuffer) {
  setInputEnabled(false);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  originalAudioDuration = audioBuffer.duration;

  const channelData = []
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channelData.push(audioBuffer.getChannelData(i).buffer);
  }

  const workerPromise = setupWorkerPromise();
  worker.postMessage({action: "load", channelData: channelData}, channelData);

  await workerPromise;
  setInputEnabled(true);
}

async function processAudioBuffer() {
  currentAudioPosition = 0;
  endAudioPlayback();

  if (originalAudioDuration == 0) {
    return;
  }

  setInputEnabled(false);
  document.getElementById("details").innerText = "Processing audio...";

  const workerPromise = setupWorkerPromise();
  const settings = {stretch: timeSlider.value, semitones: pitchSlider.value, segmentLengthMs: segmentLengthSlider.value, outputOffsetMs: segmentLengthSlider.value - segmentOverlapSlider.value, maxShiftMs: maxShiftSlider.value};
  worker.postMessage({action: "process", repitchSettings: settings});
  
  const workerData = await workerPromise;
  if (workerData.transfer.length == 0) {
    return;
  }

  const numSamples = workerData.transfer[0].byteLength / 4;
  activeAudioBuffer = audioContext.createBuffer(workerData.transfer.length, numSamples, 44100);
  for (let i = 0; i < workerData.transfer.length; i++) {
    activeAudioBuffer.copyToChannel(new Float32Array(workerData.transfer[i]), i, 0);
  }

  currentAudioDuration = activeAudioBuffer.duration;
  document.getElementById("playback-length").innerText = secondsToTime(currentAudioDuration);

  const uncompressedSizeBytes = currentAudioDuration * activeAudioBuffer.numberOfChannels * 44100 * 4;
  const uncompressedSizeMB = Math.round(uncompressedSizeBytes / 1e4) / 1e2;
  document.getElementById("download").innerText = `Download (${uncompressedSizeMB} MB)`;
  const totalStretch = settings.stretch * Math.pow(1.05946, settings.semitones);
  document.getElementById("details").innerText = `Input ${Math.round(originalAudioDuration * 100) / 100} s, time stretched to ${Math.round(originalAudioDuration * totalStretch * 100) / 100} s, resampled to ${Math.round(currentAudioDuration * 100) / 100} s with ${settings.semitones} semitone shift`;
  setInputEnabled(true);
}

function playAudio(event) {
  if (playing) {
    currentAudioPosition += audioContext.currentTime - lastAudioPlayTime;
    endAudioPlayback();
    return;
  }

  if (originalAudioDuration == 0) {
    return;
  }

  playing = true;
  playButton.innerText = "Pause";
  lastAudioPlayTime = audioContext.currentTime;

  bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = activeAudioBuffer;
  bufferSource.addEventListener("ended", playbackEnded);

  bufferSource.connect(audioContext.destination);
  bufferSource.start(undefined, currentAudioPosition);
}

function endAudioPlayback() {
  playing = false;
  playButton.innerText = "Play";
  if (bufferSource != undefined) {
    bufferSource.removeEventListener("ended", playbackEnded);
    bufferSource.disconnect(audioContext.destination);
    bufferSource = undefined;
  }
}

function playbackEnded(event) {
  console.log("Playback finished");
  currentAudioPosition = 0;
  endAudioPlayback();
}

function setInputEnabled(enabled) {
  for (element of document.getElementsByTagName("input")) {
    element.disabled = !enabled;
  }

  document.getElementById("play").disabled = !enabled;
  document.getElementById("download").disabled = !enabled;
}

function secondsToTime(seconds) {
  let wholeSeconds = Math.round(seconds);
  let wholeMinutes = Math.floor(wholeSeconds / 60);
  let secondsRemainder = wholeSeconds - wholeMinutes * 60;

  return `${wholeMinutes}:${secondsRemainder < 10 ? "0" : ""}${secondsRemainder}`;
}

function setupCanvas() {
  canvas.style.width =  `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.width = canvasWidth * window.devicePixelRatio;
  canvas.height = canvasHeight * window.devicePixelRatio;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  context.save();
}

function updateCanvas() { // clean this code up massively, also make hover effect highlight the part in input
  context.restore();
  context.save();
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#363e4a";
  context.strokeStyle = "#707b84";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const margin = 10;
  const barHeight = 15;

  const numBarsFitting = canvasWidth / (segmentLengthSlider.value - segmentOverlapSlider.value);
  const zoom = interpolate(numBarsFitting, 12, 60, 1.2, 2.6);
  const timescaleMax = (canvasWidth - margin) / zoom;
  for (let i = 0; i < timescaleMax; i += 20) {
    const scaleX = margin + i *zoom;
    context.lineWidth = i % 100 == 0 ? 1.8 : 0.6;
    context.beginPath();
    context.moveTo(scaleX, margin + barHeight);
    context.lineTo(scaleX, canvasHeight);
    context.stroke();
  }

  context.lineWidth = 1;
  
  context.fillStyle = "#00101d";
  context.fillRect(margin, margin, canvasWidth - margin, barHeight);

  let outputYBase = margin + 25;
  const outputOffset = segmentLengthSlider.value - segmentOverlapSlider.value;
  const segmentWidth = segmentLengthSlider.value;

  const inputLength = originalAudioDuration > 0 ? originalAudioDuration * 1000 : (outputOffset * 10 + segmentOverlapSlider.value);
  const totalStretch = timeSlider.value * Math.pow(1.05946, pitchSlider.value);
  const outputLength = totalStretch * inputLength;
  const numSegments = Math.ceil((outputLength - segmentOverlapSlider.value) / outputOffset);
  const inputOffset = Math.ceil((inputLength - segmentLengthSlider.value) / (numSegments - 1));

  const maxNumBars = 18;
  let highlightBar = -1;
  const verticalBar = Math.floor((mouseY - outputYBase) / barHeight);
  const horizontalBarX = verticalBar * outputOffset * zoom + margin;
  if (verticalBar >= 0 && verticalBar <= maxNumBars && mouseX >= horizontalBarX && mouseX < horizontalBarX + segmentWidth * zoom && mouseY >= 0 && mouseY < canvasHeight && mouseX >= 0 && mouseX < canvasWidth) {
    highlightBar = verticalBar;
  }

  const hslRanges = [[0, 200], [45, 90], [60, 65], [100, 100]];
  for (let i = 0; i < maxNumBars + 1; i++) { 
    context.setLineDash([]);
    const rectX = margin + outputOffset * i * zoom;
    const rectY = outputYBase + barHeight * i; 
    
    const inputX = margin + inputOffset * i * zoom;
    const inputY = margin + (barHeight / 2) + (i % 2 == 0 ? -1 : 1) * 3;

    const hslValues = hslRanges.map((range) => Math.floor(interpolate(i, 0, maxNumBars, ...range)));
    if (highlightBar >= 0 && highlightBar <= maxNumBars && highlightBar != i) {
      hslValues[3] = 30;
    }
    context.fillStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3]}%)`;
    context.strokeStyle = context.fillStyle; 

    if (highlightBar == i) {
      continue;
    }

    context.fillRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);

    context.setLineDash([]);
    context.beginPath();
    context.moveTo(rectX, rectY);
    context.lineTo(inputX, inputY);
    context.lineTo(inputX + segmentWidth * zoom, inputY);
    context.lineTo(rectX + segmentWidth * zoom, rectY);
    context.stroke();

    context.beginPath();
    context.arc(inputX, inputY, 2, 0, 2 * Math.PI);
    context.fill();
    context.beginPath();
    context.arc(inputX + segmentWidth * zoom, inputY, 2, 0, 2 * Math.PI);
    context.fill();

    if (i > 0) {
      context.strokeStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3] - 30}%)`
      context.lineWidth = 2;
      context.setLineDash([1,1]);
      context.beginPath();
      context.moveTo(inputX, inputY);
      context.lineTo(Math.max(inputX - maxShiftSlider.value * zoom, margin), inputY);
      context.stroke();
      context.beginPath();
      context.moveTo(inputX + segmentWidth * zoom, inputY);
      context.lineTo(inputX + segmentWidth * zoom + maxShiftSlider.value * zoom, inputY);
      context.stroke();
      context.lineWidth = 1;
    }
  } 

  for (let i = 0; i < timescaleMax; i += 100) {
    const scaleX = margin + i *zoom;
    // time labels here
  }

  if (highlightBar >= 0 && highlightBar <= maxNumBars) {
    // Put input and output label text here
    const i = highlightBar;
    context.setLineDash([]);
    const rectX = margin + outputOffset * i * zoom;
    const rectY = outputYBase + barHeight * i; 
    
    const inputX = margin + inputOffset * i * zoom;

    const hslValues = hslRanges.map((range) => Math.floor(interpolate(i, 0, maxNumBars, ...range)));
    context.fillStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3]}%)`;
    context.strokeStyle = context.fillStyle; 

    context.fillRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);

    context.fillRect(inputX, margin + 1, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(inputX, margin + 1, segmentWidth * zoom, barHeight - 2);

    if (i > 0) {
      const shiftLeftStart = Math.max(inputX - maxShiftSlider.value * zoom, margin);

      context.fillStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3] - 50}%)`;
      context.fillRect(shiftLeftStart, margin + 3, inputX - shiftLeftStart, barHeight - 6);
      context.fillRect(inputX + segmentWidth * zoom, margin + 3, maxShiftSlider.value * zoom, barHeight - 6);  
    }
  }

  const fadeBottom = context.createLinearGradient(0, 135, 0, 158);
  // fadeBottom.addColorStop(0, "#404d5a00");
  // fadeBottom.addColorStop(1, "#404d5aff");
  fadeBottom.addColorStop(0, "#363e4a00");
  fadeBottom.addColorStop(1, "#363e4aff");
  context.fillStyle = fadeBottom;
  context.fillRect(0, 130, canvasWidth, 30);

  const fadeRight = context.createLinearGradient(canvasWidth - 25, 0, canvasWidth - 3, 0);
  fadeRight.addColorStop(0, "#363e4a00");
  fadeRight.addColorStop(1, "#363e4aff");
  context.fillStyle = fadeRight;
  context.fillRect(canvasWidth - 30, 0, canvasWidth, canvasHeight);
}

function interpolate(x, xStart, xEnd, yStart, yEnd) {
  let xProgress = (x - xStart) / (xEnd - xStart);
  xProgress = Math.max(0, Math.min(1, xProgress));
  return yStart * (1 - xProgress) + yEnd * xProgress;
}

// canvas.addEventListener("mousedown", updateCanvasMouse);
canvas.addEventListener("mousemove", updateCanvasMouse);
canvas.addEventListener("mouseleave", updateCanvasMouse);

function updateCanvasMouse(e) {
  const bounds = canvas.getBoundingClientRect();
  mouseX = e.clientX - bounds.x;
  mouseY = e.clientY - bounds.y;
  updateCanvas();
}
