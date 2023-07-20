import numpy as np
import pyaudio
import scipy.io.wavfile
import sys
import time


def repitch(input, stretch, semitones):
    multiplier = np.power(1.05946, semitones)
    stretched = time_stretch(input, stretch * multiplier)
    return resample(stretched, multiplier)


def resample(input, speed):
    out_len = int(len(input) / speed)
    # print(f"Out len resamp {out_len}")
    new_x = np.linspace(0, len(input), out_len)
    # for i in range(6000, 6010):
    #     print(f"R {i} {new_x[i]}")

    old_x = np.arange(len(input))
    vals = np.interp(new_x, old_x, input)
    # for i in range(6000, 6010):
    #     print(f"V {i} {vals[i]:.5f}")

    return vals


def time_stretch(input, multiplier):
    frame_len = int(44100 * 100 / 1000)
    out_offset = int(44100 * 70 / 1000)

    in_len = len(input)
    out_len = int(len(input) * multiplier)
    # print(f"out length {out_len}")

    in_padded_len = in_len + 2 * out_offset
    out_padded_len = out_len + 2 * out_offset

    num_frames = 1 + (out_padded_len - frame_len) / out_offset
    in_offset = int((in_padded_len - frame_len) / (num_frames - 1))
    # print(f"Num seg {int(np.ceil(num_frames))}")

    in_padded = np.zeros(int(in_offset * (np.ceil(num_frames) - 1) + frame_len), dtype="float32")
    in_padded[out_offset : out_offset + in_len] = input
    out_padded = np.zeros(int(out_offset * (np.ceil(num_frames) - 1) + frame_len), dtype="float32")
    out_max_amp = out_padded.copy()

    # window = np.linspace(0, 2 * np.pi, frame_len)
    # window = (1 - np.cos(window)) / 2
    window = np.ones(frame_len)

    print_count = 0
    last_in_start = 0
    for i in range(int(np.ceil(num_frames))):
        in_start = in_offset * i
        in_end = in_start + frame_len
        out_start = out_offset * i
        out_end = out_start + frame_len

        # if i == 70:
        #     print(f"i 70 {in_start - out_offset} {out_start - out_offset} {in_padded[in_start]}")

        # if print_count < 10:
        #     print(f"input start {i} {in_start - out_offset}")
        #     print_count += 1

        # if i > 0:
        #     max_shift = int(44100 * 10 / 1000)
        #     overlap = frame_len - out_offset
        #     correlation = np.correlate(in_padded[in_start - max_shift : in_start + overlap + max_shift], in_padded[last_in_start + out_offset : last_in_start + out_offset + overlap])
            
        #     best_shift = np.argmax(correlation) - max_shift
        #     in_start += best_shift
        #     in_end += best_shift

        out_padded[out_start:out_end] += in_padded[in_start:in_end] * window
        out_max_amp[out_start:out_end] += window
        last_in_start = in_start

        # if i == 70:
        #     print(f"i 70 out {out_max_amp[out_start]}")
    
    np.seterr(invalid="ignore")
    out_padded = np.minimum(out_padded / out_max_amp, 1.0)
    np.seterr(invalid="warn")

    return out_padded[out_offset : out_offset + out_len]


# _, data = scipy.io.wavfile.read(sys.argv[1])

# clip = np.array(data, dtype="float32")
# max_amp = 1.0 if data.dtype == np.float32 else np.iinfo(data.dtype).max
# clip /= max(max_amp, np.max(np.abs(clip)))

# if len(clip.shape) == 1:
#     left_channel = clip
#     right_channel = clip
# else:
#     left_channel = clip[:, 0]
#     right_channel = clip[:, 1]

# filename = sys.argv[1][:-4] + "_raw.txt"
# with open(filename, "w") as save_output:
#     for sample in left_channel:
#         save_output.write(f"{sample:.5f}\n")

# left_channel = repitch(left_channel, float(sys.argv[2]), int(sys.argv[3]))
# right_channel = repitch(right_channel, float(sys.argv[2]), int(sys.argv[3]))


samples = []
with open(sys.argv[1], "r") as file:
    for line in file:
        samples.append(float(line))

clip = np.array(samples, dtype="float32")

start_time = time.perf_counter()
for i in range(100):
    result = repitch(clip, float(sys.argv[2]), int(sys.argv[3]))
    # with open("brasspluck_pycheck.txt", "w") as out_file:
    #     for item in result:
    #         out_file.write(f"{item:.5f}\n")
print(time.perf_counter() - start_time)

# if np.max(clip) > 1.0:
#     print("bad values\n")
#     exit()

# # p = pyaudio.PyAudio()
# # stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
# # interleaved = np.empty(clip.size * 2, dtype="float32")
# # interleaved[0::2] = clip
# # interleaved[1::2] = clip
# # stream.write(interleaved.tobytes())
# # stream.close()
# # p.terminate()



# csamples = []
# with open("brasspluck_ccheck.txt", "r") as file:
#     for line in file:
#         csamples.append(float(line))

# pysamples = []
# with open("brasspluck_pycheck.txt", "r") as file1:
#     for line in file1:
#         pysamples.append(float(line))

# already_saw = False
# with open("diffs.txt", "w") as outfile:
#     for i in range(len(csamples)):
#         if (csamples[i] - pysamples[i] > 0.09) and not already_saw:
#             print(f"Start diff {i}")
#             already_saw = True
#         outfile.write(f"{(csamples[i] - pysamples[i]):.5f}\n")

# clip = np.array(pysamples, dtype="float32")

# if np.max(clip) > 1.0:
#     print(f"{np.max(clip)} bad values\n")
#     exit()

# p = pyaudio.PyAudio()
# stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
# interleaved = np.empty(clip.size * 2, dtype="float32")
# interleaved[0::2] = clip
# interleaved[1::2] = clip
# stream.write(interleaved.tobytes())
# stream.close()
# p.terminate()
