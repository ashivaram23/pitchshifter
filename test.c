#include <math.h>
#include <stdlib.h>

struct result {
  float *resultData;
  int resultLength;
};

int resample(float *input, int inputLength, float **output, float speed) {
  int outputLength = inputLength / speed;
  *output = calloc(outputLength, sizeof(float));

  // Resample input here with linear interpolation

  return outputLength;
}

void fillWindowFunction(float *window, int length) {
  for (int i = 0; i < length; i++) {
    window[i] = 1.0;
  }
}

void arrayMultiply(float *a, int aLength, int aStart, float *b, int bLength, int bStart, float *c, int cLength, int cStart, int length) {
  if (aStart >= aLength || bStart >= bLength || cStart >= cLength || cStart < 0) {
    return;
  }

  int destLength = cLength - cStart < length ? cLength - cStart : length;
  for (int i = 0; i < destLength; i++) {
    if (aStart + i < 0 || aStart + i >= aLength || bStart + i < 0 || bStart + i >= bLength) {
      c[cStart + i] = 0;
    } else {
      c[cStart + i] = a[aStart + i] * b[bStart + i];
    }
  }
}

void arrayAdd(float *a, int aLength, int aStart, float *b, int bLength, int bStart, float *c, int cLength, int cStart, int length) {
  if (aStart >= aLength || bStart >= bLength || cStart >= cLength || cStart < 0) {
    return;
  }

  int destLength = cLength - cStart < length ? cLength - cStart : length;
  for (int i = 0; i < destLength; i++) {
    int aValue = aStart + i >= 0 && aStart + i < aLength ? a[aStart + i] : 0;
    int bValue = bStart + i >= 0 && bStart + i < bLength ? b[bStart + i] : 0;
    c[cStart + i] = aValue + bValue;
  }
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
    int inputStart = -outputOffset + inputOffset * i;
    int outputStart = -outputOffset + outputOffset * i;

    // Find WSOLA shift here

    float segment[segmentLength];
    arrayMultiply(input, inputLength, inputStart, window, segmentLength, 0, segment, segmentLength, 0, segmentLength);
    arrayAdd(segment, segmentLength, 0, *output, outputLength, outputStart, *output, outputLength, outputStart, segmentLength);
    arrayAdd(window, segmentLength, 0, outputMaxAmp, outputLength, outputStart, outputMaxAmp, outputLength, outputStart, segmentLength);
  }

  for (int i = 0; i < outputLength; i++) {
    if (outputMaxAmp > 0) {
      (*output)[i] = (*output)[i] / outputMaxAmp[i];
    }

    if ((*output)[i] > 1.0) {
      (*output)[i] = 1.0;
    }
  }

  return outputLength;
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
