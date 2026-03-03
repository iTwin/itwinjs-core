/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModelTestUtils } from "../IModelTestUtils";
import { StandaloneDb } from "../../IModelDb";

describe("IModelDb Features", () => {
  const createIModel = (name: string): StandaloneDb =>
    StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("IModelDbFeatures", `${name}.bim`), {
      rootSubject: { name },
      guid: Guid.createValue(),
    });

  it("new iModel has no enabled features", () => {
    const imodel = createIModel("features-empty");
    try {
      const features = imodel.getFeatures();
      expect(features.used).to.be.an("array").that.is.empty;
    } finally {
      imodel.close();
    }
  });

  it("getFeatures returns a non-empty available feature registry", () => {
    const imodel = createIModel("features-registry");
    try {
      const features = imodel.getFeatures();
      expect(features.available).to.be.an("array").with.length.greaterThan(0);

      const strict = features.available.find((c) => c.name === "strict-schema-loading");
      expect(strict, "strict-schema-loading must be in the registry").to.exist;
      expect(strict!.status).to.be.a("string").that.matches(/^(Experimental|Stable|Deprecated)$/);
    } finally {
      imodel.close();
    }
  });

  it("enableFeature marks the feature as used", () => {
    const imodel = createIModel("features-enable");
    try {
      imodel.enableFeature("strict-schema-loading");
      expect(imodel.getFeatures().used).to.include("strict-schema-loading");
    } finally {
      imodel.close();
    }
  });

  it("enableFeature persists across close/reopen", () => {
    const filePath = IModelTestUtils.prepareOutputFile("IModelDbFeatures", "features-persist.bim");
    const imodel = StandaloneDb.createEmpty(filePath, { rootSubject: { name: "features-persist" }, guid: Guid.createValue() });
    imodel.enableFeature("strict-schema-loading");
    imodel.saveChanges("enable strict-schema-loading");
    imodel.close();

    const reopened = StandaloneDb.openFile(filePath);
    try {
      expect(reopened.getFeatures().used).to.include("strict-schema-loading");
    } finally {
      reopened.close();
    }
  });

  it("abandonChanges reverts an in-flight enableFeature", () => {
    const imodel = createIModel("features-abandon");
    try {
      imodel.enableFeature("strict-schema-loading");
      expect(imodel.getFeatures().used).to.include("strict-schema-loading");

      imodel.abandonChanges();
      expect(imodel.getFeatures().used).to.not.include("strict-schema-loading");
    } finally {
      imodel.close();
    }
  });

  it("enableFeature throws for an unknown feature name", () => {
    const imodel = createIModel("features-unknown");
    try {
      expect(() => imodel.enableFeature("no-such-feature-xyz")).to.throw();
    } finally {
      imodel.close();
    }
  });

  it("PRAGMA ecdb_features reflects the enabled state", async () => {
    const imodel = createIModel("features-pragma");
    try {
      imodel.enableFeature("strict-schema-loading");
      imodel.saveChanges();

      const rows = await imodel.createQueryReader("PRAGMA ecdb_features").toArray();
      expect(rows).to.have.length.greaterThan(0);

      const strictRow = rows.find((r) => r.name === "strict-schema-loading");
      expect(strictRow, "strict-schema-loading row must be present").to.exist;
      expect(strictRow.enabled).to.equal(true);

      for (const row of rows) {
        if (row.name !== "strict-schema-loading") {
          expect(row.enabled, `${String(row.name)} should not be enabled`).to.equal(false);
        }
      }
    } finally {
      imodel.close();
    }
  });

  it("disableFeature throws for a non-toggleable feature", () => {
    const imodel = createIModel("features-disable");
    try {
      imodel.enableFeature("strict-schema-loading");
      expect(() => imodel.disableFeature("strict-schema-loading")).to.throw();
    } finally {
      imodel.close();
    }
  });
});
