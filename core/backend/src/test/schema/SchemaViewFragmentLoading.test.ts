/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid } from "@itwin/core-bentley";
import { IModelHost, SnapshotDb } from "../../core-backend";
import type { SchemaView } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import * as path from "path";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

/** SchemaB references BisCore and defines BElement deriving from a BisCore class. */
const schemaB = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragB" alias="fb" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="BElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="BProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`;

/** SchemaA references FragB and derives AElement from FragB:BElement.
 * So loading FragA must transitively pull FragB (and, through it, BisCore). */
const schemaA = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragA" alias="fa" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="FragB" version="01.00.00" alias="fb"/>
    <ECEntityClass typeName="AElement">
      <BaseClass>fb:BElement</BaseClass>
      <ECProperty propertyName="AProp" typeName="int"/>
    </ECEntityClass>
  </ECSchema>`;

/** A third schema imported after the first load, to exercise cache invalidation. */
const schemaC = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragC" alias="fc" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="CElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="CProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`;

/**
 * Tests the incremental ("husk") schema-view path: `getSchemaView({ schemas: [...] })` loads only
 * the requested schemas plus their reference closure via `PRAGMA schema_view_fragment`, accumulating
 * across calls. These run against a real iModel - the blob is exercised end to end (native writer ->
 * TS reader/merge), which is where the fragment mechanism actually has to work. The blob format
 * itself is an internal C++-writer-to-TS-reader contract and is intentionally not probed directly.
 */
describe("SchemaView fragment loading", () => {
  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
  });

  /** Create a fresh writable snapshot with FragA + FragB (and BisCore) imported. */
  async function createIModelWithFragSchemas(): Promise<SnapshotDb> {
    const filePath = path.join(KnownTestLocations.outputDir, `SchemaViewFragment-${Guid.createValue()}.bim`);
    const iModel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "SchemaViewFragmentLoading" } });
    // importSchemaStrings persists the schema changes to this connection, so the PRAGMA reads see
    // them without an explicit saveChanges (which the implicit-transaction policy now disallows).
    await iModel.importSchemaStrings([schemaB, schemaA]);
    return iModel;
  }

  it("loads a requested schema and its reference closure, leaving unrequested schemas absent", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Request only FragB. It references BisCore, so both must be present; FragA must not be.
      const view = await iModel.getSchemaView({ schemas: ["FragB"] });

      expect(view.getSchema("FragB"), "FragB was requested").to.not.be.undefined;
      expect(view.getSchema("BisCore"), "BisCore is in FragB's closure").to.not.be.undefined;
      expect(view.getSchema("FragA"), "FragA was not requested and nothing pulled it in").to.be.undefined;

      expect(view.findClass("FragB:BElement")).to.not.be.undefined;
      expect(view.findClass("FragA:AElement")).to.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("pulls transitive dependencies when loading a dependent schema", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // FragA -> FragB -> BisCore. Requesting FragA alone must make the whole chain resolvable.
      const view = await iModel.getSchemaView({ schemas: ["FragA"] });

      expect(view.getSchema("FragA")).to.not.be.undefined;
      expect(view.getSchema("FragB")).to.not.be.undefined;
      expect(view.getSchema("BisCore")).to.not.be.undefined;

      const aElement = view.findClass("FragA:AElement");
      expect(aElement).to.not.be.undefined;
      // Cross-schema base class resolves across the closure.
      expect(aElement!.baseClass?.fullName).to.equal("FragB:BElement");
      // And transitively up into BisCore.
      expect(aElement!.is("BisCore:PhysicalElement")).to.be.true;
    } finally {
      iModel.close();
    }
  });

  it("accumulates schemas across calls into one view", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragB"] });
      expect(view1.getSchema("FragA")).to.be.undefined;

      // A second call for FragA merges into the same accumulating view.
      const view2 = await iModel.getSchemaView({ schemas: ["FragA"] });
      expect(view2, "subset view is a single accumulating instance").to.equal(view1);

      // Both schemas are now resolvable on the one view.
      expect(view2.findClass("FragA:AElement")).to.not.be.undefined;
      expect(view2.findClass("FragB:BElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("is idempotent when re-requesting an already-loaded schema", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragA"] });
      const aElement1 = view1.findClass("FragA:AElement");
      expect(aElement1).to.not.be.undefined;

      // Re-requesting loads nothing new and returns the same instance with stable indices.
      const view2 = await iModel.getSchemaView({ schemas: ["FragA", "FragB"] });
      expect(view2).to.equal(view1);
      expect(view2.findClass("FragA:AElement")!.idx).to.equal(aElement1!.idx);
    } finally {
      iModel.close();
    }
  });

  it("ignores schema names the iModel does not contain", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view = await iModel.getSchemaView({ schemas: ["DoesNotExist"] });
      expect(view.getSchema("DoesNotExist")).to.be.undefined;
      // The request resolved to an empty closure; the view is a valid, empty husk.
      expect(view.schemaCount).to.equal(0);
    } finally {
      iModel.close();
    }
  });

  it("serializes overlapping concurrent loads without double-merging", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Fire overlapping requests whose closures share BisCore. The merge queue must coalesce so no
      // schema is merged twice (which would surface as duplicate classes).
      const [v1, v2] = await Promise.all([
        iModel.getSchemaView({ schemas: ["FragA"] }),
        iModel.getSchemaView({ schemas: ["FragB"] }),
      ]);
      expect(v2).to.equal(v1);

      // Exactly one BElement and one AElement - no duplicates from a double merge.
      let bElementCount = 0;
      let aElementCount = 0;
      for (const schema of v1.getSchemas()) {
        for (const cls of schema.getClasses()) {
          if (cls.fullName === "FragB:BElement") bElementCount++;
          if (cls.fullName === "FragA:AElement") aElementCount++;
        }
      }
      expect(bElementCount, "BElement merged exactly once").to.equal(1);
      expect(aElementCount, "AElement merged exactly once").to.equal(1);
    } finally {
      iModel.close();
    }
  });

  it("invalidates the subset husk after a schema import", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragB"] });
      expect(view1.getSchema("FragB")).to.not.be.undefined;
      expect(view1.isOutdated).to.be.false;

      // Importing a schema calls clearCaches, which drops the husk and its loaded-set.
      await iModel.importSchemaStrings([schemaC]);
      expect(view1.isOutdated, "the old husk is marked outdated").to.be.true;

      // A fresh request rebuilds against the new schema state - a different instance that can now
      // load the newly imported schema.
      const view2 = await iModel.getSchemaView({ schemas: ["FragC"] });
      expect(view2, "a new husk is built after invalidation").to.not.equal(view1);
      expect(view2.findClass("FragC:CElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("the full view (no args) still contains everything the subset path can load", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const full = await iModel.getSchemaView();
      expect(full.findClass("FragA:AElement"), "full view has the domain class").to.not.be.undefined;
      expect(full.findClass("FragB:BElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });
});
