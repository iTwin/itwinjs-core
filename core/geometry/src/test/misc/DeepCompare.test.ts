/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
/* eslint-disable no-console, comma-dangle, quote-props */
// Requires for grabbing json object from external file
import * as fs from "fs";
import { DeepCompare } from "../../serialization/DeepCompare";
import { Checker } from "../Checker";

// Variables used for testing
const deepComparisonFolderPath = "./src/test/deepComparisonTestFiles/";

describe("DeepCompare", () => {
  const ck = new Checker();
  const compareObj = new DeepCompare();

  it("BasicTests", () => {
    const originalContent = fs.readFileSync(`${deepComparisonFolderPath}original.json`, "utf8");
    const originalObject = JSON.parse(originalContent);

    let contentToTest = fs.readFileSync(`${deepComparisonFolderPath}sameStructureAndValues.json`, "utf8");
    let toTestObject = JSON.parse(contentToTest);
    ck.testTrue(compareObj.compare(originalObject, toTestObject), "exactly equal - testing both");

    contentToTest = fs.readFileSync(`${deepComparisonFolderPath}sameStructureDifferentValues.json`, "utf8");
    toTestObject = JSON.parse(contentToTest);
    ck.testFalse(compareObj.compare(originalObject, toTestObject), "equal structures - testing both");

    contentToTest = fs.readFileSync(`${deepComparisonFolderPath}differentStructureExtraProperty.json`, "utf8");
    toTestObject = JSON.parse(contentToTest);
    ck.testFalse(compareObj.compare(originalObject, toTestObject), "extra property - testing both");

    contentToTest = fs.readFileSync(`${deepComparisonFolderPath}differentStructureMissingProperty.json`, "utf8");
    toTestObject = JSON.parse(contentToTest);
    ck.testFalse(compareObj.compare(originalObject, toTestObject), "missing property - testing both");

    contentToTest = fs.readFileSync(`${deepComparisonFolderPath}differentStructurePropertyNameChange.json`, "utf8");
    toTestObject = JSON.parse(contentToTest);
    ck.testFalse(compareObj.compare(originalObject, toTestObject), "property name change - testing both");

    contentToTest = fs.readFileSync(`${deepComparisonFolderPath}differentStructureArrayLengthChange.json`, "utf8");
    toTestObject = JSON.parse(contentToTest);
    ck.testFalse(compareObj.compare(originalObject, toTestObject), "array length change - testing both");

    ck.checkpoint("DeepCompare.BasicTests");
    expect(ck.getNumErrors()).equals(0);
  });

});
