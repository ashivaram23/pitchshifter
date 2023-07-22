#include <cblas.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
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

void copyArray(float *a, float *b, long length) {
  memcpy(b, a, length * sizeof(float));
}

void multiplyArrays(float *a, float *b, float *c, long length) {
  for (long i = 0; i < length; i++) {
    c[i] = a[i] * b[i];
  }
}

void addArrays(float *a, float *b, float *c, long length) {
  for (long i = 0; i < length; i++) {
    c[i] = a[i] + b[i];
  }
}

void addScalarToArray(float *a, float x, long length) {
  for (long i = 0; i < length; i++) {
    a[i] += x;
  }
}

float dotProduct(float *a, float *b, long length) {
  return cblas_sdot(length, a, 1, b, 1);
}

long timeStretch(float *input, long inputLength, float **output, float multiplier) {
  long segmentLength = (100 * 44100) / 1000;
  long outputOffset = (70 * 44100) / 1000;
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

  float nextSegment[segmentLength];
  long halfSegment = segmentLength / 2;
  copyArray(input, nextSegment, halfSegment);
  multiplyArrays(input + halfSegment, window + halfSegment, nextSegment + halfSegment, segmentLength - halfSegment);
  addArrays(nextSegment, *output, *output, segmentLength);
  addScalarToArray(outputMaxAmp, 1.0, halfSegment);
  addArrays(window + halfSegment, outputMaxAmp + halfSegment, outputMaxAmp + halfSegment, segmentLength - halfSegment);

  long lastInputStart = 0;
  long maxShift = (10 * 44100) / 1000;
  maxShift = maxShift < inputOffset ? maxShift : inputOffset;

  for (long i = 1; i < numSegments - 1; i++) {
    long inputStart = inputOffset * i;
    long outputStart = outputOffset * i;

    float bestSum = 0;
    long bestShift = 0;
    long shiftHigh = inputStart + segmentLength + maxShift < inputLength ? maxShift : inputLength - segmentLength - inputStart;
    for (long j = -maxShift; j < shiftHigh; j += 4) {
      float sum = dotProduct(input + inputStart + j, input + lastInputStart + outputOffset, overlapLength);
      if (j == -maxShift || sum > bestSum) {
        bestSum = sum;
        bestShift = j;
      }
    }

    inputStart += bestShift;
    lastInputStart = inputStart;

    multiplyArrays(input + inputStart, window, nextSegment, segmentLength);
    addArrays(nextSegment, *output + outputStart, *output + outputStart, segmentLength);
    addArrays(window, outputMaxAmp + outputStart, outputMaxAmp + outputStart, segmentLength);
  }

  long inputStart = inputLength - segmentLength;
  long outputStart = outputLength - segmentLength;
  multiplyArrays(input + inputStart, window, nextSegment, halfSegment);
  copyArray(input + inputStart + halfSegment, nextSegment + halfSegment, segmentLength - halfSegment);
  addArrays(nextSegment, *output + outputStart, *output + outputStart, segmentLength);
  addArrays(window, outputMaxAmp + outputStart, outputMaxAmp + outputStart, halfSegment);
  addScalarToArray(outputMaxAmp + outputStart + halfSegment, 1.0, segmentLength - halfSegment);

  for (long i = 0; i < outputLength; i++) {
    float quotient = outputMaxAmp[i] > 0 ? (*output)[i] / outputMaxAmp[i] : (*output)[i];
    quotient = quotient <= 1.0 ? quotient : 1.0;
    quotient = quotient >= -1.0 ? quotient : -1.0;
    (*output)[i] = quotient;
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

int main(int arc, char *argv[]) {
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
