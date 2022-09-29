#!/bin/bash

usage() {
  echo "Creates and pushes a PR branch to upgrade the itwinjs-core master branch to a new version of @bentley/imodeljs-native."
  echo "Usage: $0 -v VERSION -s SHA"
  echo "  -v VERSION: The semantic version (e.g., 3.2.7) of the @bentley/imodeljs-native package to which to update."
  echo "  -s SHA: The SHA hash of the commit on the imodel02 branch to merge into the PR branch."
}

# Find repo root and verify it's an itwinjs-core repo.
RepoRoot=`git rev-parse --show-toplevel`
if [[ $? -ne 0 || ! -f "$RepoRoot/core/backend/package.json" ]]; then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1;
fi

while getopts "v:s:" options; do
  case "${options}" in
    v) AddonVersion=${OPTARG} ;;
    s) CommitHash=${OPTARG} ;;
    ?) usage ; exit 1 ;;
  esac
done

# Infer version by bumping current patch release and/or infer commit hash by fetching remote tip? Meh, better to require user to be explicit.
if [[ "$AddonVersion" = "" || "$CommitHash" == "" ]]; then
  usage
  exit 1;
fi

# Create PR branch.
ScriptsDir="$RepoRoot/common/scripts"
"$ScriptsDir/create-imodeljs-native-pr-branch.sh" -v "$AddonVersion" -s "$CommitHash"
BranchStatus=$?
if [ $BranchStatus -ne 0 ]; then
  >&2 echo "PR branch creation failed - aborting."

  if [ $BranchStatus -eq 2 ]; then
    >&2 echo "If conflicts were reported, use `git mergetool` to fix them, then run `update-imodeljs-native-version.sh` to continue."
  fi

  exit 1
fi

# Update version.
"$ScriptsDir/update-imodeljs-native-version.sh" -v "$AddonVersion"
if [ $? -ne 0 ]; then
  >&2 echo "Failed to update version - aborting."
  >&2 echo "Delete the PR branch and rerun this script; or address the problems, run 'update-imodeljs-native-version.sh', and push the PR branch."
  exit 1;
fi

# Push PR branch
git push -u origin HEAD
if [ $? -ne 0 ]; then
  >&2 echo "Failed to push PR branch - aborting"
  exit 1
fi

echo "PR branch pushed."
