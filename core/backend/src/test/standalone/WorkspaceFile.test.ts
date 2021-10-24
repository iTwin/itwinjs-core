/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import { IModelJsFs } from "../../IModelJsFs";
import { WorkspaceFile } from "../../workspace/WorkspaceFile";
import { IModelTestUtils } from "../IModelTestUtils";
import * as fs from "fs-extra";
import { extname } from "path";
import * as sinon from "sinon";

describe.only("WorkspaceFile", () => {
  it("invalid WorkspaceNames", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((name) => {
        expect(() => new WorkspaceFile(name)).to.throw("containerName");
        expect(() => new WorkspaceFile("a", name)).to.throw("containerId");
      });
    };

    expectBadName([
      "",
      "  ",
      "1/2",
      "a\\b",
      `a"b`,
      "a colon:",
      "return\r",
      "newline\n",
      "a.b",
      "a?b",
      "a*b",
      "a|b",
      "con",
      "prn",
      "a".repeat(256), // too long
      " leading space",
      "trailing space "]);
  });

  it("create new WorkspaceFile", () => {
    const wsFile = new WorkspaceFile("Acme Engineering Inc");
    const dir = wsFile.getContainerDir();
    IModelJsFs.purgeDirSync(dir);
    wsFile.create();

    const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
    let blobVal = new Uint8Array(testRange.toFloat64Array().buffer);
    let strVal = "this is test1";
    const strRscName = "string-resource/1";
    const blobRscName = "blob.resource:1";
    wsFile.addBlob(blobRscName, blobVal);
    wsFile.addString(strRscName, strVal);
    expect(wsFile.getString(strRscName)).equals(strVal);
    expect(wsFile.getBlob(blobRscName)).to.deep.equal(blobVal);
    strVal = "updated string";
    blobVal = Uint8Array.from([0, 1, 2, 3]);
    wsFile.updateString(strRscName, strVal);
    wsFile.updateBlob(blobRscName, blobVal);
    expect(wsFile.getString(strRscName)).equals(strVal);
    expect(wsFile.getBlob(blobRscName)).to.deep.equal(blobVal);

    wsFile.removeBlob(blobRscName);
    wsFile.removeString(strRscName);
    expect(wsFile.getString(strRscName)).to.be.undefined;
    expect(wsFile.getBlob(blobRscName)).to.be.undefined;

    const inFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const fileRscName = "settings files/my settings/a.json5?=$&*";
    wsFile.addFile(fileRscName, inFile);
    const writeFile = sinon.spy((wsFile as any).db.nativeDb, "extractEmbeddedFile");
    expect(writeFile.callCount).eq(0);
    const outFile = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(1);
    expect(extname(outFile)).equals(".json5");

    let statOrig = fs.lstatSync(inFile);
    let statExtracted = fs.lstatSync(outFile);
    expect(statOrig.size).equal(statExtracted.size);
    let f1 = fs.readFileSync(inFile);
    let f2 = fs.readFileSync(outFile);
    expect(f1).to.deep.equal(f2);

    let outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(1);
    expect(outFile).eq(outFile2);

    const inFile2 = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    wsFile.updateFile(fileRscName, inFile2);
    outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(2);
    expect(outFile).eq(outFile2);
    statOrig = fs.lstatSync(inFile2);
    statExtracted = fs.lstatSync(outFile);
    expect(statOrig.size).equal(statExtracted.size);
    f1 = fs.readFileSync(inFile2);
    f2 = fs.readFileSync(outFile);
    expect(f1).to.deep.equal(f2);

  });

});
