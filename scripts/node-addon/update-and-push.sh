#!/bin/bash

usage() {
  >&2 echo "Usage: $0 -v NewNativePackageVersion" 1>&2
}

checkfail() {
  if [ $? -ne 0 ]
  then
    >&2 echo "Error - aborting."
    exit 1
  fi
}

AddonVersion=""
while getopts "v:" options; do
  case "${options}" in
    v) AddonVersion=${OPTARG} ;;
    ?) usage ; exit 1 ;;
  esac
done

if [ "$AddonVersion" = "" ]
then
  usage
  exit 1
fi

# Find repo root and verify it's an itwinjs-core repo.
RepoRoot=`git rev-parse --show-toplevel`
if [[ $? -ne 0 || ! -f "$RepoRoot/core/backend/package.json" ]]; then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1;
fi

if [ $? -ne 0 ]
then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1
fi

# Purge node_modules
rm $RepoRoot/common/config/rush/browser-approved-packages.json
rm $RepoRoot/common/config/rush/pnpm-lock.yaml
rm -rf $RepoRoot/common/temp

# Update dependents.
updatePackageJson() {
  packageJson="$RepoRoot/$1/package.json"
  packageTmp="$RepoRoot/package.json.tmp"
  jq --arg version $AddonVersion '.dependencies."@bentley/imodeljs-native"=$version' "$packageJson" > "$packageTmp"
  checkfail
  mv "$packageTmp" "$packageJson"
  checkfail
}

updatePackageJson "core/backend"
updatePackageJson "full-stack-tests/backend"

# Update to new @bentley/imodeljs-native package.
rush update
checkfail

git commit -am"@bentley/imodeljs-native $AddonVersion"
checkfail

# Generate empty change logs.
yes "" | rush change
checkfail

git add $RepoRoot/common/changes
git commit -m"rush change"

# Push PR branch
###TODO git push -u origin HEAD
checkfail

echo "PR branch pushed."
