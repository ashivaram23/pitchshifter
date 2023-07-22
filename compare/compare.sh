#!/bin/bash

gcc comparePerfC.c -O3 -o comparePerfC -I /opt/OpenBLAS/include/ -L /opt/OpenBLAS/lib /opt/OpenBLAS/lib/libopenblas.a
./comparePerfC 1.5 3 10
python3 comparePerfPy.py 1.5 3 10
python3 comparePlay.py
