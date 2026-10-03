/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Guid, ProcessDetector } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { SchemaKey } from "@itwin/ecschema-metadata";

if (ProcessDetector.isElectronAppFrontend) {

  describe("SnapshotConnection", () => {
    beforeAll(async () => {
      await TestUtility.startFrontend();
    });

    afterAll(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("SnapshotConnection properties", async () => {
      /* eslint-disable @typescript-eslint/no-deprecated */
      const snapshotR1 = await SnapshotConnection.openRemote("test-key"); // file key resolved by BackendTestAssetResolver
      const snapshotR2 = await SnapshotConnection.openRemote("test2-key"); // file key resolved by BackendTestAssetResolver
      /* eslint-enable @typescript-eslint/no-deprecated */
      const snapshotF1 = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

      expect(snapshotR1.key).not.toBe(snapshotF1.key);
      expect(snapshotR1.isRemote).toBe(true);
      expect(snapshotR2.isRemote).toBe(true);
      expect(snapshotF1.isRemote).toBe(false);

      expect(snapshotR1.isOpen).toBe(true);
      expect(snapshotR2.isOpen).toBe(true);
      expect(snapshotF1.isOpen).toBe(true);

      expect(snapshotR1.isClosed).toBe(false);
      expect(snapshotR2.isClosed).toBe(false);
      expect(snapshotF1.isClosed).toBe(false);

      expect(snapshotR1.iModelId).toBeDefined();
      expect(snapshotR2.iModelId).toBeDefined();
      expect(snapshotF1.iModelId).toBeDefined();

      expect(Guid.isV4Guid(snapshotR1.iModelId)).toBe(true);
      expect(Guid.isV4Guid(snapshotR2.iModelId)).toBe(true);
      expect(Guid.isV4Guid(snapshotF1.iModelId)).toBe(true);

      expect(snapshotR1.isSnapshot).toBe(true);
      expect(snapshotR2.isSnapshot).toBe(true);
      expect(snapshotF1.isSnapshot).toBe(true);

      expect(snapshotR1.isSnapshotConnection()).toBe(true);
      expect(snapshotR2.isSnapshotConnection()).toBe(true);
      expect(snapshotF1.isSnapshotConnection()).toBe(true);

      expect(snapshotR1.isBriefcase).toBe(false);
      expect(snapshotR2.isBriefcase).toBe(false);
      expect(snapshotF1.isBriefcase).toBe(false);

      expect(snapshotR1.isCheckpointConnection()).toBe(false);
      expect(snapshotR2.isCheckpointConnection()).toBe(false);
      expect(snapshotF1.isCheckpointConnection()).toBe(false);

      expect(snapshotR1.schemaContext).toBeDefined();
      expect(snapshotR2.schemaContext).toBeDefined();
      expect(snapshotF1.schemaContext).toBeDefined();


      const testKey = new SchemaKey("BisCore");
      const schemaElemR1 = await snapshotR1.schemaContext.getSchema(testKey);
      expect(schemaElemR1).toBeDefined();
      const schemaElemR2 = await snapshotR2.schemaContext.getSchema(testKey);
      expect(schemaElemR2).toBeDefined();
      const schemaElemF1 = await snapshotF1.schemaContext.getSchema(testKey);
      expect(schemaElemF1).toBeDefined();
      const elementPropsR1 = await snapshotR1.elements.getProps(IModel.rootSubjectId);
      expect(1).toBe(elementPropsR1.length);
      expect(elementPropsR1[0].id).toBe(IModel.rootSubjectId);
      await snapshotR1.close(); // R1 is the same backend iModel as F1, but close should not affect F1

      const elementPropsR2 = await snapshotR2.elements.getProps(IModel.rootSubjectId);
      expect(1).toBe(elementPropsR2.length);
      expect(elementPropsR2[0].id).toBe(IModel.rootSubjectId);
      await snapshotR2.close();

      const elementPropsF1 = await snapshotF1.elements.getProps(IModel.rootSubjectId);
      expect(1, "R1 close should not have affected F1").toBe(elementPropsF1.length);
      expect(elementPropsF1[0].id, "R1 close should not have affected F1").toBe(IModel.rootSubjectId);
      await snapshotF1.close();

      expect(snapshotR1.isOpen).toBe(false);
      expect(snapshotR2.isOpen).toBe(false);
      expect(snapshotF1.isOpen).toBe(false);

      expect(snapshotR1.isClosed).toBe(true);
      expect(snapshotR2.isClosed).toBe(true);
      expect(snapshotF1.isClosed).toBe(true);


    });
  });
};
