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
import { IModelJsFs } from "../../IModelJsFs";
import { EditableWorkspaceFile, ITwinWorkspace, WorkspaceContainerId, WorkspaceFile } from "../../workspace/Workspace";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { BaseSettings, SettingDictionary, SettingsPriority } from "../../workspace/Settings";

describe("WorkspaceFile", () => {

  const workspace = new ITwinWorkspace(new BaseSettings(), { containerDir: join(KnownTestLocations.outputDir, "TestWorkspaces") });

  function makeContainer(id: WorkspaceContainerId) {
    const wsFile = new EditableWorkspaceFile(id, workspace);
    IModelJsFs.purgeDirSync(wsFile.containerFilesDir);
    if (IModelJsFs.existsSync(wsFile.localDbName))
      IModelJsFs.unlinkSync(wsFile.localDbName);
    wsFile.create();
    return wsFile;
  }

  function compareFiles(file1: string, file2: string) {
    expect(fs.lstatSync(file1).size).equal(fs.lstatSync(file2).size);
    expect(fs.readFileSync(file1)).to.deep.equal(fs.readFileSync(file2));
  }

  it("WorkspaceContainer names", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((name) => {
        expect(() => new WorkspaceFile(name, workspace), name).to.throw("containerId");
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

    new WorkspaceFile(Guid.createValue(), workspace); // guids should be valid
  });

  it("create new WorkspaceFile", () => {
    const wsFile = makeContainer("Acme Engineering Inc");
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
    compareFiles(inFile, outFile);

    let outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(1);
    expect(outFile).eq(outFile2);

    const inFile2 = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    wsFile.updateFile(fileRscName, inFile2);
    outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(2);
    expect(outFile).eq(outFile2);
    compareFiles(inFile2, outFile);
  });

  it("resolve workspace alias", async () => {
    const settingsFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const defaultContainer = makeContainer("defaults");
    defaultContainer.addString("default-settings", fs.readFileSync(settingsFile, "utf-8"));
    defaultContainer.close();

    const schemaFile = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    const fontsContainer = makeContainer("fonts-01");
    fontsContainer.addFile("Helvetica.ttf", schemaFile, "ttf");
    fontsContainer.close();

    const settings = workspace.settings;
    await workspace.loadSettingsDictionary({ rscName: "default-settings", container: "defaults" }, SettingsPriority.defaults);
    expect(settings.getSetting("editor/renderWhitespace")).equals("selection");

    interface FontEntry { fontName: string, container: string }
    const fontList = settings.getArray<FontEntry>("workspace/fontList")!;
    const fontContainerName = fontList[0].container;
    const fonts = await workspace.getContainer(fontContainerName);
    expect(fonts).to.not.be.undefined;
    const fontFile = fonts.getFile(fontList[0].fontName)!;
    expect(fontFile).contains(".ttf");
    compareFiles(fontFile, schemaFile);
    workspace.dropContainer(fonts);

    const setting2: SettingDictionary = {
      "workspace/container/alias": [
        { name: "default-icons", id: "icons-01" },
        { name: "default-lang", id: "lang-05" },
        { name: "default-fonts", id: "fonts-02" }, // a container id that doesn't exist
        { name: "default-key", id: "key-05" },
      ],
    };
    settings.addDictionary("imodel-02", SettingsPriority.iModel, setting2);
    expect(workspace.resolveContainerId(fontContainerName)).equals("fonts-02");
    expect(workspace.resolveContainerId({ id: "fonts-01" })).equals("fonts-01");
    await expect(workspace.getContainer(fontContainerName)).to.be.rejectedWith("not found");

    settings.dropDictionary("imodel-02");
    expect(workspace.resolveContainerId(fontContainerName)).equals("fonts-01");
  });
});
