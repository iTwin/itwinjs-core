/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "node:path";
import { ChangesetAdaptor } from "../ChangesetAdaptor";
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
      // adaptor.acceptClass("Bis.GeometricElement3d");
      adaptor.acceptOp("Inserted");
      while (adaptor.step()) {
        if (adaptor.inserted)
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(adaptor.inserted, undefined, 3));

        if (adaptor.deleted)
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(adaptor.deleted, undefined, 3));
      }
      adaptor.dispose();
    }
    db.dispose();
  });
});
