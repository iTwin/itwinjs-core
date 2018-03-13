var fs = require('fs');

const file = './source/frontend/render/C++VsTypeScript.md';
const getData = function(line) { return line.includes("|") ? { key: line.split("|")[1].trim(), value: line.split("|")[2].trim() } : undefined };
const mkText  = function(lineData) { return `| ${lineData.key.padEnd(30) }| ${lineData.value.padEnd(100)}|` };
const mkDivider = "|".padEnd(32,"-") + "|" + "".padEnd(101,"-") + "|";

// convert text file into array of data
var array = fs.readFileSync(file)
              .toString()
              .split("\n")
              .filter((v) => !v.includes("| C++") && !v.includes("-"))
              .map((line) => { const data = getData(line); return !!data ? Object.assign({ text: mkText(data) }, data) : undefined })
              .filter(Boolean);

// define header text lines
var header = [ mkText({ key: "C++", value: "Typescript" }), mkDivider ];

// add entry from command line if applicable
// expected format:
//      npm run updateNativeToTsDictionary nativeName tsName
const args = process.argv;
if( args.length === 4 ) { const data = { key: args[2], value: args[3] }; array.push(Object.assign({ text: mkText(data) }, data)); }

// sort data
array.sort((a, b) => a.key.localeCompare(b.key));

// convert data array back into a text
const text = header.concat(array.map((v) => v.text)).join("\n");

// write text to file
fs.writeFileSync(file, text, 'utf8');
