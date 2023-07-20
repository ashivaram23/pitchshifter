#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

struct result {
  float *resultData;
  int resultLength;
};

int resample(float *input, int inputLength, float **output, float speed) {
  int outputLength = inputLength / speed;
  // printf("Out len resamp %d\n", outputLength);
  *output = calloc(outputLength, sizeof(float));

  for (int i = 0; i < outputLength; i++) {
    double correspondingIndex = i * (inputLength / (double)outputLength);
    // if (i >= 6000 && i < 6010){
    //   printf("R %d %f\n", i, correspondingIndex);
    // }
    
    int lowIndex = floor(correspondingIndex);
    int highIndex = lowIndex + 1;

    if (lowIndex == highIndex) {
      (*output)[i] = input[lowIndex];
    } else {
      double interpolate = correspondingIndex - lowIndex;
      (*output)[i] = (float)(input[lowIndex] * (1 - interpolate) + input[highIndex] * interpolate);
    }

    // if (i >= 6000 && i < 6010){
    //   printf("V %d %f\n", i, (*output)[i]);
    // }
  }

  return outputLength;
}

void fillWindowFunction(float *window, int length) {
  for (int i = 0; i < length; i++) {
    window[i] = 1.0;
  }
}

void arrayMultiply(float *a, int aLength, int aStart, float *b, int bLength, int bStart, float *c, int cLength, int cStart, int length) {
  if (cStart >= cLength) {
    return;
  }

  int destLength = cLength - cStart < length ? cLength - cStart : length;
  for (int i = 0; i < destLength; i++) {
    if (cStart + i < 0 || cStart + i >= cLength) {
      continue;
    }

    float aValue = aStart + i >= 0 && aStart + i < aLength ? a[aStart + i] : 0;
    float bValue = bStart + i >= 0 && bStart + i < bLength ? b[bStart + i] : 0;
    c[cStart + i] = aValue * bValue;
  }
}

void arrayAdd(float *a, int aLength, int aStart, float *b, int bLength, int bStart, float *c, int cLength, int cStart, int length) {
  if (cStart >= cLength) {
    return;
  }

  int destLength = cLength - cStart < length ? cLength - cStart : length;
  for (int i = 0; i < destLength; i++) {
    if (cStart + i < 0 || cStart + i >= cLength) {
      continue;
    }
    float aValue = aStart + i >= 0 && aStart + i < aLength ? a[aStart + i] : 0;
    float bValue = bStart + i >= 0 && bStart + i < bLength ? b[bStart + i] : 0;
    c[cStart + i] = aValue + bValue;
  }
}

int timeStretch(float *input, int inputLength, float **output, float multiplier) {
  int segmentLength = (int)(44100 * 100 / (float)1000);
  int outputOffset = (int)(44100 * 70 / (float)1000);

  int outputLength = inputLength * multiplier;
  // printf("out length %d\n", outputLength);
  int inputPaddedLength = inputLength + 2 * outputOffset;
  int outputPaddedLength = outputLength + 2 * outputOffset;

  *output = calloc(outputLength, sizeof(float));
  float *outputMaxAmp = calloc(outputLength, sizeof(float));

  float numSegmentsDecimal = 1 + (outputPaddedLength - segmentLength) / (float)outputOffset;
  int numSegments = ceil(numSegmentsDecimal);
  int inputOffset = (inputPaddedLength - segmentLength) / (numSegmentsDecimal - 1);
  // printf("Num seg %d\n", numSegments);

  float window[segmentLength];
  fillWindowFunction(window, segmentLength);

  int lastInputStart = 0;
  int printCount = 0;
  for (int i = 0; i < numSegments; i++) {
    int inputStart = -outputOffset + inputOffset * i;
    int outputStart = -outputOffset + outputOffset * i;

    // if (i == 70) {
    //   printf("i 70 %d %d %f\n", inputStart, outputStart, input[inputStart]);
    // }

    // if (printCount < 10) {
    //   printf("input start %d %d\n", i, inputStart);
    //   printCount++;
    // }

    // if (i > 0) {
    //   float bestSum = 0;
    //   int bestShift = 0;
    //   int maxShift = 44100 * 10 / 1000;
    //   int overlapLength = segmentLength - outputOffset;
    //   float overlap[overlapLength];

    //   for (int j = -maxShift; j < maxShift; j++) {
    //     arrayMultiply(input, inputLength, inputStart + j, input, inputLength, lastInputStart, overlap, overlapLength, 0, overlapLength);
        
    //     float sum = 0;
    //     for (int k = 0; k < overlapLength; k++) {
    //       sum += overlap[k];
    //     }

    //     if (j == -maxShift || sum > bestSum) {
    //       bestSum = sum;
    //       bestShift = j;
    //     }
    //   }

    //   inputStart += bestShift;
    //   outputStart += bestShift;
    // }

    lastInputStart = inputStart;

    // if (i == 0) {
    //   float test1[4] = {0.5, 1.0, 1.5, 2.0};
    //   float test2[4] = {3.0, 4.0, 5.0, 6.0};
    //   float test3[4];
    //   arrayAdd(test1, 4, 0, test2, 4, 0, test2, 4, 0, 4);
    //   printf("Add test %f %f %f %f\n", test2[0], test2[1], test2[2], test2[3]);
    // }

    float segment[segmentLength];
    arrayMultiply(input, inputLength, inputStart, window, segmentLength, 0, segment, segmentLength, 0, segmentLength);
    arrayAdd(segment, segmentLength, 0, *output, outputLength, outputStart, *output, outputLength, outputStart, segmentLength);
    arrayAdd(window, segmentLength, 0, outputMaxAmp, outputLength, outputStart, outputMaxAmp, outputLength, outputStart, segmentLength);

    // if (i == 70) {
    //   printf("i 70 out %f\n", outputMaxAmp[outputStart]);
    // }
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

int main(int argc, char *argv[]) {
  char *filename = argv[1];
  float stretch = atof(argv[2]);
  int semitones = atoi(argv[3]);

  FILE *inputFile = fopen(filename, "r");;
  char *line = NULL;
  size_t length = 0;

  float data[352800];
  for (int i = 0; i < 352800; i++) {
    getline(&line, &length, inputFile);
    data[i] = atof(line);
  }

  free(line);
  fclose(inputFile);

  struct timespec startTime;
  clock_gettime(CLOCK_REALTIME, &startTime);

  for (int i = 0; i < 100; i++) {
    struct result *result = repitchAndStretch(data, 352800, stretch, semitones);
    // FILE *outputFile = fopen("brasspluck_ccheck.txt", "w");
    // for (int i = 0; i < result->resultLength; i++) {
    //   fprintf(outputFile, "%.5f\n", result->resultData[i]);
    // }

    // fclose(outputFile);
    freeAllocatedMemory(result);
  }

  struct timespec endTime;
  clock_gettime(CLOCK_REALTIME, &endTime);
  
  time_t elapsedNs = (endTime.tv_sec - startTime.tv_sec) * 1e9;
  float elapsedSec = (elapsedNs + endTime.tv_nsec - startTime.tv_nsec) / 1e9;
  printf("%f\n", elapsedSec);
}
