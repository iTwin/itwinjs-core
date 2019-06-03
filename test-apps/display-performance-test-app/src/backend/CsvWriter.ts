/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";

export function createFilePath(filePath: string) {
  const files = filePath.split(/\/|\\/); // /\.[^/.]+$/ // /\/[^\/]+$/
  let curFile = "";
  for (const file of files) {
    if (file === "") break;
    curFile += file + "\\";
    if (!fs.existsSync(curFile)) fs.mkdirSync(curFile);
  }
}

export function createNewCsvFile(filePath: string, fileName: string, data: Map<string, number | string>): boolean {
  let fd;
  let file = filePath;
  const lastChar = filePath[filePath.length - 1];
  if (lastChar !== "/" && lastChar !== "\\")
    file += "\\";
  file += fileName;
  if (!fs.existsSync(filePath)) createFilePath(filePath);
  if (!fs.existsSync(file)) {
    try {
      fd = fs.openSync(file, "a");
      let colNames = "";
      data.forEach((_value, colName) => {
        colNames += colName + ",";
      });
      colNames += "\r\n";
      fs.writeFileSync(fd, colNames, "utf8");
    } catch (err) {
      /* Handle the error */
    } finally {
      if (fd !== undefined)
        fs.closeSync(fd);
    }
    return true;
  } else {
    return false;
  }
}

function addColumn(origFile: string, newName: string, columnsIndex: number): string {
  let newFile = "";
  const lines = origFile.split(/[\r\n]+/);
  lines.forEach((line, lineIndex) => {
    if (line.trim() !== "") {
      let pos: number | undefined = 0;
      let curIndex = 0;
      while (curIndex < columnsIndex) {
        pos = line.indexOf(",", pos + 1);
        curIndex++;
      }
      if (pos < 0) pos = line.length;
      newFile += line.slice(0, pos) + (pos !== 0 ? "," : "") + (lineIndex === 0 ? newName : (newName === "ReadPixels Selector" ? "" : 0))
        + (line[pos] !== "," ? "," : "") + line.slice(pos) + "\r\n";
    }
  });
  return newFile;
}

export function addColumnsToCsvFile(filePath: string, rowData: Map<string, number | string>) {
  let origFile = fs.readFileSync(filePath).toString();
  const columns = origFile.split(/[\r\n]+/)[0].split(",");
  const opNamesIter = rowData.keys();
  const opNames: string[] = [];
  for (const name of opNamesIter)
    opNames.push(name);
  let opNamesIndex = 0;
  let columnsIndex = 0;
  while (opNamesIndex < opNames.length || columnsIndex < columns.length) {
    if (opNames[opNamesIndex] === undefined || columns[columnsIndex] === undefined
      || opNames[opNamesIndex].trim() !== columns[columnsIndex].trim()) {
      let count = 1;
      while (opNames[opNamesIndex + count] !== columns[columnsIndex] && (opNamesIndex + count) < opNames.length) {
        count++;
      }
      if (opNames[opNamesIndex + count] === columns[columnsIndex]) {
        for (let i = 0; i < count; i++) {
          origFile = addColumn(origFile, opNames[opNamesIndex], columnsIndex);
          columns.splice(columnsIndex, 0, opNames[opNamesIndex]);
          opNamesIndex++;
          columnsIndex++;
        }
      } else {
        count = 1;
        while (opNames[opNamesIndex] !== columns[columnsIndex + count] && (columnsIndex + count) < columns.length)
          count++;
        if (opNames[opNamesIndex] === columns[columnsIndex + count])
          columnsIndex += count;
        else {
          origFile = addColumn(origFile, opNames[opNamesIndex], columnsIndex);
          columns.splice(columnsIndex, 0, opNames[opNamesIndex]);
          opNamesIndex++;
          columnsIndex++;
        }
      }
    } else {
      opNamesIndex++;
      columnsIndex++;
    }
  }
  fs.writeFileSync(filePath, origFile);
}

export function addDataToCsvFile(file: string, data: Map<string, number | string>) {
  let fd;
  try {
    const columns = fs.readFileSync(file).toString().split(/[\r\n]+/)[0].split(",");
    fd = fs.openSync(file, "a");
    let stringData = "";
    columns.forEach((colName, index) => {
      let value = data.get(colName);
      if (value === undefined) {
        if (index < 2 || colName === "ReadPixels Selector")
          value = "";
        else
          value = 0;
      }
      if (colName === "iModel" || colName === "View Flags" || colName === "Disabled Ext" || colName === "ReadPixels Selector" || colName === "Tile Props")
        stringData += "\"" + value + "\",";
      else if (colName !== "" || index !== columns.length - 1)
        stringData += value + ",";
    });
    stringData += "\r\n";
    fs.appendFileSync(fd, stringData, "utf8");
  } catch (err) {
    /* Handle the error */
  } finally {
    if (fd !== undefined)
      fs.closeSync(fd);
  }
}

export function addEndOfTestToCsvFile(file: string) {
  let fd;
  try {
    fd = fs.openSync(file, "a");
    fs.appendFileSync(fd, "End of Tests-----------\r\n", "utf8");
  } catch (err) {
    /* Handle the error */
  } finally {
    if (fd !== undefined)
      fs.closeSync(fd);
  }
}
