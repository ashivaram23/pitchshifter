#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Stores the processed audio output to return to the user
struct result {
  float *resultData;
  long resultLength;
};

/*
 * Changes the speed of an audio clip by resampling with linear interpolation.
 *
 * input -- array of audio samples
 * inputLength -- number of samples in input
 * output -- pointer to store output array
 * speed -- multiplier for the audio's speed
 */
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

/*
 * Fills the given window array with the Hann window function.
 *
 * window -- array for the window function values
 * length -- length of window function in samples
 */
void fillWindowFunction(float *window, long length) {
  for (long i = 0; i < length; i++) {
    float xValue = i * (2 * M_PI / (float)length);
    window[i] = 0.5 * (1 - cos(xValue));
  }
}

/*
 * Copies array A to array B.
 *
 * a -- source array
 * b -- destination array
 * length -- number of items to copy
 */
void copyArray(float *a, float *b, long length) {
  memcpy(b, a, length * sizeof(float));
}

/*
 * Multiplies arrays A and B elementwise and stores the result in array C.
 * 
 * a -- one of the arrays to multiply
 * b -- the other array to multiply
 * c -- destination array
 * length -- lengths of arrays being multiplied
 */
void multiplyArrays(float *a, float *b, float *c, long length) {
  for (long i = 0; i < length; i++) {
    c[i] = a[i] * b[i];
  }
}

/*
 * Adds arrays A and B elementwise and stores the result in array C.
 *
 * a -- one of the arrays to add
 * b -- the other array to add
 * c -- destination array
 * length -- lengths of arrays being added
 */
void addArrays(float *a, float *b, float *c, long length) {
  for (long i = 0; i < length; i++) {
    c[i] = a[i] + b[i];
  }
}

/*
 * Adds a scalar value to every element of the given array.
 *
 * a -- array to add to
 * x -- float scalar to add
 * length -- length of array
 */
void addScalarToArray(float *a, float x, long length) {
  for (long i = 0; i < length; i++) {
    a[i] += x;
  }
}

/*
 * Calculates the dot/inner product of two arrays.
 *
 * a -- one of the arrays
 * b -- the other array
 * length -- lengths of arrays
 */
float dotProduct(float *a, float *b, long length) {
  float sum = 0;
  for (long i = 0; i < length; i += 8) {
    sum += a[i] * b[i];
  }

  return sum;
}

/*
 * Stretches the time an audio clip takes without changing its pitch.
 * Applies the waveform similarity based overlap-add algorithm (WSOLA).
 * 
 * input -- array of audio samples
 * inputLength -- number of samples in input
 * output -- pointer to store output array
 * multiplier -- multiplier for the audio's duration
 */
long timeStretch(float *input, long inputLength, float **output, float multiplier) {
  // Sets size of the segments to split the audio into and the offset between overlapping segments in the output
  long segmentLength = (100 * 44100) / 1000;
  long outputOffset = (70 * 44100) / 1000;
  long overlapLength = segmentLength - outputOffset;

  // Calculates the output length and the number of segments needed to fill it
  long outputLength = (long)(inputLength * multiplier);
  *output = calloc(outputLength, sizeof(float));
  long numSegments = (long)ceil((outputLength - overlapLength) / (float)outputOffset);
  if (segmentLength > outputLength || segmentLength > inputLength || numSegments < 2) {
    return outputLength;
  }

  // Calculates the offset between segments in the input array based on how much stretching is needed
  long inputOffset = (long)ceil((inputLength - segmentLength) / (float)(numSegments - 1));
  float *outputMaxAmp = calloc(outputLength, sizeof(float));

  // Sets up the window function used to smoothly fade between segments
  float window[segmentLength];
  fillWindowFunction(window, segmentLength);

  // Copies the first segment from the start of the input to the start of the output
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

  // Copies the middle segments from their input positions to their corresponding output positions
  for (long i = 1; i < numSegments - 1; i++) {
    long inputStart = inputOffset * i;
    long outputStart = outputOffset * i;

    // Finds the value within maxShift that aligns the next segment best with the previous one to avoid phase cancellation
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

  // Copies the last segment from the end of the input to the end of the output
  long inputStart = inputLength - segmentLength;
  long outputStart = outputLength - segmentLength;
  multiplyArrays(input + inputStart, window, nextSegment, halfSegment);
  copyArray(input + inputStart + halfSegment, nextSegment + halfSegment, segmentLength - halfSegment);
  addArrays(nextSegment, *output + outputStart, *output + outputStart, segmentLength);
  addArrays(window, outputMaxAmp + outputStart, outputMaxAmp + outputStart, halfSegment);
  addScalarToArray(outputMaxAmp + outputStart + halfSegment, 1.0, segmentLength - halfSegment);

  // Normalizes the output array
  for (long i = 0; i < outputLength; i++) {
    float quotient = outputMaxAmp[i] > 0 ? (*output)[i] / outputMaxAmp[i] : (*output)[i];
    quotient = quotient <= 1.0 ? quotient : 1.0;
    quotient = quotient >= -1.0 ? quotient : -1.0;
    (*output)[i] = quotient;
  }

  free(outputMaxAmp);
  return outputLength;
}

/*
 * Changes an audio clip's duration by a multiplier and pitch by a number of semitones.
 * This function should be exposed to the user to pass audio data from JS to WebAssembly. The user should call freeAllocatedMemory() afterwards.
 * 
 * data -- array of audio samples
 * length -- number of audio samples
 * stretch -- multiplier for the audio's duration
 * semitones -- number of semitones to shift pitch
 */
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

  free(data);
  return output;
}

/*
 * Allocates memory for the user to copy audio input data into from JS.
 *
 * length -- number of audio samples in input
 */
float *allocateInputMemory(long length) {
  return calloc(length, sizeof(float));
}

/*
 * Frees memory allocated to store the output from repitchAndStretch().
 *
 * result -- struct containing the processed audio output
 */
void freeAllocatedMemory(struct result *result) {
  free(result->resultData);
  free(result);
}
