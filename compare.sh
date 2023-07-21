#!/bin/bash

gcc comparePerfC.c -O3 -o comparePerfC
./comparePerfC 1.5 -5 10
python3 comparePerfPy.py 1.5 -5 10
python3 comparePlay.py
