import numpy as np
import pyaudio
import scipy.io.wavfile
import sys


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

    for i in range(int(np.ceil(num_frames))):
        in_start = in_offset * i
        in_end = in_start + frame_len
        out_start = out_offset * i
        out_end = out_start + frame_len

        out_padded[out_start:out_end] += in_padded[in_start:in_end] * window
        out_max_amp[out_start:out_end] += window
    
    np.seterr(invalid="ignore")
    out_padded = np.minimum(out_padded / out_max_amp, 1.0)
    np.seterr(invalid="warn")

    return out_padded[out_offset : out_offset + out_len]


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

old_len = len(left_channel)
left_channel = time_stretch(left_channel, 2.0)
right_channel = time_stretch(right_channel, 2.0)
print(len(left_channel) / old_len)

# makes it go one octave higher
left_channel = left_channel[::2]
right_channel = right_channel[::2]

p = pyaudio.PyAudio()
stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
interleaved = np.empty(left_channel.size * 2, dtype="float32")
interleaved[0::2] = left_channel
interleaved[1::2] = right_channel
stream.write(interleaved.tobytes())
stream.close()
p.terminate()
