#!/bin/bash
cd "$(dirname "$0")" || true
libs/bats/bin/bats $(find *.bats -maxdepth 0 | sort)
