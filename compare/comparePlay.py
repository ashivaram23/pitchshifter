import numpy as np
import pyaudio


def play(filename):
    print(f"Playing {filename}")

    samples = []
    with open(filename, "r") as read_file:
        for line in read_file:
            samples.append(float(line))
    
    clip = np.array(samples, dtype="float32")
    if np.max(clip) > 1.0:
        print(f"Bad values {filename}\n")
        exit()
    
    # p = pyaudio.PyAudio()
    # stream = p.open(44100, 2, pyaudio.paFloat32, False, True)
    # interleaved = np.empty(clip.size * 2, dtype="float32")
    # interleaved[0::2] = clip
    # interleaved[1::2] = clip
    # stream.write(interleaved.tobytes())
    # stream.close()
    # p.terminate()

    return clip


play("brasspluck_raw.txt")
c_clip = play("compareCheckC.txt")
py_clip = play("compareCheckPy.txt")

differences = np.abs(c_clip - py_clip)
max_diff = np.max(differences)
diff_percent = 100 * (differences > 0.02).sum() / len(c_clip)
print(f"Max difference {max_diff:.2f}, percent >0.02 {diff_percent:.1f}%")
