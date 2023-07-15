import numpy as np
import pyaudio
import scipy.io.wavfile
import sys


_, data = scipy.io.wavfile.read(sys.argv[1])

clip = np.array(data, dtype="float32")
max_amp = 1.0 if data.dtype == np.float32 else np.iinfo(data.dtype).max
clip /= max(max_amp, np.max(np.abs(clip)))

left_channel = clip[:, 0]
right_channel = clip[:, 1]

# p = pyaudio.PyAudio()
# stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
# interleaved = np.empty(clip.size, dtype="float32")
# interleaved[0::2] = left_channel
# interleaved[1::2] = right_channel
# stream.write(interleaved.tobytes())
# stream.close()
# p.terminate()


FRAME_SIZE_MS = 100
OUT_OVERLAP_MS = 30

def time_stretch(channel, multiplier):
    frame_size = 100
    out_overlap = 30

    out_len = int(np.ceil(len(channel) * multiplier))
    num_frames = out_len - frame_size
    for i in range(num_frames):
        pass
    
    return output[:out_len]



# def time stretch
    # frame size = 100 ms
    # output offset = 70 ms
    # out len = int(np.ceil(len(channel) * multiplier))
    # num frames = ceil(outlen / outoffset) OR could do ceil((outlen - overlap) / offset) where overlap is eg 30, ie 100-70
    
    # example 10 frames 730 ms output, if the input was 415 and user asked 1.759x stretch, (70*9 + 100) / (35*9 + 100) = Ratio
    # inLength = inOffset*(numFrames-1) + frameSize
    # inOffset = (inLength - frameSize) / (numFrames-1)

    # if user gives 1000ms asks for 1.5x, this will first:
    # outlen = 1500
    # numframes = ceil((1500-30)/70) = 21 frames. 20*70 + 100 is indeed 1500
    # inOffset = (1000 - 100) / 20 = 45. 20*45 + 100 is indeed 1000

    # then we have the positions. if basic ola, just iterate for loop through num frames
    # for each frame simply copy over for now (yes will get nasty amp spikes)
    # then add crossfade and adjust for amp if windows dont add to 1
    # how to add crossfade? simply np multiply by a ratio array of frame size that has the window function
    








'''
try replaying back (organize everything in functions as before for ease)

if that works perfectly, clarify the datatype bit depth etc, format, max value etc things then continue:
(for each channel) wsola pitch shift
re interleave and play and save
(also meanwhile can make use of scipy fft etc to visualize better)

do it but in c++ efficiently and optimizedly for wasm
have a few variables for exposed controls
tie it to a web interface, add live playback and etc

always add limiter/clamper for safety







BASIC OVERLAP ADD (not waveform similarity)
Input = array of 44100*seconds samples, to be stretched by some amount
Using analysis windows of, for example, 100ms (4410 samples)
With a variable skip length based on the fixed skip (eg maybe ~ 30ms) from the output
See how much need to stretch output (account for padding to keep everything round) (based on input parameter)
Based on that, calculate how many frames needed
Then determine the skip size and the corresponding locations (IF DOING WAVEFORM SIMILARITY, here is where that comes in) to get them from from input
For each such frame, (1) copy input samples (2) apply windowing (3) add to corresponding part in out
When done, retrim if padding above, etc to ensure final time stretched output done
(Just do time stretch here, repurpose it for pitch outside of the function by doing the appropriate resampling)


Determine output length, (round up to nearest frame multiple and pad???) and create zeros array
Calculate number of 100ms chunks given eg 30ms overlap (with known neatly-summing windowing functions to use later)
Assign each chunk a corresponding naive location in input
For each chunk, go to the input location, find nudge for max waveform similarity (just iterate over all?), apply window, and add to out
Process output appropriately if needed and return
'''