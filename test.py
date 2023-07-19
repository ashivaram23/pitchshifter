import numpy as np
import pyaudio
import scipy.io.wavfile
import sys


def repitch(input, stretch, semitones):
    multiplier = np.power(1.05946, semitones)
    stretched = time_stretch(input, stretch * multiplier)
    return resample(stretched, multiplier)


def resample(input, speed):
    out_len = int(len(input) / speed)
    new_x = np.linspace(0, len(input), out_len)
    old_x = np.arange(len(input))
    return np.interp(new_x, old_x, input)


def time_stretch(input, multiplier):
    frame_len = int(44100 * 100 / 1000)
    out_offset = int(44100 * 70 / 1000)

    in_len = len(input)
    out_len = int(len(input) * multiplier)

    in_padded_len = in_len + 2 * out_offset
    out_padded_len = out_len + 2 * out_offset

    num_frames = 1 + (out_padded_len - frame_len) / out_offset
    in_offset = int((in_padded_len - frame_len) / (num_frames - 1))

    in_padded = np.zeros(int(in_offset * (np.ceil(num_frames) - 1) + frame_len), dtype="float32")
    in_padded[out_offset : out_offset + in_len] = input
    out_padded = np.zeros(int(out_offset * (np.ceil(num_frames) - 1) + frame_len), dtype="float32")
    out_max_amp = out_padded.copy()

    window = np.linspace(0, 2 * np.pi, frame_len)
    window = (1 - np.cos(window)) / 2

    last_in_start = 0
    for i in range(int(np.ceil(num_frames))):
        in_start = in_offset * i
        in_end = in_start + frame_len
        out_start = out_offset * i
        out_end = out_start + frame_len

        # comment this part out to see difference without wsola
        if i > 0:
            max_shift = int(44100 * 10 / 1000)
            overlap = frame_len - out_offset
            correlation = np.correlate(in_padded[in_start - max_shift : in_start + overlap + max_shift], in_padded[last_in_start + out_offset : last_in_start + out_offset + overlap])
            # correlation = np.correlate(in_padded[in_start - max_shift : in_end + max_shift], in_padded[last_in_start + out_offset : last_in_start + out_offset + frame_len])
            
            best_shift = np.argmax(correlation) - max_shift
            in_start += best_shift
            in_end += best_shift

        # for neatness should create np zeros of fixed length first for in_padded and then copy over to avoid any potential broadcast size mismatches, which happen for a few unlucky inputs
        # python3 test8.py piano1.wav 1.5 -4 FAILS, so again could create array first to bandage, or ideally prevent them happening in the first place (or maybe theyre supposed to happen, because of the shifts? but find out why they happen)
        # python3 test8.py brasspluck.wav 1.51 -5
        # if not using numpy those would be out of bounds problems, either way ensure cant happen here and above
        out_padded[out_start:out_end] += in_padded[in_start:in_end] * window
        out_max_amp[out_start:out_end] += window
        last_in_start = in_start
    
    np.seterr(invalid="ignore")
    out_padded = np.minimum(out_padded / out_max_amp, 1.0)
    np.seterr(invalid="warn")

    return out_padded[out_offset : out_offset + out_len]


# python3 test8.py [filename] [time stretch, float] [semitone change, int]
_, data = scipy.io.wavfile.read(sys.argv[1])

clip = np.array(data, dtype="float32")
max_amp = 1.0 if data.dtype == np.float32 else np.iinfo(data.dtype).max
clip /= max(max_amp, np.max(np.abs(clip)))

if len(clip.shape) == 1:
    left_channel = clip
    right_channel = clip
else:
    left_channel = clip[:, 0]
    right_channel = clip[:, 1]

left_channel = repitch(left_channel, float(sys.argv[2]), int(sys.argv[3]))
right_channel = repitch(right_channel, float(sys.argv[2]), int(sys.argv[3]))

p = pyaudio.PyAudio()
stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
interleaved = np.empty(left_channel.size * 2, dtype="float32")
interleaved[0::2] = left_channel
interleaved[1::2] = right_channel
stream.write(interleaved.tobytes())
stream.close()
p.terminate()
