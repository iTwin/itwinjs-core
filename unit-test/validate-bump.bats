#!/usr/bin/env ./libs/bats/bin/bats

@test "Nightly : dev" {
  run ./vb.sh "nightly" "3.3.0-dev.89" "master"
  [ "$status" -eq 0 ]
}

@test "Nightly : non-dev" {
  run ./vb.sh "nightly" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "RC : dev : master" {
  run ./vb.sh "releaseCandidate" "3.3.0-dev.89" "master"
  [ "$status" -eq 0 ]
}

@test "RC : dev : release" {
  run ./vb.sh "releaseCandidate" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "RC : non-dev : master" {
  run ./vb.sh "releaseCandidate" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "RC : non-dev : release" {
  run ./vb.sh "releaseCandidate" "3.3.0" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "Minor : dev : release" {
  run ./vb.sh "minor" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 0 ]
}

@test "Minor : dev : master" {
  run ./vb.sh "minor" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}

@test "Minor : non-dev : release" {
  run ./vb.sh "minor" "3.3.0" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "Minor : non-dev : master" {
  run ./vb.sh "minor" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}

@test "Patch : non-dev : release" {
  run ./vb.sh "patch" "3.3.0" "release/3.3.x"
  [ "$status" -eq 0 ]
}

@test "Patch : non-dev : master" {
  run ./vb.sh "patch" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "Patch : dev : release" {
  run ./vb.sh "patch" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "Patch : dev : master" {
  run ./vb.sh "patch" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}