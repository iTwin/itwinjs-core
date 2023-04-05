#!/bin/bash

usage() {
  echo "Creates a PR branch to update the master branch of the itwinjs-core repository to use a new version of the @bentley/imodeljs-native package."
  echo "Usage: $0 -v VERSION -s SHA"
  echo "  -v VERSION: The semantic version (e.g., 3.2.7) of the @bentley/imodeljs-native package to which to update."
  echo "  -s SHA: The SHA hash of the commit on the imodel02 branch to merge into the PR branch."
}

checkfail() {
  if [ $? -ne 0 ]; then
    >&2 echo "Error - aborting."
    exit 1
  fi
}

while getopts "v:s:" options; do
  case "${options}" in
    v) AddonVersion=${OPTARG} ;;
    s) CommitHash=${OPTARG} ;;
    ?) usage ; exit 1 ;;
  esac
done

if [[ "$AddonVersion" = "" || "$CommitHash" = "" ]]; then
  usage
  exit 1
fi

# Find repo root and verify it's an itwinjs-core repo.
RepoRoot=`git rev-parse --show-toplevel`
if [[ $? -ne 0 || ! -f "$RepoRoot/core/backend/package.json" ]]; then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1;
fi

BranchName="native/$AddonVersion"
echo "Creating PR branch '$BranchName'..."
git checkout master
checkfail

git pull
checkfail

git checkout -b "$BranchName"
checkfail

echo "Merging imodel02 branch..."
git merge --no-edit $CommitHash

if [ $? -ne 0 ]; then
  >&2 echo "Merge failed. If conflicts were reported, fix them."
  exit 2
fi

echo "PR branch created."
