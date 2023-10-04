#!/usr/bin/env zx

"use strict";

const fs = require('fs');
const path = require('path');

/****************************************************************
* To run manually:
* install zx package
* git checkout target branch (master or latest release); git pull
* git checkout release/X.X.x; git pull (this is the branch that was just patched)
* uncomment git checkout -b cmd and fix branch name
* run this file using `zx .github/workflows/automation-scripts/update-changelogs.mjs`
* open PR into target branch
*****************************************************************/

const targetPath = "./temp-target-changelogs"
const incomingPath = "./temp-incoming-changelogs"

// To run shell commands using zx use "await $`cmd`"
await $`mkdir ${targetPath}`
await $`mkdir ${incomingPath}`

// find the latest release branch, and make that the target for the changelogs
let targetBranch = await $`git branch -a --list "origin/release/[0-9]*.[0-9]*.x" | tail -n1 | sed 's/  remotes\\///'`;
let currentBranch = await $`git branch --show-current`;
let commitMessage = await $`git log --format=%B -n 1`;

// remove extra null and new line characters from git cmds
targetBranch = String(targetBranch).replace(/\n/g, '');
currentBranch = String(currentBranch).replace(/\n/g, '');
commitMessage = String(commitMessage).replace(/\n/g, '');

console.log(`target branch: ${targetBranch}`);
console.log(`current branch: ${currentBranch}`);
console.log(`commit msg: ${commitMessage}`);

if (targetBranch === `origin/${currentBranch}`) {
  console.log("The current branch is the latest release, so the target will be master branch")
  targetBranch = 'master'
} else {
  console.log(`The current branch is ${currentBranch}, so the target will be ${targetBranch} branch`)
}
// copy all changelogs from the current branch to ./temp-incoming-changelogs, the files will be named: package_name_CHANGELOG.json
await $`find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\\///; s/\\//_/g")"' \\;`;

targetBranch = targetBranch.replace("origin/", "");
await $`git checkout ${targetBranch}`;
// copy all changelogs from the target branch to ./temp-target-changelogs, the files will be named: package_name_CHANGELOG.json
await $`find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-target-changelogs/$(echo "{}" | sed "s/^.\\///; s/\\//_/g")"' \\;`;

const currentFiles = getFilePaths(targetPath);
currentFiles.forEach((file, index) => {
  currentFiles[index] = file.split('/').slice(1);
})
fixChangeLogs(currentFiles);

// copy changelogs back to proper file paths and convert names back to: CHANGELOG.json
await $`find ./temp-target-changelogs/ -type f -name "*CHANGELOG.json" -exec sh -c 'cp "{}" "$(echo "{}" | sed "s|temp-target-changelogs/\\(.*\\)_|./\\1/|; s|_|/|g")"' \\;`;
// delete temps
await $`rm -r ${targetPath}`;
await $`rm -r ${incomingPath}`;
// # regen CHANGELOG.md
await $`rush publish --regenerate-changelogs`;
/*********************************************************************/
// Uncomment For Manual runs and fix branch name to appropriate version
// the version should match your incoming branch
// await $`git checkout -b finalize-release-X.X.X`;
// targetBranch = "finalize-release-X.X.X"
/*********************************************************************/
await $`git add .`;
await $`git commit -m "${commitMessage} Changelogs"`;
await $`rush change --bulk --message "" --bump-type none`;
await $`git add .`;
await $`git commit --amend --no-edit`;
await $`git push origin HEAD:${targetBranch}`;

// Read all files in the directory
function getFilePaths(directoryPath) {
  let filePaths = [];
  const files = fs.readdirSync(directoryPath);
  files.forEach(file => {
    const filePath = path.join(directoryPath, file);
    filePaths.push(filePath);
  });
  return filePaths
}

function loadJsonFiles(filePath) {
  // Load each JSON file
  const data = fs.readFileSync(filePath);
  const jsonData = JSON.parse(data);
  return jsonData;
}

function sortByVersion(entries) {
  return entries.sort((a, b) => {
    const versionA = a.version.split('.').map(Number);
    const versionB = b.version.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (versionA[i] < versionB[i]) return 1;
      if (versionA[i] > versionB[i]) return -1;
    }

    return 0;
  });
}

function fixChangeLogs(files) {
  const numFiles = files.length;
  for (let i = 0; i < numFiles; i++) {
    const currentJson = loadJsonFiles(`temp-target-changelogs/${files[i]}`);
    const incomingJson = loadJsonFiles(`temp-incoming-changelogs/${files[i]}`);
    let completeEntries = new Map([...currentJson.entries, ...incomingJson.entries].map((obj) => [obj['version'], obj]));
    completeEntries = sortByVersion(Array.from(completeEntries.values()));
    currentJson.entries = completeEntries;

    let jsonString = JSON.stringify(currentJson, null, 2);
    jsonString = jsonString + '\n';
    fs.writeFileSync(`temp-target-changelogs/${files[i]}`, jsonString, (err) => {
      if (err)
        console.error("Error Writing JSON file");
    });
  }
}
