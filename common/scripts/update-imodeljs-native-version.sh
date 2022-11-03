#!/bin/bash

usage() {
  echo "Updates the itwinjs-core repository to use a new version of the @bentley/imodeljs-native package."
  echo "Usage: $0 -v VERSION"
  echo "  -v VERSION: The semantic version (e.g., 3.2.7) of the @bentley/imodeljs-native package to which to update."
}

checkfail() {
  if [ $? -ne 0 ]; then
    >&2 echo "Error - aborting."
    exit 1
  fi
}

while getopts "v:" options; do
  case "${options}" in
    v) AddonVersion=${OPTARG} ;;
    ?) usage ; exit 1 ;;
  esac
done

if [ "$AddonVersion" = "" ]; then
  usage
  exit 1
fi

# Find repo root and verify it's an itwinjs-core repo.
RepoRoot=`git rev-parse --show-toplevel`
if [[ $? -ne 0 || ! -f "$RepoRoot/core/backend/package.json" ]]; then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1;
fi

updatePackageJson() {
  packageJson="$RepoRoot/$1/package.json"
  packageTmp="$RepoRoot/package.json.tmp"
  jq --arg version $AddonVersion '.dependencies."@bentley/imodeljs-native"=$version' "$packageJson" > "$packageTmp"
  checkfail
  mv "$packageTmp" "$packageJson"
  checkfail
}

echo "Updating @bentley/imodeljs-native to $AddonVersion..."

# Update package.json files
updatePackageJson "core/backend"
updatePackageJson "full-stack-tests/backend"

# Update XCode projects. This relies on the "version = " string occurring exactly once, specifying the imodeljs-native version.
PbxProj1="$RepoRoot/tools/internal/ios/core-test-runner/core-test-runner.xcodeproj/project.pbxproj"
PbxProj2="$RepoRoot/test-apps/display-test-app/ios/imodeljs-test-app/imodeljs-test-app.xcodeproj/project.pbxproj"

for PbxProj in $PbxProj1 $PbxProj2
do
  # Note: the '' seems to be required on MacOS to get around a strange "undefined label" error
  sed -i '' "s/version = .*;/version = $AddonVersion;/" "$PbxProj"
done

# Update Android projects.
BuildGradle1="$RepoRoot/test-apps/display-test-app/android/imodeljs-test-app/app/build.gradle"
for BuildGradle in $BuildGradle1
do
  # Note: the '' seems to be required on MacOS to get around a strange "undefined label" error
  sed -i '' "s/com.github.itwin:mobile-native-android:.*'/com.github.itwin:mobile-native-android:$AddonVersion'/" "$BuildGradle"
done

# Purge node_modules
rm "$RepoRoot/common/config/rush/browser-approved-packages.json"
rm "$RepoRoot/common/config/rush/pnpm-lock.yaml"
rm -rf "$RepoRoot/common/temp"

# Update to new @bentley/imodeljs-native package.
rush update
checkfail

git commit -am"@bentley/imodeljs-native $AddonVersion"
checkfail

# Generate empty change logs.
yes "" | rush change
checkfail

git add "$RepoRoot/common/changes"
git commit --amend --no-edit

echo "Update complete."
