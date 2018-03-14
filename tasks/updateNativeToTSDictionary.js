var fs = require('fs');

let columnWidth = 20;
let nativeNameWidth = columnWidth;
let nativePathWidth = columnWidth;
let tsNameWidth = columnWidth;
let tsPathWidth = columnWidth;
let notesColumnWidth = columnWidth;

let dividerWidth = function() { return nativeNameWidth + nativePathWidth + tsNameWidth + tsPathWidth + notesColumnWidth + 11 };

const file = './source/frontend/render/C++VsTypeScript.md';

const getData = function(line) { return line.includes("|") ? { nativeName: line.split("|")[1].trim(), nativePath: line.split("|")[2].trim(), tsName: line.split("|")[3].trim(), tsPath: line.split("|")[4].trim(), notes: line.split("|")[5].trim() } : undefined };
const mkText  = function(lineData) { return `| ${lineData.nativeName.padEnd(nativeNameWidth) }| ${lineData.nativePath.padEnd(nativePathWidth)}| ${lineData.tsName.padEnd(tsNameWidth)}| ${lineData.tsPath.padEnd(tsPathWidth)}| ${lineData.notes.padEnd(notesColumnWidth)} |` };
const mkHeaderDivider  = function() { return `|${"".padEnd(nativeNameWidth + 1,"-") }|${"".padEnd(nativePathWidth + 1,"-")}|${"".padEnd(tsNameWidth + 1,"-")}|${"".padEnd(tsPathWidth + 1,"-")}|${"".padEnd(notesColumnWidth + 2,"-")}|` };
const mkDivider = function() { return "|".padEnd(dividerWidth(),"-") + "|" };

// convert text file into array of data
var array = fs.readFileSync(file)
              .toString()
              .split("\n")
              .filter((v) => !v.includes("Native Name") && !v.includes("Native Path") && !v.includes("TS Name") && !v.includes("TS Path") && !v.includes("Notes") && !v.includes("--"))
              .map((line) => { const data = getData(line); return !!data ? Object.assign({ text: () => mkText(data) }, data) : undefined })
              .filter(Boolean);

// add entry from command line if applicable
// expected format:
//      npm run updateNativeToTsDictionary nativeName nativePath tsName tsPath notes
const args = process.argv;
if( args.length >= 5 ) { 
    const data = { nativeName: args[2], nativePath: args[3], tsName: args[4], tsPath: !!args[5] ? args[5] : "", notes: !!args[6] ? args[6] : "" }; 
    array.push(Object.assign({ text: () => mkText(data) }, data)); 
}

// update column widths
nativeNameWidth = Math.max(Math.max.apply(null, array.map(v => v.nativeName.length + 2)), columnWidth);
nativePathWidth = Math.max(Math.max.apply(null, array.map(v => v.nativePath.length + 2)), columnWidth);
tsNameWidth = Math.max(Math.max.apply(null, array.map(v => v.tsName.length + 2)), columnWidth);
tsPathWidth = Math.max(Math.max.apply(null, array.map(v => v.tsPath.length + 2)), columnWidth);
notesColumnWidth = Math.max(Math.max.apply(null, array.map(v => v.notes.length + 2)), notesColumnWidth);

// define header text lines
var header = [ mkText({ nativeName: "Native Name", nativePath: "Native Path", tsName: "TS Name", tsPath: "TS Path", notes: "Notes" }), mkHeaderDivider() ];

// sort data
array.sort((a, b) => a.nativeName.localeCompare(b.nativeName));

// convert data array back into a text
const text = header.concat(array.map((v) => v.text())).join("\n");

// write text to file
fs.writeFileSync(file, text, 'utf8');
