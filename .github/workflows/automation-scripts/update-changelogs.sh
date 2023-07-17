#!/bin/bash

# Using git termanology, current represents the branch targeted for changes, incoming is the branch with new changelogs
currentPath="./temp-current-changelogs"
incomingPath="./temp-incoming-changelogs"

mkdir $currentPath
mkdir $incomingPath

if [ -z "$commitId" ]; then
  echo "ERROR: the variable commitId was not delcared"
  exit 1
fi

# copy all changelogs from the incoming branch to a temp folder, the files will be named: package_name_CHANGELOG.json
git checkout $commitId
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

if [ -z "$currentBranch" ]; then
  echo "ERROR: the variable currentBranch was not delcared"
  exit 1
fi

# copy all changelogs from the target branch to a temp folder, the files will be named: package_name_CHANGELOG.json
git checkout $currentBranch
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-current-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

# run js script that will add the new changes from incoming to the target changelogs and output new json files into temp-current-changelogs
node ./.github/workflows/automation-scripts/update-changelogs.js $currentPath $incomingPath

# copy changelogs back to proper file paths and convert names back to: CHANGELOG.json
find ./temp-current-changelogs/ -type f -name "*CHANGELOG.json" -exec sh -c 'cp "{}" "$(echo "{}" | sed "s|temp-current-changelogs/\(.*\)_|./\1/|; s|_|/|g")"' \;

# delete temps
rm -r $currentPath
rm -r $incomingPath

# regen CHANGELOG.md
rush publish --regenerate-changelogs #updates changelogs

commitMessage=$(git log --format=%B -n 1 $commitid)
git add .
git commit -m "$commitMessage Changelogs"

rush change --bulk --message "" --bump-type none
git add .
git commit --amend --no-edit