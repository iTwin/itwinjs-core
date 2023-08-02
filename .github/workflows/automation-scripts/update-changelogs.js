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

function sortByVersion(objects) {
  return objects.sort((a, b) => {
    const versionA = a.version.split('.').map(Number);
    const versionB = b.version.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (versionA[i] < versionB[i]) return 1;
      if (versionA[i] > versionB[i]) return -1;
    }

    return 0;
  });
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

function fixChangeLogs(files) {
  const numFiles = files.length;
  for (let i = 0; i < numFiles; i++) {
    let currentJson = loadJsonFiles(`temp-target-changelogs/${files[i]}`);
    const incomingJson = loadJsonFiles(`temp-incoming-changelogs/${files[i]}`);
    const newEntries = findNewEntries(currentJson.entries, incomingJson.entries);
    const completeEntries = sortByVersion([...currentJson.entries, ...newEntries]);
    currentJson.entries = completeEntries;

    let jsonString = JSON.stringify(currentJson, null, 2);
    jsonString = jsonString + '\n';
    fs.writeFileSync(`temp-target-changelogs/${files[i]}`, jsonString, (err) => {
      if (err)
        console.error("Error Writing JSON file");
    });
  }
}

if (process.argv.length === 3) {
  currentFiles = getFilePaths(process.argv[2]);
  currentFiles.forEach((file, index) => {
    currentFiles[index] = file.split('/').slice(1);
  })
  fixChangeLogs(currentFiles);
} else {
  console.error("Script must take in 2 arguments, a temp path for the current and incoming changelogs")
}
