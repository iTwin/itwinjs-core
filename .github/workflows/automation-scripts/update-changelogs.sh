#!/bin/bash

#########################################################################
# To run manually:
# git checkout master; git pull
# git checkout release/X.X.X; git pull
# uncomment git checkout -b cmd and fix branch name
# open PR into master
#########################################################################

targetPath="./temp-target-changelogs"
incomingPath="./temp-incoming-changelogs"

mkdir $targetPath
mkdir $incomingPath

# find the latest release branch, and make that the target for the changelogs
targetBranch=$(git branch -a --list "origin/release/[0-9]*.[0-9]*.x" | tail -n1 | sed 's/  remotes\///')
currentBranch=$(git branch --show-current)
commitMessage=$(git log --format=%B -n 1)

if [ "origin/$currentBranch" = "$targetBranch" ]; then
  echo "The current branch is the latest release, so the target will be master branch"
  targetBranch=master
else
  echo "The current branch is the $currentBranch, so the target will be $targetBranch branch"
fi

# copy all changelogs from the current branch to ./temp-incoming-changelogs, the files will be named: package_name_CHANGELOG.json
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

# copy all changelogs from the target branch to ./temp-target-changelogs, the files will be named: package_name_CHANGELOG.json
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

#########################################################################
# Uncomment For Manual runs and fix branch name to appropriate version
# git checkout -b finalize-release-4.0.X
#########################################################################

git add .
git commit -m "$commitMessage Changelogs"

rush change --bulk --message "" --bump-type none
git add .
git commit --amend --no-edit