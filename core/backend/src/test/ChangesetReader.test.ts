/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "node:path";
import { ChangesetAdaptor, CompleteChangedInstanceBuilder } from "../ChangesetAdaptor";
import { ECDb } from "../ECDb";
import { SqliteChangesetReader } from "../SqliteChangesetReader";

describe("Changeset Reader", () => {
  it.only("changeset adaptor", () => {
    const baseDir = "D:\\assets";
    const db = new ECDb();
    db.openDb(path.join(baseDir, "13.bim"));

    for (let i = 1; i < 13; ++i) {
      const reader = SqliteChangesetReader.openFile({ fileName: path.join(baseDir, `${i}.cs`), db, disableSchemaCheck: true });
      const adaptor = new ChangesetAdaptor(reader);
      // adaptor.acceptClass("Bis.GeometricElement3d"f);
      adaptor.debugFlags.replaceBlobWithEllipsis = true;
      adaptor.debugFlags.replaceGeomWithEllipsis = true;
      const cci = new CompleteChangedInstanceBuilder();
      while (adaptor.step()) {
        cci.appendFrom(adaptor);
      }
      for (const inst of cci.instances) {
        if (inst.$meta && inst.$meta?.tables.length > 1) {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(inst, undefined, 3));
        }
      }
      adaptor.dispose();
    }
    db.dispose();
  });
});
