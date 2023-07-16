import numpy as np
import pyaudio
import scipy.io.wavfile
import sys


# DISGUSTING CODE EVERYWHERE but works (basic OLA with no/square window function) with artifacts and not perfectly ?? need SOMETHING about the padding
# both for the before(?) and after due to the nature of the window overlap stuff in first place (and correspondingly for the input otherwise it wont work?), but also for the separate end round-up thing which is currently messily bandaged
# and those two might affect each other ofc, and then have to retrim properly at end
# zero pad input and output by respective offset sizes before start. then, on TOP of that, for ease first round up the length (length INCLUDING the start padding in the calculation, so I guess that would also have to have been included in the num frames before too) to frame count ceiling result, and then final question is does there need to be addditional (possibly overlapping) padding at the end?

# also cant min the window max amp at 1 because still need to compensate if less, just do normally and then clip to ensure all = 1 no rounding mess
# end is pad offset first then round combined value up?
def time_stretch(input, multiplier):
    frame_size = 100
    out_offset = 70

    output = np.zeros(int(np.ceil(len(input) * multiplier)), dtype="float32")
    input_ms = 1000 * len(input) / 44100
    output_ms = 1000 * len(output) / 44100

    num_frames = int(np.ceil((output_ms - (frame_size - out_offset)) / out_offset))
    in_offset = (input_ms - frame_size) / (num_frames - 1)

    output_max_amp = np.zeros(len(output), dtype="float32")
    window = np.ones(int(44100 * frame_size / 1000), dtype="float32")

    for i in range(num_frames - 1):
        out_start = int(44100 * (out_offset * i) / 1000)
        out_end = out_start + int(44100 * (frame_size) / 1000)

        in_start = int(44100 * (in_offset * i) / 1000)
        in_end = in_start + int(44100 * (frame_size) / 1000)

        output[out_start:out_end] += input[in_start:in_end] * window[:(input[in_start:in_end].size)]
        output_max_amp[out_start:out_end] += window

    output_max_amp = np.maximum(output_max_amp, 1.0)
    output /= output_max_amp
    return output


# stereo audio 44.1 kHz, make more general ofc
_, data = scipy.io.wavfile.read(sys.argv[1])

clip = np.array(data, dtype="float32")
max_amp = 1.0 if data.dtype == np.float32 else np.iinfo(data.dtype).max
clip /= max(max_amp, np.max(np.abs(clip)))

left_channel = clip[:, 0]
right_channel = clip[:, 1]

stretched_left = left_channel
stretched_right = right_channel
stretched_left = time_stretch(left_channel, 1.0)
stretched_right = time_stretch(right_channel, 1.0)

p = pyaudio.PyAudio()
stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
interleaved = np.empty(stretched_left.size * 2, dtype="float32")
interleaved[0::2] = stretched_left
interleaved[1::2] = stretched_right
stream.write(interleaved.tobytes())
stream.close()
p.terminate()
