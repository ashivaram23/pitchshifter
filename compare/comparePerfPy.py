import numpy as np
import scipy.signal
import sys
import time


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

        if i > 0:
            max_shift = int(44100 * 10 / 1000)
            overlap = frame_len - out_offset
            correlation = np.correlate(in_padded[in_start - max_shift : in_start + overlap + max_shift], in_padded[last_in_start + out_offset : last_in_start + out_offset + overlap])
            
            best_shift = np.argmax(correlation) - max_shift
            in_start += best_shift
            in_end += best_shift

        out_padded[out_start:out_end] += in_padded[in_start:in_end] * window
        out_max_amp[out_start:out_end] += window
        last_in_start = in_start
    
    np.seterr(invalid="ignore")
    out_padded = np.minimum(out_padded / out_max_amp, 1.0)
    np.seterr(invalid="warn")

    return out_padded[out_offset : out_offset + out_len]


samples = []
with open("brasspluck_raw.txt", "r") as read_file:
    for line in read_file:
        samples.append(float(line))

clip = np.array(samples, dtype="float32")
result = repitch(clip, float(sys.argv[1]), int(sys.argv[2]))
with open("compareCheckPy.txt", "w") as write_file:
        for item in result:
            write_file.write(f"{item:.5f}\n")

start_time = time.perf_counter()
for i in range(int(sys.argv[3])):
    repitch(clip, float(sys.argv[1]), int(sys.argv[2]))
print(f"Python\t{time.perf_counter() - start_time}")
