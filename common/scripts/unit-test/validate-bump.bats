#!/usr/bin/env ./libs/bats/bin/bats

# SAMPLE outline
# @test "Test name" {
#   run *command*
#   True or False based on exit status of the script
# }

@test "should pass validation when nightly version bump is applied to a dev version" {
  run ./validate-bump.sh "nightly" "3.3.0-dev.89" "master"
  [ "$status" -eq 0 ]
}

@test "should fail validation when nightly version bump is applied to a non-dev version" {
  run ./validate-bump.sh "nightly" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "should pass validation when RC version bump is applied to a dev version on the master branch" {
  run ./validate-bump.sh "releaseCandidate" "3.3.0-dev.89" "master"
  [ "$status" -eq 0 ]
}

@test "should fail validation when RC version bump is applied to a dev version on the release branch" {
  run ./validate-bump.sh "releaseCandidate" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "should fail validation when RC version bump is applied to a non-dev version on the master branch" {
  run ./validate-bump.sh "releaseCandidate" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "should fail validation when RC version bump is applied to a non-dev version on the release branch" {
  run ./validate-bump.sh "releaseCandidate" "3.3.0" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "should pass validation when Minor version bump is applied to a dev version on the release branch" {
  run ./validate-bump.sh "minor" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 0 ]
}

@test "should fail validation when Minor version bump is applied to a dev version on the master branch" {
  run ./validate-bump.sh "minor" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}

@test "should fail validation when Minor version bump is applied to a non-dev version on the release branch" {
  run ./validate-bump.sh "minor" "3.3.0" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "should fail validation when Minor version bump is applied to a non-dev version on the master branch" {
  run ./validate-bump.sh "minor" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}

@test "should pass validation when Patch version bump is applied to a non-dev version on the release branch" {
  run ./validate-bump.sh "patch" "3.3.0" "release/3.3.x"
  [ "$status" -eq 0 ]
}

@test "should fail validation when Patch version bump is applied to a non-dev version on the master branch" {
  run ./validate-bump.sh "patch" "3.3.0" "master"
  [ "$status" -eq 1 ]
}

@test "should fail validation when Patch version bump is applied to a dev version on the release branch" {
  run ./validate-bump.sh "patch" "3.3.0-dev.89" "release/3.3.x"
  [ "$status" -eq 1 ]
}

@test "should fail validation when Patch version bump is applied to a dev version on the master branch" {
  run ./validate-bump.sh "patch" "3.3.0-dev.89" "master"
  [ "$status" -eq 1 ]
}