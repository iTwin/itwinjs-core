const fs = require('fs');
const path = require('path');

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

if (process.argv.length === 3) {
  const currentFiles = getFilePaths(process.argv[2]);
  currentFiles.forEach((file, index) => {
    currentFiles[index] = file.split('/').slice(1);
  })
  fixChangeLogs(currentFiles);
} else {
  console.error("Script must take in 1 arguments, a temp path for the current")
}
