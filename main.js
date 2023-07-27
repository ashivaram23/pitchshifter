// Check that browser supports key features here and add div to dom with message if not

const audioContext = new AudioContext({sampleRate: 44100});
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
let originalAudioLength = 0;
let currentAudioPosition = 0;
let lastAudioPlayTime = 0;

// Maybe have one nice neat currentSettings DICT and reference everything through there

// PROBLEM with sliders -- the idea was to let user type value between steps (only relevant for pitch slider, ie decimal values, and for segment length+overlap sliders integer values between multiples of 10 or 5), but setting the slider value in js automatically sets to nearest step
// Maybe have to store the value separately and always just update both slider (to closest) and label (and using that in processAudioBuffer instead of slider.value), and/or either somehow mimic step behavior in js without html step

const pitchSlider = document.getElementById("semitones");
const pitchLabel = document.getElementById("semitones-number");
pitchLabel.value = pitchSlider.value;
pitchSlider.addEventListener("input", (e) => pitchLabel.value = pitchSlider.value);
pitchSlider.addEventListener("change", processAudioBuffer);
pitchSlider.addEventListener("input", updateCanvas);
// pitchLabel.addEventListener(); validate and check bounds and round and format and update properly, and maybe do checks while typing?, and see which events make sense to use and arent confusing as to when it submits

const timeSlider = document.getElementById("time-stretch");
const timeLabel = document.getElementById("time-stretch-number");
const multiplierFormat = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
timeLabel.value = multiplierFormat.format(timeSlider.value);
timeSlider.addEventListener("input", (e) => timeLabel.value = multiplierFormat.format(timeSlider.value));
timeSlider.addEventListener("change", processAudioBuffer);
timeSlider.addEventListener("input", updateCanvas);
// timeLabel.addEventListener();

// add warnings in potentially slow individual choices AND COMBINATIONS of choices for these sliders, and also notices for potentially glitch/artifact causing (intended behavior) values and combinations of values
const segmentLengthSlider = document.getElementById("segment-length");
const segmentLengthLabel = document.getElementById("segment-length-number");
segmentLengthLabel.value = segmentLengthSlider.value;
segmentLengthSlider.addEventListener("input", (e) => segmentLengthLabel.value = segmentLengthSlider.value);
segmentLengthSlider.addEventListener("change", processAudioBuffer);
segmentLengthSlider.addEventListener("input", updateCanvas);
// segmentLengthLabel.addEventListener();

const segmentOverlapSlider = document.getElementById("segment-overlap");
const segmentOverlapLabel = document.getElementById("segment-overlap-number");
segmentOverlapLabel.value = segmentOverlapSlider.value;
segmentOverlapSlider.addEventListener("input", (e) => segmentOverlapLabel.value = segmentOverlapSlider.value);
segmentOverlapSlider.addEventListener("change", processAudioBuffer);
segmentOverlapSlider.addEventListener("input", updateCanvas);
// segmentOverlapLabel.addEventListener();

const maxShiftSlider = document.getElementById("max-shift");
const maxShiftLabel = document.getElementById("max-shift-number");
maxShiftLabel.value = maxShiftSlider.value;
maxShiftSlider.addEventListener("input", (e) => maxShiftLabel.value = maxShiftSlider.value);
maxShiftSlider.addEventListener("change", processAudioBuffer);
maxShiftSlider.addEventListener("input", updateCanvas);
// maxShiftLabel.addEventListener();

const canvas = document.getElementById("visualization");
const context = canvas.getContext("2d");
const canvasWidth = 600;
const canvasHeight = 160;
setupCanvas();
updateCanvas();

function resetAllSettings() {
  pitchSlider.value = 0;
  pitchLabel.value = pitchSlider.value;

  timeSlider.value = 1.00;
  timeLabel.value = multiplierFormat.format(timeSlider.value);

  segmentLengthSlider.value = 100;
  segmentLengthLabel.value = segmentLengthSlider.value;

  segmentOverlapSlider.value = 30;
  segmentOverlapLabel.value = segmentOverlapSlider.value;

  maxShiftSlider.value = 10;
  maxShiftLabel.value = maxShiftSlider.value;
}

function openFile(event) { // check length of audio here, either limit to x minutes (like 3-5?) or limit to a slightly higher y minutes (like 5-7?) but also warn for the upper numbers that it will be SLOW and take a LOT of memory
  toggleInputEnabled(false); // THIS DOESNT WORK RIGHT btw, the timing of it specifically. Also once get it to work within processAudioBuffer, delete it from this function because not needed
  const file = fileChooser.files[0];
  const filenameLabel = document.getElementById("filename");
  filenameLabel.innerText = file.name; // Why does this update after wasm processing when opening big file? shouldnt this happen first and synchronously? might have to do with the actual dom not updating right away, maybe similar with the input enable issue

  const reader = new FileReader();
  reader.onload = (e) => {
    audioContext.decodeAudioData(e.target.result).then((audioBuffer) => {
      originalAudioLength = audioBuffer.duration;
      originalAudioBuffer = audioBuffer; // Consider not keeping this for memory efficiency purposes... and just read the file every time
      activeAudioBuffer = audioBuffer;
      processAudioBuffer();
    }).then(updateCanvas).then(toggleInputEnabled(true));
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
  toggleInputEnabled(false); // This should gray out, but it's not happening, problem isnt with the function called here, it's something about dom not updating right away synchronously in step even though you would expect it to be ? Also if moving wasm part to new thread happens to stop this behavior, should still probably fix it regardless of that.
  console.log("Disable");

  await wasmSource.then(source => { 
    let newAudioBuffer;
    
    for (let i = 0; i < originalAudioBuffer.numberOfChannels; i++) { // can this go in new thread/worker (should still gray out the sliders while it works)
      const channelData = originalAudioBuffer.getChannelData(i);
      let inputPointer = source.instance.exports.allocateInputMemory(channelData.length);
      new Float32Array(memory.buffer).set(channelData, inputPointer / 4);

      let outputPointer = source.instance.exports.repitchAndStretch(inputPointer, channelData.length, timeSlider.value, pitchSlider.value, segmentLengthSlider.value, segmentLengthSlider.value - segmentOverlapSlider.value, maxShiftSlider.value);
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

    currentAudioLength = activeAudioBuffer.duration;
    document.getElementById("playback-length").innerText = secondsToTime(currentAudioLength);
    const uncompressedSizeBytes = currentAudioLength * activeAudioBuffer.numberOfChannels * 44100 * 4;
    const uncompressedSizeMB = Math.round(uncompressedSizeBytes / 1e4) / 1e2;
    document.getElementById("download").innerText = `Download (${uncompressedSizeMB} MB)`;
    const totalStretch = timeSlider.value * Math.pow(1.05946, pitchSlider.value);
    document.getElementById("details").innerText = `Input ${Math.round(originalAudioLength*100)/100} sec, time stretched to ${Math.round(originalAudioLength * totalStretch*100)/100} sec, resampled to ${Math.round(currentAudioLength*100)/100} sec with ${pitchSlider.value} semitone shift`;
  });
  toggleInputEnabled(true); // Doesnt work, see comments above same reason -- this happens instantaneously after disabling presumably (can even see the blink on firefox), and behavior is no different if keep both enable and disable within the await part btw?? even though thats all supposed to happen synchronously. and something similar when open file, maybe?
  console.log("Enable"); // This works fine though. so it's probably just about the DOM actually updating after setting value not happening in perfect order. So find a different way
}

function toggleInputEnabled(enabled) {
  for (element of document.getElementsByTagName("input")) {
    element.disabled = !enabled;
  }
}

function secondsToTime(seconds) {
  let wholeSeconds = Math.round(seconds);
  let wholeMinutes = Math.floor(wholeSeconds / 60);
  let secondsRemainder = wholeSeconds - wholeMinutes * 60;

  return `${wholeMinutes}:${secondsRemainder < 10 ? "0" : ""}${secondsRemainder}`;
}

function growMemory() {
  console.log("Growing WebAssembly memory");
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

function updateCanvas() { // clean this code up massively, also make hover effect highlight the part in input
  context.restore();
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "gray";
  context.strokeStyle = "lightgray";
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  const margin = 10;
  const barHeight = 15;

  const numBarsFitting = canvasWidth / (segmentLengthSlider.value - segmentOverlapSlider.value);
  const zoom = interpolate(numBarsFitting, 12, 60, 1.2, 2.6);
  const timescaleMax = (canvasWidth - margin) / zoom;
  for (let i = 0; i < timescaleMax; i += 20) {
    const scaleX = margin + i *zoom;
    context.lineWidth = i % 100 == 0 ? 1.5 : 0.6;
    context.beginPath();
    context.moveTo(scaleX, margin + barHeight);
    context.lineTo(scaleX, canvasHeight);
    context.stroke();
  }

  context.lineWidth = 1;
  
  context.fillStyle = "blue";
  context.fillRect(margin, margin, canvasWidth - margin, barHeight); // Label as input

  let outputYBase = margin + 25;
  const outputOffset = segmentLengthSlider.value - segmentOverlapSlider.value;
  const segmentWidth = segmentLengthSlider.value;

  const inputLength = originalAudioLength > 0 ? originalAudioLength * 1000 : (outputOffset * 10 + segmentOverlapSlider.value);
  const totalStretch = timeSlider.value * Math.pow(1.05946, pitchSlider.value);
  const outputLength = totalStretch * inputLength;
  const numSegments = Math.ceil((outputLength - segmentOverlapSlider.value) / outputOffset);
  const inputOffset = Math.ceil((inputLength - segmentLengthSlider.value) / (numSegments - 1));

  // what happens to the lines for ones past i=8? maybe need to set i's max based on changing horizontal fit (of input output max!) not constant vertical ie 8. though that would also be REALLY cluttered... also a separate issue, maybe make them more transparent with each next, or dotted or something, or change colors in a non cluttered way
  const maxNumBars = 18;
  const colors = ["red", "orange", "yellow", "green"]; // replace with a much better set of colors
  for (let i = 0; i < maxNumBars + 1; i++) { 
    // Label somewhere as output
    const rectX = margin + outputOffset * i * zoom;
    const rectY = outputYBase + barHeight * i;

    context.strokeStyle = "black";
    context.fillStyle = "lightblue"
    context.fillRect(rectX, rectY, segmentWidth * zoom, barHeight);
    
    
    const inputX = margin + inputOffset * i * zoom;
    const inputY = margin + (barHeight / 2) + (i % 2 == 0 ? -1 : 1) * 3;
    // const colorR = Math.floor(interpolate(i, 0, 10, 10, 100));
    // const colorG = Math.floor(interpolate(i, 0, 10, 255, 200));
    // const colorB = Math.floor(interpolate(i, 0, 10, 70, 90));
    // const colorA = Math.floor(interpolate(i, 0, 10, 100, 100));
    // context.strokeStyle = `rgb(${colorR} ${colorG} ${colorB} / ${colorA}%)`;
    // context.fillStyle = context.strokeStyle;
    context.strokeStyle = colors[i % colors.length];
    context.fillStyle = context.strokeStyle; // if using this approach, obviously make a much nicer looking color set that doesnt clash with anything and doesnt look circus rainbowy and has consistent brightness changes etc. and maybe consider making the output blocks those colors too and their strokes, that would be much neater
    context.strokeRect(rectX, rectY, segmentWidth * zoom, barHeight);

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
  } // add the (always parallel, different angles) lines that go from each output segment to corresponding part in input based on inputOffset calculation. may be a little messy, but user should also be able to hover to highlight an individual segment
  // also add max shift bars in the input lines areas, maybe only when hover if too cluttered? or maybe just a very small uncluttered way of representing that gets clear when hover, just so that change can be shown when sliders since this is the main part of wsola

  context.strokeStyle = "red";
  context.strokeRect(0, 140, canvasWidth, 20); // make this gradient fading from transparent to background gray? and do same on vertical right side?
}

function interpolate(x, xStart, xEnd, yStart, yEnd) {
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
Maybe slider can have 50-250 ms segments, 0 - 40 overlap, 0 - 15 max shift. Warn at slow values and slow COMBINATIONS of values that it will be slow or inefficient etc where applicable, and also "warn" to expect glitchy result or specific artifacts when user picks glitchy values

Fix/finish the slider and controls interface, properly making the text field and sliders work, properly limiting the values users can select, with possible allowance of eg decimal pitch values by typing in number field but still not out of bounds, etc
Make everything full and consistent in terms of what can be selected, how everything updates in concert accordingly, what values can be picked and/or entered, etc.
And whatever code needed to validate inputs, maybe on keypresses or maybe just when enter, etc

The entire canvas visualization part. Proper movement and alignment of things, including with different params etc, canvas looks sharp and works smoothly (right proportions and all the complications about width height pixel ratio in the dom and in its own coordinate system etc,,, and then how THAT will work with the responsive resizing in general as mentioned in another item below "hassle parts"), updates and interactive as needed, clearly visualizes the algorithm including maybe with hover or click changes that work with touch too, etc
All elements of it and looking good including with the cosine windows, the overlaps, the time marks, and the text at the bottom summarizing the stretch and the compensatory resample and how that -->s the end result of x pitch and y tempo change. with nice colors and shapes and proportions that work with the rest of it

The playback time bar, making that match up with the playing, making it move consistently (without inefficiently constantly checking hopefully) and sync with the true elapsed time, allowing user to seek and everything consistently changes accordingly including the text labels, which should update every second and stay in sync somehow,,, (and remove the decimal on the total length for consistency)
Also a return to start button after play
And maybe making it not sound abrupt click whenever user pauses or plays, which might involve gain node?
And making the whole playback part look right like with play pause icons correctly, slider css to look like and be interactable with as if time playback bar

Fun fact "warnings" about what to expect if the user selects weird (but still in bounds of course, nothing else should be possible) values like 0 max shift etc, either for the intended effects like glitchy (cool fun fact), or an actual warning that it may take longer with these values
Could also allow for a bit extra room for file length eg more than 5 minutes (but not too much more) and just make those higher values have a warning like that/

Behaviors of play pause audio position buffersourcenode etc and how those stop when eg new file loaded or sliders changed, fixing bugs like in firefox ended event, adding a loading grayout while wasm code executing,
Things happening smoothly, like rearranging so that when change slider the immediate visual changes (resets) happen right away as opposed to after wasm code

Formatting -- all the divs and padding and fonts and margins, etc, all the design elements and slightly rounded corners and so on, and specific css for everything for the buttons and sliders and text inputs and so on, colors, etc
And then the hassle parts about responsiveness on different window sizes, devices, browsers etc, should it be flexible, should it be based on some window size thing or hardcoded px, how do these css things even work, how should it change when resize, etc

Confirming that this approach to the audio (like storing whole audio buffer and playing it this way etc) makes sense and is the most efficient clean way to do it in the first place, and same checks for the other ways doing things, including smaller things like the organization flow of the js events and so on, or the way handling wasm instance like when do each step, or whether the way copy and make and store arrays is cluttering, etc
And in general, cleaning up and refactoring the code to be consistent and not have all that clutter of different things

Making the download button work, properly either packing audio buffer to uncompressed wav, or ogg opus compression, writing C code withh libopus or libopusenc for pcm float32 -> opus, and libogg to contain in ogg file (or could just have libavcodec do it all) and making that another wasm module
At least put the uncompressed size next to or in the download button then

Making the C code (testably) faster and cleaner where possible (including maybe with wasm simd -- but if so, have to take into account how thats supported, and make sure it makes a testable improvement first)

Making the JS more efficient where possible, including more MEMORY efficient, like maybe not storing original buffer and instead rereading from file every time, or (maybe bad idea) killing wasm instance every now and then when new file and excess grown memory not needed and hope it garbage collects, etc

Threads etc: the audiocontext stuff is probably already on a separate thread by default. However the wasm instance running may not be since it seems to block and cause lag, so can put that on a new web worker or however that works
Separately, if want to, within the c code could also use pthreads for eg the dot product parts if it makes it testably better, and make sure to implement that correctly on the js side too including the security environment things that need to be set etc. And theres also simd to try if it results in testably better performance, keeping in mind browser compatibility in defauly user settings etc.

Explanatory informative explanation text usefully and clearly explaining the things at play here, etc including sources (both for the algorithm and also, separately, about the things in code like if end up adapting that one article's example to save to wav), finalizing the text at the top too
And in addition, maybe mention a bit about implementation details incl eg problems for user to know like the fact that since this processes whole thing as uncompressed, expect __, or if you select xyz values, expect __

Checking the whole thing for consistency and proper functionality across different browsers and devices including mobile touch etc, both for the code working, working fast, memory usage proper, interaction behavioral smoothly without bugs, accessible, user can click touch properly, and of course visual appearance as intended etc

And all the stuff needed for it to work as an actual site online of course, any finishing touches for code to be final, git things?, etc
*/
