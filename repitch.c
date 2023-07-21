#include <cblas.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

struct result {
  float *resultData;
  long resultLength;
};

long resample(float *input, long inputLength, float **output, float speed) {
  long outputLength = inputLength / speed;
  *output = calloc(outputLength, sizeof(float));

  for (long i = 0; i < outputLength; i++) {
    float correspondingIndex = i * (inputLength / (float)outputLength);
    long lowIndex = floor(correspondingIndex);
    long highIndex = ceil(correspondingIndex);
    float interpolate = correspondingIndex - lowIndex;
    (*output)[i] = input[lowIndex] * (1 - interpolate) + input[highIndex] * interpolate;
  }

  return outputLength;
}

void fillWindowFunction(float *window, long length) {
  for (long i = 0; i < length; i++) {
    float xValue = i * (2 * M_PI / (float)length);
    window[i] = 0.5 * (1 - cos(xValue));
  }
}

void arrayMultiply(float *a, long aStart, float *b, long bStart, float *c, long cStart, long length) {
  // Basic c = b * a, assume wont go out of bounds
}

void arrayAdd(float *a, long aStart, float *b, long bStart, long length) {
  // Basic b += a, assume wont go out of bounds
  // Also compare to saxpy performance with a=1 and comment out the rest only if that one is faster (but leave it commented)
}

long timeStretch(float *input, long inputLength, float **output, float multiplier) {
  long segmentLength = 100 * (44100 / 1000);
  long outputOffset = 70 * (44100 / 1000);
  long overlapLength = segmentLength - outputOffset;

  long outputLength = (long)(inputLength * multiplier);
  *output = calloc(outputLength, sizeof(float));
  long numSegments = (long)ceil((outputLength - overlapLength) / (float)outputOffset);
  if (segmentLength > outputLength || segmentLength > inputLength || numSegments < 2) {
    return outputLength;
  }

  long inputOffset = (long)ceil((inputLength - segmentLength) / (float)(numSegments - 1));
  float *outputMaxAmp = calloc(outputLength, sizeof(float));
  float window[segmentLength];
  fillWindowFunction(window, segmentLength);

  // First segment
  // Output[0:_] += Input[0:_] * MODIFIEDWindow[]. Can just memory copy the first half into intermediate and only multiply the second
  // OutputMaxAmp[0:_] += MODIFIEDWindow[]
  // Last input start = 0 (or maybe just point to the last overlap start)

  // Middle segments
  // For i = 1; i < numSeg - 1; i++
  // Input start and output start = offset*i
  // Check max shift bounds and find best shift with (skip every 2 or 4) loop and sdot
  // Output[_:_] += Input[_:_] * Windwow[]
  // OutputMaxAmp[_:_] += Window[]
  // Update last input start or overlap start

  // Last segment
  // Input start and output start by len - segLen
  // Output += Input * MODIFIED WINDOW. Can just copy the second half and only multuply the first
  // Output max amp += MODIFIED window

  // Normalize by max amp and clip to 1.0 loop, free max amp, return
}

struct result *repitchAndStretch(float *data, long length, float stretch, int semitones) {
  float multiplier = pow(1.05946, semitones);

  float *stretched;
  long stretchedLength = timeStretch(data, length, &stretched, stretch * multiplier);

  float *resampled;
  long resampledLength = resample(stretched, stretchedLength, &resampled, multiplier);
  free(stretched);

  struct result *output = malloc(sizeof(struct result));
  output->resultData = resampled;
  output->resultLength = resampledLength;
  return output;
}

void freeAllocatedMemory(struct result *result) {
  free(result->resultData);
  free(result);
}
