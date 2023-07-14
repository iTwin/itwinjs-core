const fs = require('fs');
const path = require('path');

// Read all files in the directory
function getFilePaths(directoryPath) {
  let filePaths = [];
  let files = fs.readdirSync(directoryPath);
  files.forEach(file => {
    let filePath = path.join(directoryPath, file);
    filePaths.push(filePath);
  });
  return filePaths
}

function loadJsonFiles(filePath) {
  // Load each JSON file
  data = fs.readFileSync(filePath);
  const jsonData = JSON.parse(data);
  return jsonData;
}

// returns true if currentVersion is greater than incoming
function compareVersions(currentVersion, incomingVersion) {
  currentVersion = currentVersion.split('.').map(Number);
  incomingVersion = incomingVersion.split('.').map(Number);
  const currentDif = currentVersion.map((num, index) => {
    return num - incomingVersion[index];
  })
  const leadNum = currentDif.filter((num) => { return num !== 0 })[0];
  return leadNum > 0;
}

function findNewEntries(currentEntries, incomingEntries) {
  currVersions = [];
  incomingVersions = [];

  currentEntries.forEach((entry) => {
    currVersions.push(entry.version);
  });

  incomingEntries.forEach((entry) => {
    incomingVersions.push(entry.version);
  });

  newEntries = [];
  incomingVersions.forEach((version, i) => {
    if (!currVersions.includes(version))
      newEntries.push(incomingEntries[i]);
  })

  return newEntries;
}

function addEntriesToCurr(currentEntries, newEntries) {
  let i = 0;
  let j = 0;
  while (j !== newEntries.length) {
    if (!compareVersions(currentEntries[i].version, newEntries[j].version)) {
      currentEntries.splice(i, 0, newEntries[j])
      j++;
    }
    i++;
  }
  return currentEntries;
}

function fixChangeLogs(currentFiles, incomingFiles) {
  numFiles = currentFiles.length;
  for (i = 0; i < numFiles; i++) {
    let currentJson = loadJsonFiles(currentFiles[i]);
    const incomingJson = loadJsonFiles(incomingFiles[i]);
    const newEntries = findNewEntries(currentJson.entries, incomingJson.entries);
    const completeEntries = addEntriesToCurr(currentJson.entries, newEntries);
    currentJson.entries = completeEntries;

    let jsonString = JSON.stringify(currentJson, null, 2);
    jsonString = jsonString + '\n';
    // let filePath = path.join('./corrected-changelogs', currentFiles[i]);
    fs.writeFileSync(currentFiles[i], jsonString, (err) => {
      if (err)
        console.error("Error Writing JSON file");
    });
  }
}

if (process.argv.length === 4) {
  currentFiles = getFilePaths(process.argv[2]);
  incomingFiles = getFilePaths(process.argv[3]);
  fixChangeLogs(currentFiles, incomingFiles);
} else {
  console.error("Script must take in 2 arguments, a temp path for the current and incoming changelogs")
}
