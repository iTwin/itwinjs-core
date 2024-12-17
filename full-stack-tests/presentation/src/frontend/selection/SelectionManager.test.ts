/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { Cartographic } from "@itwin/core-common";
import { BlankConnection, IModelConnection } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { createTestECInstanceKey } from "@itwin/presentation-common/lib/cjs/test";
import { Presentation } from "@itwin/presentation-frontend";
import { createStorage } from "@itwin/unified-selection";
import { TestIModelConnection } from "../../IModelSetupUtils";
import { initialize, terminate } from "../../IntegrationTests";
import { waitFor } from "../../Utils";

describe("Selection manager", () => {
  describe("with custom unified selection storage", () => {
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    let imodel: IModelConnection;
    let selectionStorage: ReturnType<typeof createStorage>;

    before(async () => {
      selectionStorage = createStorage();
      await initialize({
        presentationFrontendProps: {
          selection: { selectionStorage },
        },
      });

      imodel = TestIModelConnection.openFile(testIModelName);
      expect(imodel).is.not.null;
    });

    after(async () => {
      await imodel.close();
      await terminate();
    });

    beforeEach(() => {
      Presentation.selection.clearSelection("", imodel);
      selectionStorage.clearStorage({ imodelKey: imodel.key });
    });

    it("handles multiple connections to the same imodel", async () => {
      const listener = sinon.spy();
      Presentation.selection.selectionChange.addListener(listener);

      selectionStorage.addToSelection({ imodelKey: imodel.key, source: "test", selectables: [createTestECInstanceKey({ id: "0x1" })] });
      await waitFor(() => expect(listener).to.have.callCount(1));

      const imodel2 = TestIModelConnection.openFile(testIModelName);
      selectionStorage.addToSelection({ imodelKey: imodel2.key, source: "test", selectables: [createTestECInstanceKey({ id: "0x2" })] });
      await waitFor(() => expect(listener).to.have.callCount(2));

      await imodel2.close();
      selectionStorage.addToSelection({ imodelKey: imodel.key, source: "test", selectables: [createTestECInstanceKey({ id: "0x3" })] });
      await waitFor(() => expect(listener).to.have.callCount(3));
    });

    it("handles multiple blank connections", async () => {
      const blank1 = BlankConnection.create({ name: "1", extents: Range3d.createNull(), location: Cartographic.createZero() });
      const blank2 = BlankConnection.create({ name: "2", extents: Range3d.createNull(), location: Cartographic.createZero() });

      try {
        // should this be called automatically?..
        [blank1, blank2].forEach((connection) => IModelConnection.onOpen.raiseEvent(connection));

        selectionStorage.addToSelection({ imodelKey: blank1.name, source: "test", selectables: [createTestECInstanceKey({ id: "0x1" })] });
        await waitFor(() => {
          expect(Presentation.selection.getSelection(blank1).size).to.eq(1);
          expect(Presentation.selection.getSelection(blank2).size).to.eq(0);
        });

        selectionStorage.addToSelection({ imodelKey: blank2.name, source: "test", selectables: [createTestECInstanceKey({ id: "0x2" })] });
        await waitFor(() => {
          expect(Presentation.selection.getSelection(blank1).size).to.eq(1);
          expect(Presentation.selection.getSelection(blank2).size).to.eq(1);
        });
      } finally {
        await Promise.all([blank1, blank2].map(async (connection) => connection.close()));
      }
    });
  });
});
