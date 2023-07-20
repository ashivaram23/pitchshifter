#include <math.h>
#include <stdlib.h>

struct result {
  float *resultData;
  int resultLength;
};

int resample(float *input, int inputLength, float **output, float speed) {
  int outputLength = inputLength / speed;
  *output = calloc(outputLength, sizeof(float));

  for (int i = 0; i < outputLength; i++) {
    float correspondingIndex = i * inputLength / outputLength;
    int lowIndex = floor(correspondingIndex);
    int highIndex = ceil(correspondingIndex);

    if (lowIndex == highIndex) {
      (*output)[i] = input[lowIndex];
    } else {
      float interpolate = correspondingIndex - lowIndex;
      (*output)[i] = lowIndex * (1 - interpolate) + highIndex * interpolate;
    }
  }

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
  int segmentLength = 44100 * 100 / 1000;
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

  int lastInputStart = 0;
  for (int i = 0; i < numSegments; i++) {
    int inputStart = -outputOffset + inputOffset * i;
    int outputStart = -outputOffset + outputOffset * i;

    if (i > 0) {
      float bestSum = 0;
      int bestShift = 0;
      int maxShift = 44100 * 10 / 1000;
      int overlapLength = segmentLength - outputOffset;
      float overlap[overlapLength];

      for (int j = -maxShift; j < maxShift; j++) {
        arrayMultiply(input, inputLength, inputStart + j, input, inputLength, lastInputStart, overlap, overlapLength, 0, overlapLength);
        
        float sum = 0;
        for (int k = 0; k < overlapLength; k++) {
          sum += overlap[k];
        }

        if (j == -maxShift || sum > bestSum) {
          bestSum = sum;
          bestShift = j;
        }
      }

      inputStart += bestShift;
      outputStart += bestShift;
    }

    lastInputStart = inputStart;

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

  free(outputMaxAmp);
  return outputLength;
}

struct result *repitchAndStretch(float *data, int length, float stretch, int semitones) {
  float multiplier = pow(1.05946, semitones);

  float *stretched;
  int stretchedLength = timeStretch(data, length, &stretched, stretch * multiplier);

  float *resampled;
  int resampledLength = resample(stretched, stretchedLength, &resampled, multiplier);
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
