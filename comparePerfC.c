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

    if (lowIndex == highIndex) {
      (*output)[i] = input[lowIndex];
    } else {
      float interpolate = correspondingIndex - lowIndex;
      (*output)[i] = input[lowIndex] * (1 - interpolate) + input[highIndex] * interpolate;
    }
  }

  return outputLength;
}

void fillWindowFunction(float *window, long length) {
  for (long i = 0; i < length; i++) {
    float xValue = i * (2 * M_PI / (float)length);
    window[i] = (1 - cos(xValue)) / 2;
  }
}

void arrayMultiply(float *a, long aLength, long aStart, float *b, long bLength, long bStart, float *c, long cLength, long cStart, long length) {
  if (cStart >= cLength || cStart + length <= 0) {
    return;
  }

  if (cStart < 0) {
    length += cStart;
    aStart -= cStart;
    bStart -= cStart;
    cStart = 0;
  }

  length = cLength - cStart < length ? cLength - cStart : length;
  for (long i = 0; i < length; i++) {
    float aValue = aStart + i >= 0 && aStart + i < aLength ? a[aStart + i] : 0;
    float bValue = bStart + i >= 0 && bStart + i < bLength ? b[bStart + i] : 0;
    c[cStart + i] = aValue * bValue;
  }
}

void arrayAdd(float *a, long aLength, long aStart, float *b, long bLength, long bStart, long length) {
  if (bStart >= bLength || bStart + length <= 0) {
    return;
  }

  if (bStart < 0) {
    length += bStart;
    aStart -= bStart;
    bStart = 0;
  }

  length = bLength - bStart < length ? bLength - bStart : length;
  for (long i = 0; i < length; i++) {
    float aValue = aStart + i >= 0 && aStart + i < aLength ? a[aStart + i] : 0;
    b[bStart + i] += aValue;
  }
}

long timeStretch(float *input, long inputLength, float **output, float multiplier) {
  long segmentLength = 100 * 44100 / 1000;
  long outputOffset = 70 * 44100 / 1000;

  long outputLength = inputLength * multiplier;
  long inputPaddedLength = inputLength + 2 * outputOffset;
  long outputPaddedLength = outputLength + 2 * outputOffset;

  *output = calloc(outputLength, sizeof(float));
  float *outputMaxAmp = calloc(outputLength, sizeof(float));

  float numSegmentsDecimal = 1 + (outputPaddedLength - segmentLength) / (float)outputOffset;
  long numSegments = ceil(numSegmentsDecimal);
  long inputOffset = (inputPaddedLength - segmentLength) / (numSegmentsDecimal - 1);

  float window[segmentLength];
  fillWindowFunction(window, segmentLength);

  long lastInputStart = 0;
  for (long i = 0; i < numSegments; i++) {
    long inputStart = -outputOffset + inputOffset * i;
    long outputStart = -outputOffset + outputOffset * i;

    // if (i > 0) {
    //   float bestSum = 0;
    //   long bestShift = 0;
    //   long maxShift = 10 * 44100 / 1000;
    //   long overlapLength = segmentLength - outputOffset;

    //   for (long j = -maxShift; j < maxShift; j++) {
    //     if (inputStart + j + overlapLength >= inputLength || inputStart + j < 0) {
    //       continue;
    //     }
        
    //     float sum = cblas_sdot(overlapLength, &(input[lastInputStart + outputOffset]), 1, &(input[inputStart + j]), 1);
    //     if (j == -maxShift || sum > bestSum) {
    //       bestSum = sum;
    //       bestShift = j;
    //     }
    //   }

    //   inputStart += bestShift;
    // }

    lastInputStart = inputStart;

    float segment[segmentLength];
    arrayMultiply(input, inputLength, inputStart, window, segmentLength, 0, segment, segmentLength, 0, segmentLength);
    arrayAdd(segment, segmentLength, 0, *output, outputLength, outputStart, segmentLength);
    arrayAdd(window, segmentLength, 0, outputMaxAmp, outputLength, outputStart, segmentLength);
  }

  for (long i = 0; i < outputLength; i++) {
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

int main(int argc, char *argv[]) {
  float stretch = atof(argv[1]);
  int semitones = atoi(argv[2]);
  int repeats = atoi(argv[3]);

  FILE *inputFile = fopen("brasspluck_raw.txt", "r");
  char *line = NULL;
  size_t length = 0;

  float data[352800L];
  for (long i = 0; i < 352800L; i++) {
    getline(&line, &length, inputFile);
    data[i] = atof(line);
  }

  free(line);
  fclose(inputFile);

  struct result *result = repitchAndStretch(data, 352800L, stretch, semitones);
  FILE *outputFile = fopen("compareCheckC.txt", "w");
  for (long i = 0; i < result->resultLength; i++) {
    fprintf(outputFile, "%.5f\n", result->resultData[i]);
  }

  fclose(outputFile);
  freeAllocatedMemory(result);

  struct timespec startTime;
  clock_gettime(CLOCK_REALTIME, &startTime);

  for (int i = 0; i < repeats; i++) {
    struct result *res = repitchAndStretch(data, 352800L, stretch, semitones);
    freeAllocatedMemory(res);
  }

  struct timespec endTime;
  clock_gettime(CLOCK_REALTIME, &endTime);
  
  time_t elapsedNs = (endTime.tv_sec - startTime.tv_sec) * 1e9;
  float elapsedSec = (elapsedNs + endTime.tv_nsec - startTime.tv_nsec) / 1e9;
  printf("C\t%f\n", elapsedSec);
}
