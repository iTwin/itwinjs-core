/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "node:path";
import * as sinon from "sinon";
import { Guid, IModelStatus, OpenMode } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { BriefcaseManager } from "../../BriefcaseManager";
import { StandaloneDb } from "../../IModelDb";
import { IModelJsFs } from "../../IModelJsFs";
import { checkFrontendBriefcaseDelete } from "../../internal/NativeAppDeleteBriefcase";
import { IModelNative } from "../../internal/NativePlatform";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Deleting briefcase files", () => {
  let outsideDir: string;
  let insideDir: string;

  const writeFile = (fileName: string, content = "test content") => {
    IModelJsFs.writeFileSync(fileName, content);
    return fileName;
  };

  const createIModel = (fileName: string) => {
    const db = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "DeleteBriefcaseFiles" } });
    const pathName = db.pathName; // native appends ".bim" if fileName has no extension
    db.close();
    return pathName;
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
    sinon.restore();
    IModelJsFs.removeSync(outsideDir);
    IModelJsFs.removeSync(path.dirname(insideDir));
  });

  describe("BriefcaseManager.deleteBriefcaseFiles", () => {
    /** Create an iModel with an assigned (valid) briefcaseId, so deleteBriefcaseFiles tries to clean up rebase folders and release it. */
    const createAssignedBriefcase = (fileName: string) => {
      const pathName = createIModel(fileName);
      const nativeDb = new IModelNative.platform.DgnDb();
      nativeDb.openIModel(pathName, OpenMode.ReadWrite);
      nativeDb.resetBriefcaseId(2);
      nativeDb.saveChanges();
      nativeDb.closeFile();
      return pathName;
    };

    it("releases the briefcaseId and deletes the file even if cleaning up rebase folders fails", async () => {
      const bim = createAssignedBriefcase(path.join(insideDir, "5.bim"));
      sinon.stub(BriefcaseManager as any, "cleanupRebaseFolders").throws(new Error("EBUSY"));
      const release = sinon.stub(BriefcaseManager, "releaseBriefcase").resolves();

      await BriefcaseManager.deleteBriefcaseFiles(bim, "access token");

      expect(release.calledOnce).to.be.true;
      expect(release.firstCall.args[1].briefcaseId).equal(2);
      expect(IModelJsFs.existsSync(bim)).to.be.false;
    });

    it("cleans up rebase folders and deletes the file even if releasing the briefcaseId fails", async () => {
      const bim = createAssignedBriefcase(path.join(insideDir, "6.bim"));
      const rebaseDir = path.join(insideDir, ".rebasing", "2");
      IModelJsFs.recursiveMkDirSync(rebaseDir);
      sinon.stub(BriefcaseManager, "releaseBriefcase").rejects(new Error("hub unavailable"));

      await BriefcaseManager.deleteBriefcaseFiles(bim, "access token");

      expect(IModelJsFs.existsSync(rebaseDir)).to.be.false;
      expect(IModelJsFs.existsSync(bim)).to.be.false;
    });
    it("deletes a briefcase along with its associated files, but not other files", async () => {
      const bim = createIModel(path.join(insideDir, "1.bim"));
      const sidecars = ["-wal", "-shm", "-journal", "-locks", "-locks-wal", "-locks-shm", ".Tiles", ".Tiles-journal", "-hierarchies", ".HierarchyCache.db", ".keep.txt"]
        .map((suffix) => writeFile(`${bim}${suffix}`));
      const unrelated = [writeFile(path.join(insideDir, "1.bim2")), writeFile(path.join(insideDir, "1.bimx.txt")), writeFile(path.join(insideDir, "x1.bim-wal"))];
      const sidecarDir = path.join(insideDir, "1.bim.dir");
      IModelJsFs.recursiveMkDirSync(sidecarDir);

      await BriefcaseManager.deleteBriefcaseFiles(bim);

      expect(IModelJsFs.existsSync(bim)).to.be.false;
      for (const sidecar of sidecars)
        expect(IModelJsFs.existsSync(sidecar), sidecar).to.be.false;
      for (const file of unrelated)
        expect(IModelJsFs.existsSync(file), file).to.be.true;
      expect(IModelJsFs.existsSync(sidecarDir), "directories are not deleted").to.be.true;
    });

    it("deletes a corrupt file at any location, but not files that merely share a prefix", async () => {
      const a = writeFile(path.join(outsideDir, "a"), "this is not an iModel");
      const wal = writeFile(`${a}-wal`);
      const unrelated = [writeFile(path.join(outsideDir, "abc.txt")), writeFile(path.join(outsideDir, "ab-c.txt"))];

      await BriefcaseManager.deleteBriefcaseFiles(a);

      expect(IModelJsFs.existsSync(a)).to.be.false;
      expect(IModelJsFs.existsSync(wal)).to.be.false;
      for (const file of unrelated)
        expect(IModelJsFs.existsSync(file), file).to.be.true;
    });

    it("deletes stale associated files when the briefcase file is missing", async () => {
      const bim = path.join(insideDir, "3.bim");
      const wal = writeFile(`${bim}-wal`);
      const locks = writeFile(`${bim}-locks`);

      await BriefcaseManager.deleteBriefcaseFiles(bim);

      expect(IModelJsFs.existsSync(wal)).to.be.false;
      expect(IModelJsFs.existsSync(locks)).to.be.false;
    });
  });

  describe("checkFrontendBriefcaseDelete", () => {
    const expectBadRequest = (filePath: string) => {
      let error: unknown;
      try {
        checkFrontendBriefcaseDelete(filePath);
      } catch (err) {
        error = err;
      }
      expect(error).instanceOf(IModelError);
      expect((error as IModelError).errorNumber).equal(IModelStatus.BadRequest);
    };

    it("rejects a file outside the cache that is not an iModel", () => {
      const notes = writeFile(path.join(outsideDir, "notes.txt"));
      expectBadRequest(notes);
      expect(IModelJsFs.existsSync(notes)).to.be.true;
    });

    it("rejects paths that use '..' to escape the cache", () => {
      const notes = writeFile(path.join(outsideDir, "notes.txt"));
      const escapingPath = `${insideDir}${path.sep}${path.relative(insideDir, notes)}`;
      expect(escapingPath.startsWith(insideDir)).to.be.true;
      expectBadRequest(escapingPath);
    });

    it("returns undefined for a missing file outside the cache, so its associated files are not deleted", () => {
      writeFile(path.join(outsideDir, "a.docx"));
      expect(checkFrontendBriefcaseDelete(path.join(outsideDir, "a"))).to.be.undefined;
    });

    it("allows a valid iModel outside the cache", () => {
      const bim = createIModel(path.join(outsideDir, "valid.bim"));
      expect(checkFrontendBriefcaseDelete(bim)).equal(path.resolve(bim));
    });

    it("allows any file, or missing file, inside the cache", () => {
      const corrupt = writeFile(path.join(insideDir, "2.bim"), "this is not an iModel");
      expect(checkFrontendBriefcaseDelete(corrupt)).equal(path.resolve(corrupt));

      const missing = path.join(insideDir, "3.bim");
      expect(checkFrontendBriefcaseDelete(missing)).equal(path.resolve(missing));
    });

    it("treats the cache directory case-insensitively on Windows", function () {
      if (process.platform !== "win32")
        this.skip();

      const corrupt = writeFile(path.join(insideDir, "4.bim"), "this is not an iModel");
      expect(checkFrontendBriefcaseDelete(corrupt.toUpperCase())).equal(path.resolve(corrupt.toUpperCase()));
    });
  });
});
