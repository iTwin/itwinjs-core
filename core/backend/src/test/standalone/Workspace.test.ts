/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs-extra";
import { extname } from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { Settings } from "../../workspace/Settings";
import { Workspace, WorkspaceContainer, WorkspaceDb } from "../../workspace/Workspace";
import { IModelTestUtils } from "../IModelTestUtils";

describe("WorkspaceFile", () => {

  let editor: Workspace.Editor;
  let workspace: Workspace;

  before(() => {
    editor = Workspace.constructEditor();
    workspace = editor.workspace;
  });
  after(() => {
    editor.close();
  });

  async function makeEditableDb(props: WorkspaceDb.Props & WorkspaceContainer.Props, manifest: WorkspaceDb.Manifest): Promise<Workspace.Editor.EditableDb> {
    const container = editor.getContainer({ ...props, accessToken: "" });
    const wsFile = await container.createDb({ ...props, manifest });
    wsFile.open();
    return wsFile;
  }

  function compareFiles(file1: string, file2: string) {
    expect(fs.lstatSync(file1).size).equal(fs.lstatSync(file2).size);
    expect(fs.readFileSync(file1)).to.deep.equal(fs.readFileSync(file2));
  }

  it("WorkspaceContainer names", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((containerId) => {
        expect(() => WorkspaceContainer.validateContainerId(containerId), containerId).to.throw("containerId");
      });
    };

    expectBadName([
      "",
      "  ",
      "12", // too short
      "a\\b",
      `a"b`,
      "a:b",
      "a.b",
      "a?b",
      "a*b",
      "a|b",
      "123--4",
      "Abc",
      "return\r",
      "newline\n",
      "a".repeat(64), // too long
      "-leading-dash",
      "trailing-dash-"]);

    WorkspaceContainer.validateContainerId(Guid.createValue()); // guids should be valid
  });

  it("WorkspaceDbNames", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((dbName) => {
        expect(() => WorkspaceContainer.validateDbName(dbName)).to.throw("dbName");
      });
    };

    expectBadName([
      "",
      "  ",
      "1/2",
      "a\\b",
      `a"b`,
      "base:1.2.3",
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

    WorkspaceContainer.validateDbName(Guid.createValue()); // guids should be valid
  });

  it("create new WorkspaceDb", async () => {
    const manifest: WorkspaceDb.Manifest = { workspaceName: "resources for acme users", contactName: "contact me" };
    const wsFile = await makeEditableDb({ containerId: "acme-engineering-inc-2", dbName: "db1", baseUri: "", storageType: "azure" }, manifest);
    const inFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
    let blobVal = new Uint8Array(testRange.toFloat64Array().buffer);
    let strVal = "this is test1";
    const strRscName = "string-resource/1";
    const blobRscName = "blob.resource:1";
    const fileRscName = "settings files/my settings/a.json5";

    let testManifest = wsFile.manifest;
    expect(testManifest.workspaceName).equals(manifest.workspaceName);
    expect(testManifest.contactName).equals(manifest.contactName);

    wsFile.updateManifest({ ...testManifest, contactName: "new contact" });
    testManifest = wsFile.manifest;
    expect(testManifest.workspaceName).equals(manifest.workspaceName);
    expect(testManifest.contactName).equals("new contact");

    expect(() => wsFile.addFile(fileRscName, "bad file name")).to.throw("no such file");
    expect(() => wsFile.updateFile(fileRscName, inFile)).to.throw("error replacing");
    expect(() => wsFile.removeFile(fileRscName)).to.throw("does not exist");

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
    const writeFile = sinon.spy(wsFile.sqliteDb.nativeDb, "extractEmbeddedFile");
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

  it("load workspace settings", async () => {
    const settingsFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const defaultDb = await makeEditableDb({ containerId: "default", dbName: "db1", baseUri: "", storageType: "azure" }, { workspaceName: "default resources", contactName: "contact 123" });
    defaultDb.addString("default-settings", fs.readFileSync(settingsFile, "utf-8"));
    defaultDb.close();

    const settings = workspace.settings;
    await workspace.loadSettingsDictionary(
      { dbName: "db1", containerId: "default", baseUri: "", storageType: "azure", resourceName: "default-settings", priority: Settings.Priority.defaults });
    expect(settings.getSetting("editor/renderWhitespace")).equals("selection");

    const workspaceName = "all fonts workspace";
    const schemaFile = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    const fontsDb = await makeEditableDb({ containerId: "fonts", dbName: "fonts", baseUri: "", storageType: "azure" }, { workspaceName, contactName: "font guy" });

    fontsDb.addFile("Helvetica.ttf", schemaFile, "ttf");
    fontsDb.close();
  });

});
