/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs-extra";
import { extname, join } from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { WorkspaceFile } from "../../workspace/Workspace";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe.only("WorkspaceFile", () => {

  const rootDir = join(KnownTestLocations.outputDir, "TestWorkspaces");

  const setWsRoot = (val: string) => { ((IModelHost as any).workspace.rootDir) = val; };
  before(() => {
    if (IModelJsFs.existsSync(rootDir))
      IModelJsFs.purgeDirSync(rootDir);
    else
      IModelJsFs.mkdirSync(rootDir);
    setWsRoot(rootDir);
  });

  it("WorkspaceContainer names", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((name) => {
        expect(() => new WorkspaceFile(name), name).to.throw("containerId");
      });
    };

    expectBadName([
      "",
      "  ",
      "1/2",
      "a\\b",
      `a"b`,
      "a:b",
      "a.b",
      "a?b",
      "a*b",
      "a|b",
      "con",
      "prn",
      "return\r",
      "newline\n",
      "a".repeat(256), // too long
      " leading space",
      "trailing space "]);

    new WorkspaceFile(Guid.createValue()); // guids should be valid
  });

  it("create new WorkspaceFile", () => {
    const wsFile = new WorkspaceFile("Acme Engineering Inc", { rootDir });
    IModelJsFs.purgeDirSync(wsFile.containerFilesDir);
    if (IModelJsFs.existsSync(wsFile.localDbName))
      IModelJsFs.unlinkSync(wsFile.localDbName);
    wsFile.create();

    const inFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
    let blobVal = new Uint8Array(testRange.toFloat64Array().buffer);
    let strVal = "this is test1";
    const strRscName = "string-resource/1";
    const blobRscName = "blob.resource:1";
    const fileRscName = "settings files/my settings/a.json5";

    expect(() => wsFile.addFile(fileRscName, "bad file name")).to.throw("no such file");
    expect(() => wsFile.updateFile(fileRscName, inFile)).to.throw("error replacing");
    expect(() => wsFile.removeFile(fileRscName)).to.throw("error removing");

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


  "core.imodels.fontFiles": [

    { "container": { alias: "default-fonts" }, "type": "file", "name": "fonts/Roboto-Regular.ttf" },
    { "container": { alias: "default-fonts" }, "type": "file", "name": "fonts/HelveticaNeue-Light.ttf" },

  ],​
});
