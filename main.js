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
let playing = false;
let currentAudioLength = 0;
let currentAudioPosition = 0;
let lastAudioPlayTime = 0;

const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-label");
pitchSlider.addEventListener("input", (e) => pitchLabel.innerText = pitchSlider.value);
pitchSlider.addEventListener("change", processAudioBuffer);
// Set these values explicitly and/or match the labels at the start because when reloading page, some browsers keep the slider movement

const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-label");
const multiplierFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeSlider.addEventListener("input", (e) => timeLabel.innerText = multiplierFormat.format(timeSlider.value));
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
      originalAudioBuffer = audioBuffer; // Consider not keeping this for memory efficiency purposes... and just read the file every time
      activeAudioBuffer = audioBuffer;
      processAudioBuffer();
    });
  };
  reader.readAsArrayBuffer(file);
}

function playAudio(event) {
  if (playing) {
    currentAudioPosition += audioContext.currentTime - lastAudioPlayTime;
    console.log(currentAudioPosition);
    endAudioPlayback();
    return;
  }

  if (originalAudioBuffer == undefined) {
    return;
  }

  playing = true;
  playButton.innerText = "Pause";
  lastAudioPlayTime = audioContext.currentTime;

  bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = activeAudioBuffer;
  bufferSource.addEventListener("ended", (e) => {
    console.log("Send ended"); // This randomly fires repeatedly at unexpected times in firefox, fix that!
    currentAudioPosition = 0;
    endAudioPlayback();
  });

  bufferSource.connect(audioContext.destination);
  bufferSource.start(undefined, currentAudioPosition);
}

function endAudioPlayback() {
  playing = false;
  playButton.innerText = "Play";
  if (bufferSource != undefined) {
    bufferSource.disconnect(audioContext.destination);
    bufferSource = undefined;
  }
}

async function processAudioBuffer() {
  currentAudioPosition = 0;
  endAudioPlayback();

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

    currentAudioLength = activeAudioBuffer.duration;
    document.getElementById("playback-length").innerText = secondsToTime(currentAudioLength);
  });
}

function secondsToTime(seconds) {
  let wholeSeconds = Math.floor(seconds);
  let wholeMinutes = Math.floor(seconds / 60);
  
  let secondsRemainder = wholeSeconds - wholeMinutes * 60;
  let decimalRemainder = Math.floor(100 * (seconds - wholeSeconds));

  return `${wholeMinutes}:${secondsRemainder < 10 ? "0" : ""}${secondsRemainder}.${decimalRemainder < 10 ? "0" : ""}${decimalRemainder}`;
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

/*
--------------------------------------------------
"Unfinished"/"todo" things in no particular order
not that any of this will necessarily be done
--------------------------------------------------

Checking and adding warnings for browser incompatibility at the start

Check file for under 5 min

Add controls for segment size, max shift, output overlap and update C code to take those, and web interface to properly fit them in

Fix/finish the slider and controls interface, properly making the text field and sliders work, properly limiting the values users can select, with possible allowance of eg decimal pitch values by typing in number field but still not out of bounds, etc
Make everything full and consistent in terms of what can be selected, how everything updates in concert accordingly, what values can be picked and/or entered, etc.
And whatever code needed to validate inputs, maybe on keypresses or maybe just when enter, etc

The entire canvas visualization part. Proper movement and alignment of things, including with different params etc, canvas looks sharp and works smoothly (right proportions and all the complications about width height pixel ratio in the dom and in its own coordinate system etc,,, and then how THAT will work with the responsive resizing in general as mentioned in another item below "hassle parts"), updates and interactive as needed, clearly visualizes the algorithm including maybe with hover or click changes that work with touch too, etc
All elements of it and looking good including with the cosine windows, the overlaps, the time marks, and the text at the bottom summarizing the stretch and the compensatory resample and how that -->s the end result of x pitch and y tempo change. with nice colors and shapes and proportions that work with the rest of it

The playback time bar, making that match up with the playing, making it move consistently (without inefficiently constantly checking hopefully) and sync with the true elapsed time, allowing user to seek and everything consistently changes accordingly including the text labels, which should update every second and stay in sync somehow,,, (and remove the decimal on the total length for consistency)
Also a return to start button after play
And making the whole playback part look right like with play pause icons correctly, slider css to look like and be interactable with as if time playback bar

Fun fact "warnings" about what to expect if the user selects weird (but still in bounds of course, nothing else should be possible) values like 0 max shift etc, either for the intended effects like glitchy (cool fun fact), or an actual warning that it may take longer with these values
Could also allow for a bit extra room for file length eg more than 5 minutes (but not too much more) and just make those higher values have a warning like that/

Behaviors of play pause audio position buffersourcenode etc and how those stop when eg new file loaded or sliders changed, fixing bugs like in firefox ended event, adding a loading grayout while wasm code executing,
Things happening smoothly, like rearranging so that when change slider the immediate visual changes (resets) happen right away as opposed to after wasm code

Formatting -- all the divs and padding and fonts and margins, etc, all the design elements and slightly rounded corners and so on, and specific css for everything for the buttons and sliders and text inputs and so on, colors, etc
And then the hassle parts about responsiveness on different window sizes, devices, browsers etc, should it be flexible, should it be based on some window size thing or hardcoded px, how do these css things even work, how should it change when resize, etc

Confirming that this approach to the audio (like storing whole audio buffer and playing it this way etc) makes sense and is the most efficient clean way to do it in the first place, and same checks for the other ways doing things, including smaller things like the organization flow of the js events and so on, or the way handling wasm instance like when do each step, or whether the way copy and make and store arrays is cluttering, etc
And in general, cleaning up and refactoring the code to be consistent and not have all that clutter of different things

Making the download button work, properly either packing audio buffer to uncompressed wav, or maybe even somehow compressing to mp3 if theres a built in functionality for that

Making the C code (testably) faster and cleaner where possible (including maybe with wasm simd -- but if so, have to take into account how thats supported, and make sure it makes a testable improvement first)

Making the JS more efficient where possible, including more MEMORY efficient, like maybe not storing original buffer and instead rereading from file every time, or (maybe bad idea) killing wasm instance every now and then when new file and excess grown memory not needed and hope it garbage collects, etc

Explanatory informative explanation text usefully and clearly explaining the things at play here, etc including sources, finalizing the text at the top too
And in addition, maybe mention a bit about implementation details incl eg problems for user to know like the fact that since this processes whole thing as uncompressed, expect __, or if you select xyz values, expect __

Checking the whole thing for consistency and proper functionality across different browsers and devices including mobile touch etc, both for the code working, working fast, memory usage proper, interaction behavioral smoothly without bugs, accessible, user can click touch properly, and of course visual appearance as intended etc

And all the stuff needed for it to work as an actual site online of course, any finishing touches for code to be final, git things?, etc
*/
