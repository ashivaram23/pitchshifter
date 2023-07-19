#include <cmath>
#include <vector>

extern "C" float *repitchAndStretch(float *data, int stretch, int semitones) {
  float multiplier = std::pow(1.05946, semitones);
  data[2] = 10;
  return data;
}
