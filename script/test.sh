#!/bin/bash

rm -rf "data"
mkdir -p data/{a,b}
mkdir -p data/a/a{a,b}
mkdir -p data/b/b{a,b}
touch data/a/aa/aa1.jpg
touch data/01
touch data/a/{a1,a2}
touch data/b/{b1,b2}
