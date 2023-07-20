#include <math.h>
#include <stdlib.h>

struct result {
  float *resultData;
  int resultLength;
};

int resample(float *input, int inputLength, float **output, float speed) {
  return 0;
}

void fillWindowFunction(float *window, int length) {
  for (int i = 0; i < length; i++) {
    window[i] = 1.0;
  }
}

void arrayMultiply(float *a, int aBound, float *b, int bBound, float *c, int cBound, int length) {
  // Custom zero padded element wise multiply. c = a * b.
}

void arrayAdd(float *a, int aBound, float *b, int bBound, float *c, int cBound, int length) {
  // Custom zero padded element wise add. b = a + b.
}

int timeStretch(float *input, int inputLength, float **output, float multiplier) {
  int segmentLength = 44100 * 100 / 1000; // Make these passable from JS and also clean up with constants etc
  int outputOffset = 44100 * 70 / 1000;

  int outputLength = inputLength * multiplier;
  int inputPaddedLength = inputLength + 2 * outputOffset;
  int outputPaddedLength = outputLength + 2 * outputOffset;

  *output = calloc(outputLength, sizeof(float));
  float *outputMaxAmp = calloc(outputLength, sizeof(float));

  float numSegmentsDecimal = 1 + (outputPaddedLength - segmentLength) / (float)outputOffset;
  int numSegments = ceil(numSegmentsDecimal);
  int inputOffset = (inputPaddedLength - segmentLength) / (numSegmentsDecimal - 1);

  float window[segmentLength];
  fillWindowFunction(window, segmentLength);

  for (int i = 0; i < numSegments; i++) {
    // Get input start, output copy start
    // (Later) find wsola nudge
    // Copy to temp array and call custom zero-padding multiply with window
    // Call custom zero-padding copy (or actually add) function with segment length
    // Call custom zero-padding add function for max amp
  }

  // Loop for each segment, including wsola part
  // Output normalize
  // Return

  // Make separate functions for each np task eg multiplying two equal length arrays (or copying into equal length spot, aka your own custom memcpy alternative that accepts out of bounds -- same for other np analogues, then can also incorporate parallelism etc easily later too where applicable) could be with the two arrays, two start indices (can be out of bounds), and one length, and internally it checks bounds and acts as if zero padded

  return 0;
}

struct result *repitchAndStretch(float *data, int length, float stretch, int semitones) {
  float multiplier = pow(1.05946, semitones); // Maybe use constant here etc

  float *stretched;
  int stretchedLength = timeStretch(data, length, &stretched, stretch * multiplier);

  float *resampled;
  int resampledLength = resample(stretched, stretchedLength, &resampled, multiplier);
  free(stretched);

  struct result *output = malloc(sizeof(struct result));
  output->resultData = resampled;
  output->resultLength = resampledLength;
  return output; // Create cleanup function later that frees resultData and output struct
}
