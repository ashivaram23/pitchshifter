// Unfinished:
// - items marked TODO below (browser compatbility checks, file size checks and notices, extreme settings/sizes performance warning and expected audio artifact notices)
// - memory things with how the audiobuffer stores and how to prevent unnecessary buildup
// - big problem on Safari where the very first processing after starting or restarting the web worker takes ultra long, so if user happens to choose a long file first or right after reset, it will take forever
// - test download button on different browsers
// - last ui polishes on html side, clean up html structure and names, page title and favicon etc
// - explanatory text including implementation details/notices to keep in mind (and if time, images as originally intended)
// - link attributions eg wav article somewhere (in the code or a readme -- explanatory text should ofc have links for algorithm stuff (which should also be in readme))



// -----------------------------------------------------------------------------
// Main setup
// -----------------------------------------------------------------------------

// TODO: browser compatibility checks

// Sets up web worker for Wasm module
let worker = new Worker("repitchworker.js");

// Sets up audio context and variables to store audio buffer and source node
const audioContext = new AudioContext({sampleRate: 44100});
let activeAudioBuffer;
let bufferSource;

// Sets up play button and playback tracking variables
const playButton = document.getElementById("play");
playButton.onclick = togglePlayback;
const progressBar = document.getElementById("audio-progress");
progressBar.onchange = handleUserProgressChange;
const playback = {playing: false, position: 0, lastPlayTime: 0, lastPausePosition: 0};
let playbackUpdateInterval;
let originalAudioDuration = 0;
let currentAudioDuration = 0;

// Sets up file chooser and button to load example
const fileChooser = document.getElementById("file-select");
fileChooser.onchange = openFile;
document.getElementById("file-button").onclick = (e) => fileChooser.click();
document.getElementById("load-example").onclick = loadExampleFile;

// TODO: Add warnings in potentially slow individual choices AND COMBINATIONS of choices for these sliders, and also notices for potentially glitch/artifact causing (intended behavior) values and combinations of values

// Sets up user settings slider for pitch shift
const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-number");
pitchLabel.value = pitchSlider.value;
pitchLabel.onchange = (e) => applyLabelChange(pitchLabel, pitchSlider, -12, 12, 100, undefined, 0.01);
pitchSlider.onchange = handleSliderChange;
pitchSlider.oninput = (e) => {
  pitchSlider.step = 1;
  pitchSlider.value = Math.round(pitchSlider.value);
  pitchLabel.value = pitchSlider.value;
  updateCanvas();
};

// Sets up user settings slider for time stretch
const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-number");
const multiplierFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeLabel.value = multiplierFormat.format(timeSlider.value);
timeLabel.onchange = (e) => applyLabelChange(timeLabel, timeSlider, 0.4, 2.5, 100, multiplierFormat);
timeSlider.onchange = handleSliderChange;
timeSlider.oninput = (e) => {
  timeLabel.value = multiplierFormat.format(timeSlider.value);
  updateCanvas();
};

// Sets up user settings slider for segment length
const segmentLengthSlider = document.getElementById("segment-length");
const segmentLengthLabel = document.getElementById("segment-length-number");
segmentLengthLabel.value = segmentLengthSlider.value;
segmentLengthLabel.onchange = (e) => applyLabelChange(segmentLengthLabel, segmentLengthSlider, 50, 250);
segmentLengthSlider.onchange = handleSliderChange;
segmentLengthSlider.oninput = (e) => {
  segmentLengthLabel.value = segmentLengthSlider.value;
  updateCanvas();
};

// Sets up user settings slider for segment overlap
const segmentOverlapSlider = document.getElementById("segment-overlap");
const segmentOverlapLabel = document.getElementById("segment-overlap-number");
segmentOverlapLabel.value = segmentOverlapSlider.value;
segmentOverlapLabel.onchange = (e) => applyLabelChange(segmentOverlapLabel, segmentOverlapSlider, 0, 40);
segmentOverlapSlider.onchange = handleSliderChange;
segmentOverlapSlider.oninput = (e) => {
  segmentOverlapLabel.value = segmentOverlapSlider.value;
  updateCanvas();
};

// Sets up user settings slider for max shift
const maxShiftSlider = document.getElementById("max-shift");
const maxShiftLabel = document.getElementById("max-shift-number");
maxShiftLabel.value = maxShiftSlider.value;
maxShiftLabel.onchange = (e) => applyLabelChange(maxShiftLabel, maxShiftSlider, 0, 10);
maxShiftSlider.onchange = handleSliderChange;
maxShiftSlider.oninput = (e) => {
  maxShiftLabel.value = maxShiftSlider.value;
  updateCanvas();
};

// Sets up event handling for reset buttons
document.getElementById("clear").onclick = resetAudio;
document.getElementById("reset-pitch-time").onclick = resetPitchTimeSettings;
document.getElementById("reset-settings").onclick = resetOverlapAddSettings;
checkPitchTimeDefaults();
checkOverlapAddDefaults();

// Sets up download button functionality
document.getElementById("download").onclick = downloadAudio;

// Sets up canvas and mouse movement tracking
const canvas = document.getElementById("visualization");
const context = canvas.getContext("2d");
const canvasWidth = 600;
const canvasHeight = 160;
let mouseX = -1;
let mouseY = -1;
canvas.onmousemove = updateCanvasMouse;
canvas.onmouseleave = updateCanvasMouse;
setupCanvas();
updateCanvas();



// -----------------------------------------------------------------------------
// User settings functions
// -----------------------------------------------------------------------------

// Checks and applies changes to text labels for settings sliders
function applyLabelChange(settingLabel, settingSlider, limitLow, limitHigh, roundFactor, labelFormat, sliderStep) {
  roundFactor = roundFactor == undefined ? 1 : roundFactor;
  const newValue = Math.round(settingLabel.value * roundFactor) / roundFactor;
  if (newValue < limitLow || newValue > limitHigh) {
    settingLabel.value = settingSlider.value;
    return;
  }

  if (sliderStep != undefined) {
    settingSlider.step = sliderStep;
  }
  
  settingSlider.value = newValue;
  settingLabel.value = labelFormat == undefined ? newValue : labelFormat.format(newValue);
  updateCanvas();
  processAudioBuffer();

  checkPitchTimeDefaults();
  checkOverlapAddDefaults();
}

// Handles changes in settings sliders
function handleSliderChange(e) {
  processAudioBuffer();
  checkPitchTimeDefaults();
  checkOverlapAddDefaults();
}

// Resets the audio to the "no file selected" state and restarts the web worker
function resetAudio(e) {
  stopPlayback();
  playback.position = 0;
  playback.lastPlayTime = 0;
  playback.lastPausePosition = 0;
  updatePlaybackProgress();

  document.getElementById("filename").innerText = "";
  document.getElementById("details").innerText = "No file selected.";
  document.getElementById("download").innerText = "Download";
  document.getElementById("playback-length").innerText = "0:00";
  fileChooser.value = "";

  activeAudioBuffer = undefined;
  bufferSource = undefined;
  originalAudioDuration = 0;
  currentAudioDuration = 0;

  worker.terminate();
  worker = new Worker("repitchworker.js");

  e.target.hidden = true;
  document.getElementById("load-example").hidden = false;
}

// Resets the sliders in the first settings panel
function resetPitchTimeSettings() {
  pitchSlider.value = 0;
  pitchLabel.value = pitchSlider.value;

  timeSlider.value = 1.00;
  timeLabel.value = multiplierFormat.format(timeSlider.value);
  
  updateCanvas();
  processAudioBuffer();
}

// Resets the sliders in the second settings panel
function resetOverlapAddSettings() {
  segmentLengthSlider.value = 100;
  segmentLengthLabel.value = segmentLengthSlider.value;

  segmentOverlapSlider.value = 30;
  segmentOverlapLabel.value = segmentOverlapSlider.value;

  maxShiftSlider.value = 10;
  maxShiftLabel.value = maxShiftSlider.value;

  updateCanvas();
  processAudioBuffer();
  e.target.hidden = true;
}

// Checks if the first settings panel is at its default settings
function checkPitchTimeDefaults() {
  if (pitchSlider.value != 0 || timeSlider.value != 1.00) {
    document.getElementById("reset-pitch-time").hidden = false;
  } else {
    document.getElementById("reset-pitch-time").hidden = true;
  }
}

// Checks if the second settings panel is at its default settings
function checkOverlapAddDefaults() {
  if (segmentLengthSlider.value == 100 && segmentOverlapSlider.value == 30 && maxShiftSlider.value == 10) {
    document.getElementById("reset-settings").hidden = true;
  } else {
    document.getElementById("reset-settings").hidden = false;
  }
}

// Creates WAV blob from audio buffer and downloads it
function downloadAudio() {
  if (currentAudioDuration == 0) {
    return;
  }

  const numSamples = activeAudioBuffer.length;
  const numChannels = activeAudioBuffer.numberOfChannels;
  const audioByteLength = numSamples * 4 * numChannels;
  const fileByteLength = audioByteLength + 44;

  const fileData = new ArrayBuffer(fileByteLength);
  const fileDataView = new DataView(fileData);
  const fileUint8View = new Uint8Array(fileData);
  const encoder = new TextEncoder();

  fileUint8View.set(encoder.encode("RIFF"), 0);
  fileDataView.setUint32(4, fileByteLength - 8, true);
  fileUint8View.set(encoder.encode("WAVE"), 8);

  fileUint8View.set(encoder.encode("fmt "), 12);
  fileDataView.setUint32(16, 16, true);
  fileDataView.setUint16(20, 3, true);
  fileDataView.setUint16(22, numChannels, true);
  fileDataView.setUint32(24, 44100, true);
  fileDataView.setUint32(28, 44100 * 4 * numChannels, true);
  fileDataView.setUint16(32, 4 * numChannels, true);
  fileDataView.setUint16(34, 32, true);

  fileUint8View.set(encoder.encode("data"), 36);
  fileDataView.setUint32(40, audioByteLength, true);
  for (let i = 0; i < numSamples; i++) {
    const startOffset = 44 + i * 4 * numChannels;
    for (let j = 0; j < numChannels; j++) {
      fileDataView.setFloat32(startOffset + j * 4, activeAudioBuffer.getChannelData(j)[i], true);
    }
  }

  const fileBlob = new Blob([fileData], {type: "audio/wav"});
  const fileUrl = URL.createObjectURL(fileBlob);
  const anchor = document.getElementById("blob-link")
  anchor.href = fileUrl;
  const originalFilename = document.getElementById("filename").innerText;
  anchor.download = `output_${originalFilename.substring(0, originalFilename.lastIndexOf("."))}.wav`;
  anchor.click();
  setTimeout(URL.revokeObjectURL(fileUrl), 0);
  anchor.href = "";
}



// -----------------------------------------------------------------------------
// Audio file processing functions
// -----------------------------------------------------------------------------

// Handles the file chooser's onchange event
function openFile(e) {
  if (fileChooser.files.length == 0) {
    return;
  }

  // TODO:
  // Add notice under first panel in small details-size text if upload eg 2-5 minutes
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

// Handles the example load button's onclick event
function loadExampleFile(e) {
  document.getElementById("details").innerText = "Loading file...";
  document.getElementById("filename").innerText = "example.wav";
  fetch("example.wav").then((r) => r.arrayBuffer()).then((buffer) => decodeArrayBuffer(buffer)).then(updateCanvas).then(processAudioBuffer).catch((reason) => console.log(reason));
  e.target.hidden = true;
  document.getElementById("clear").hidden = false;
}

// Returns a promise that resolves upon receiving a message from the worker
function setupWorkerPromise() {
  return new Promise((resolve) => {
    worker.addEventListener("message", function listener(message) {
      worker.removeEventListener("message", listener);
      resolve(message.data);
    });
  });
}

// Enables or disables input elements on the page
function setInputEnabled(enabled) {
  for (element of document.getElementsByTagName("input")) {
    element.disabled = !enabled;
  }

  document.getElementById("play").disabled = !enabled;
  document.getElementById("download").disabled = !enabled;
}

// Decodes the contents of an audio file and sends audio PCM data to the worker
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

// Directs worker to repitch audio according to the page's current settings
async function processAudioBuffer() {
  playback.position = 0;
  playback.lastPlayTime = 0;
  playback.lastPausePosition = 0;
  updatePlaybackProgress();
  stopPlayback();

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
  updatePlaybackProgress();
}



// -----------------------------------------------------------------------------
// Playback functions
// -----------------------------------------------------------------------------

// Plays or pauses the active audio buffer
function togglePlayback() {
  if (playback.playing) {
    playback.lastPausePosition += audioContext.currentTime - playback.lastPlayTime;
    playback.position = playback.lastPausePosition;
    stopPlayback();
    updatePlaybackProgress();
    return;
  }

  if (originalAudioDuration == 0) {
    return;
  }

  playButton.innerText = "Pause";
  playback.playing = true;
  playback.lastPlayTime = audioContext.currentTime;

  bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = activeAudioBuffer;
  bufferSource.addEventListener("ended", signalPlaybackEnded);

  bufferSource.connect(audioContext.destination);
  bufferSource.start(undefined, playback.lastPausePosition);

  if (playbackUpdateInterval != undefined) {
    clearInterval(playbackUpdateInterval);
    playbackUpdateInterval = undefined;
  }

  playbackUpdateInterval = setInterval(updatePlaybackProgress, 200);
}

// Stops a playing buffer source
function stopPlayback() {
  playButton.innerText = "Play";
  playback.playing = false;

  if (bufferSource != undefined) {
    bufferSource.removeEventListener("ended", signalPlaybackEnded);
    bufferSource.disconnect(audioContext.destination);
    bufferSource = undefined;
  }

  if (playbackUpdateInterval != undefined) {
    clearInterval(playbackUpdateInterval);
    playbackUpdateInterval = undefined;
  }
}

// Updates the playback timestamp and progress bar on the page
function updatePlaybackProgress() {
  const playedTime = playback.playing ? audioContext.currentTime - playback.lastPlayTime : 0;
  playback.position = playback.lastPausePosition + playedTime;

  progressBar.value = currentAudioDuration == 0 ? 0 : Math.round(100 * playback.position / currentAudioDuration);
  document.getElementById("current-playback").innerText = secondsToTime(playback.position);
}

// Handles the onended event from a playing buffer source
function signalPlaybackEnded() {
  console.log("Playback finished");

  updatePlaybackProgress();
  playback.position = 0;
  playback.lastPlayTime = 0;
  playback.lastPausePosition = 0;

  stopPlayback();
}

// Creates a formatted timestamp from a number of seconds
function secondsToTime(seconds) {
  let wholeSeconds = Math.round(seconds);
  let wholeMinutes = Math.floor(wholeSeconds / 60);
  let secondsRemainder = wholeSeconds - wholeMinutes * 60;

  return `${wholeMinutes}:${secondsRemainder < 10 ? "0" : ""}${secondsRemainder}`;
}

// Handles user changes to the progress bar slider's value
function handleUserProgressChange(e) {
  stopPlayback();
  playback.playing = false;
  playback.position = currentAudioDuration * (progressBar.value / 100);
  playback.lastPlayTime = 0;
  playback.lastPausePosition = playback.position;
  updatePlaybackProgress();

  if (progressBar.value == 100) {
    playback.position = 0;
    playback.lastPausePosition = 0;
  }
}



// -----------------------------------------------------------------------------
// Canvas functions
// -----------------------------------------------------------------------------

// Initializes canvas width and height
function setupCanvas() {
  canvas.style.width =  `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  canvas.width = canvasWidth * window.devicePixelRatio;
  canvas.height = canvasHeight * window.devicePixelRatio;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  context.save();
}

// Redraws canvas
function updateCanvas() {
  context.restore();
  context.save();

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#363e4a";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const margin = 10;
  const barHeight = 15;

  const numBarsFitting = canvasWidth / (segmentLengthSlider.value - segmentOverlapSlider.value);
  const zoom = interpolate(numBarsFitting, 12, 60, 1.2, 2.6);
  const timescaleMax = (canvasWidth - margin) / zoom;
  context.strokeStyle = "#707b84";
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

  if (mouseY >= 0 && mouseY < canvasHeight && mouseX >= 0 && mouseX < canvasWidth) {
    context.font = "10px Open Sans";
    context.fillStyle = "#a0abb4";
    context.textBaseline = "middle";
    context.textAlign = "start";

    for (let j = 0; j < timescaleMax; j += 100) {
      const scaleX = margin + j *zoom;
      context.fillText(`${j} ms`, scaleX, 138);
      context.textAlign = "center";
    }
  }

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
    if (i == highlightBar) {
      continue;
    }

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
    context.fillRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);

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
      context.setLineDash([]);
    }
  }

  if (highlightBar >= 0 && highlightBar <= maxNumBars) {
    const barIndex = highlightBar;

    const rectX = margin + outputOffset * barIndex * zoom;
    const rectY = outputYBase + barHeight * barIndex; 
    const inputX = margin + inputOffset * barIndex * zoom;

    const hslValues = hslRanges.map((range) => Math.floor(interpolate(barIndex, 0, maxNumBars, ...range)));
    context.fillStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3]}%)`;
    context.strokeStyle = context.fillStyle; 

    context.fillRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(rectX, rectY, segmentWidth * zoom, barHeight - 2);
    context.fillRect(inputX, margin + 1, segmentWidth * zoom, barHeight - 2);
    context.strokeRect(inputX, margin + 1, segmentWidth * zoom, barHeight - 2);

    if (barIndex > 0) {
      const shiftLeftStart = Math.max(inputX - maxShiftSlider.value * zoom, margin);
      context.fillStyle = `hsl(${hslValues[0]} ${hslValues[1]}% ${hslValues[2]}% / ${hslValues[3] - 50}%)`;
      context.fillRect(shiftLeftStart, margin + 3, inputX - shiftLeftStart, barHeight - 6);
      context.fillRect(inputX + segmentWidth * zoom, margin + 3, maxShiftSlider.value * zoom, barHeight - 6);  
    }

    context.font = "bold italic 10px Open Sans";
    context.fillStyle = "black";
    context.textAlign = "start";
    context.textBaseline = "middle";
    context.fillText("input", inputX + 2, margin + barHeight / 2);
    context.fillText("output", rectX + 2, rectY + (barHeight-2) / 2);
  }

  const fadeBottom = context.createLinearGradient(0, 135, 0, 158);
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

// Linearly maps a value in the range [xStart, xEnd] to the range [yStart, yEnd]
function interpolate(x, xStart, xEnd, yStart, yEnd) {
  let xProgress = (x - xStart) / (xEnd - xStart);
  xProgress = Math.max(0, Math.min(1, xProgress));
  return yStart * (1 - xProgress) + yEnd * xProgress;
}

// Handles mouse events
function updateCanvasMouse(e) {
  const bounds = canvas.getBoundingClientRect();
  mouseX = e.clientX - bounds.x;
  mouseY = e.clientY - bounds.y;
  updateCanvas();
}
