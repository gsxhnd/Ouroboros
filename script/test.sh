#!/bin/bash

rm -rf "testing"
mkdir -p testing/{a,b}
mkdir -p testing/a/a{a,b}
mkdir -p testing/b/b{a,b}
touch testing/a/aa/aa1.jpg
touch testing/01
touch testing/a/{a1,a2}
touch testing/b/{b1,b2}
