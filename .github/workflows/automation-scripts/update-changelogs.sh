#!/bin/bash

targetPath="./temp-target-changelogs"
incomingPath="./temp-incoming-changelogs"

mkdir $targetPath
mkdir $incomingPath

# find the latest release, and make that the target for the changelogs
targetBranch=$(git branch -a --list "origin/release/[0-9]*.[0-9]*.x" | tail -n1 | sed 's/  remotes\///')
currentBranch=$(git branch --show-current)

if [ "origin/$currentBranch" = "$targetBranch" ]; then
  echo "The current branch is the latest release, so the target will be master branch"
  targetBranch=master
else
  echo "The current branch is the $currentBranch, so the target will be $targetBranch branch"
fi

if [ -z "$commitId" ]; then
  echo "ERROR: the variable commitId was not delcared"
  exit 1
fi

# copy all changelogs from the incoming branch to a temp folder, the files will be named: package_name_CHANGELOG.json
git checkout $commitId
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

if [ -z "$targetBranch" ]; then
  echo "ERROR: the variable targetBranch was not delcared"
  exit 1
fi

# copy all changelogs from the target branch to a temp folder, the files will be named: package_name_CHANGELOG.json
git checkout $targetBranch
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-target-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

# run js script that will add the new changes from incoming to the target changelogs and output new json files into temp-target-changelogs
node ./.github/workflows/automation-scripts/update-changelogs.js $targetPath $incomingPath

# copy changelogs back to proper file paths and convert names back to: CHANGELOG.json
find ./temp-target-changelogs/ -type f -name "*CHANGELOG.json" -exec sh -c 'cp "{}" "$(echo "{}" | sed "s|temp-target-changelogs/\(.*\)_|./\1/|; s|_|/|g")"' \;

# delete temps
rm -r $targetPath
rm -r $incomingPath

# regen CHANGELOG.md
rush publish --regenerate-changelogs #updates changelogs

commitMessage=$(git log --format=%B -n 1 $commitId)
git add .
git commit -m "$commitMessage Changelogs"

rush change --bulk --message "" --bump-type none
git add .
git commit --amend --no-edit