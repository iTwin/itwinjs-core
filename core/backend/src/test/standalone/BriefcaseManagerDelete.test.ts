/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "node:path";
import { Guid, IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { BriefcaseManager } from "../../BriefcaseManager";
import { StandaloneDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { KnownTestLocations } from "../KnownTestLocations";

describe("BriefcaseManager.deleteBriefcaseFiles", () => {
  let outsideDir: string;
  let insideDir: string;

  const writeFile = (fileName: string, content = "test content") => {
    IModelJsFs.writeFileSync(fileName, content);
    return fileName;
  };

  const createIModel = (fileName: string) => {
    StandaloneDb.createEmpty(fileName, { rootSubject: { name: "DeleteBriefcaseFiles" } }).close();
    return fileName;
  };

  const expectBadRequest = async (filePath: string) => {
    let error: unknown;
    try {
      await BriefcaseManager.deleteBriefcaseFiles(filePath);
    } catch (err) {
      error = err;
    }
    expect(error).instanceOf(IModelError);
    expect((error as IModelError).errorNumber).equal(IModelStatus.BadRequest);
  };

  beforeEach(() => {
    outsideDir = path.join(KnownTestLocations.outputDir, "DeleteBriefcaseFiles", Guid.createValue());
    insideDir = path.join(BriefcaseManager.cacheDir, Guid.createValue(), "briefcases");
    IModelJsFs.recursiveMkDirSync(outsideDir);
    IModelJsFs.recursiveMkDirSync(insideDir);

    const cacheRoot = path.resolve(BriefcaseManager.cacheDir) + path.sep;
    expect(path.resolve(outsideDir).startsWith(cacheRoot)).to.be.false;
    expect(path.resolve(insideDir).startsWith(cacheRoot)).to.be.true;
  });

  afterEach(() => {
    IModelJsFs.removeSync(outsideDir);
    IModelJsFs.removeSync(path.dirname(insideDir));
  });

  it("refuses to delete a file outside the cache that is not an iModel", async () => {
    const notes = writeFile(path.join(outsideDir, "notes.txt"));
    const notesWal = writeFile(`${notes}-wal`);

    await expectBadRequest(notes);

    expect(IModelJsFs.existsSync(notes)).to.be.true;
    expect(IModelJsFs.existsSync(notesWal)).to.be.true;
  });

  it("does not delete files that merely share a prefix with a missing file outside the cache", async () => {
    const abc = writeFile(path.join(outsideDir, "abc.txt"));
    const docx = writeFile(path.join(outsideDir, "a.docx"));
    const wal = writeFile(path.join(outsideDir, "a-wal"));

    await BriefcaseManager.deleteBriefcaseFiles(path.join(outsideDir, "a"));

    expect(IModelJsFs.existsSync(abc)).to.be.true;
    expect(IModelJsFs.existsSync(docx)).to.be.true;
    expect(IModelJsFs.existsSync(wal)).to.be.true;
  });

  it("does not delete files that share a prefix with a non-iModel file outside the cache", async () => {
    const a = writeFile(path.join(outsideDir, "a"));
    const abc = writeFile(path.join(outsideDir, "abc.txt"));
    const docx = writeFile(path.join(outsideDir, "a.docx"));

    await expectBadRequest(a);

    expect(IModelJsFs.existsSync(a)).to.be.true;
    expect(IModelJsFs.existsSync(abc)).to.be.true;
    expect(IModelJsFs.existsSync(docx)).to.be.true;
  });

  it("rejects paths that use '..' to escape the cache", async () => {
    const notes = writeFile(path.join(outsideDir, "notes.txt"));
    const escapingPath = `${insideDir}${path.sep}${path.relative(insideDir, notes)}`;
    expect(escapingPath.startsWith(insideDir)).to.be.true;

    await expectBadRequest(escapingPath);

    expect(IModelJsFs.existsSync(notes)).to.be.true;
  });

  it("deletes a valid briefcase in the cache along with its associated files, but not other files", async () => {
    const bim = createIModel(path.join(insideDir, "1.bim"));
    const sidecars = ["-wal", "-shm", "-journal", "-locks", "-locks-wal", "-locks-shm", ".Tiles", ".Tiles-journal"].map((suffix) => writeFile(`${bim}${suffix}`));
    const unrelated = [writeFile(`${bim}.keep.txt`), writeFile(path.join(insideDir, "1.bim2"))];

    await BriefcaseManager.deleteBriefcaseFiles(bim);

    expect(IModelJsFs.existsSync(bim)).to.be.false;
    for (const sidecar of sidecars)
      expect(IModelJsFs.existsSync(sidecar), sidecar).to.be.false;
    for (const file of unrelated)
      expect(IModelJsFs.existsSync(file), file).to.be.true;
  });

  it("deletes a corrupt briefcase file in the cache", async () => {
    const bim = writeFile(path.join(insideDir, "2.bim"), "this is not an iModel");
    const wal = writeFile(`${bim}-wal`);

    await BriefcaseManager.deleteBriefcaseFiles(bim);

    expect(IModelJsFs.existsSync(bim)).to.be.false;
    expect(IModelJsFs.existsSync(wal)).to.be.false;
  });

  it("deletes stale associated files in the cache when the briefcase file is missing", async () => {
    const bim = path.join(insideDir, "3.bim");
    const wal = writeFile(`${bim}-wal`);
    const locks = writeFile(`${bim}-locks`);

    await BriefcaseManager.deleteBriefcaseFiles(bim);

    expect(IModelJsFs.existsSync(wal)).to.be.false;
    expect(IModelJsFs.existsSync(locks)).to.be.false;
  });

  it("deletes a valid iModel outside the cache along with its associated files", async () => {
    const bim = createIModel(path.join(outsideDir, "valid.bim"));
    const shm = writeFile(`${bim}-shm`);

    await BriefcaseManager.deleteBriefcaseFiles(bim);

    expect(IModelJsFs.existsSync(bim)).to.be.false;
    expect(IModelJsFs.existsSync(shm)).to.be.false;
  });

  it("treats the cache directory case-insensitively on Windows", async function () {
    if (process.platform !== "win32")
      this.skip();

    const bim = writeFile(path.join(insideDir, "4.bim"), "this is not an iModel");

    await BriefcaseManager.deleteBriefcaseFiles(bim.toUpperCase());

    expect(IModelJsFs.existsSync(bim)).to.be.false;
  });
});
