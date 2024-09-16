/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CompressedId64Set, Guid } from "@itwin/core-bentley";
import { DisplayStyleSettingsProps, IModel, SkyBoxImageType, SkyBoxProps } from "@itwin/core-common";
import { DisplayStyle3d, IModelElementCloneContext, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("DisplayStyle", () => {
  let db: StandaloneDb;
  let db2: StandaloneDb;

  before(() => {
    db = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DisplayStyle", "DisplayStyle.bim"), {
      rootSubject: { name: "DisplayStyle tests", description: "DisplayStyle tests" },
      client: "DisplayStyle",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    db2 = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DisplayStyle2", "DisplayStyle2.bim"), {
      rootSubject: { name: "DisplayStyle tests", description: "DisplayStyle tests" },
      client: "DisplayStyle",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });

  afterEach(() => {
    db.abandonChanges();
    db2.abandonChanges();
  });

  after(() => {
    db.close();
    db2.close();
  });

  it("preserves skybox", () => {
    function roundTrip(sky: SkyBoxProps): void {
      const props = { environment: { sky } };
      const name = Guid.createValue();
      const id = DisplayStyle3d.insert(db, IModel.dictionaryId, name, props);
      expect(id).not.to.equal("0");

      const style = db.elements.getElement<DisplayStyle3d>(id);
      const sky2 = style.jsonProperties.styles.environment.sky!;
      expect(sky2).not.to.be.undefined;
      for (const key of Object.keys(sky)) {
        const propName = key as keyof SkyBoxProps;
        expect(sky2[propName]).to.deep.equal(sky[propName]);
      }
    }

    roundTrip({ display: true });
    roundTrip({ display: false });

    roundTrip({ twoColor: true });
    roundTrip({ twoColor: false });

    roundTrip({ skyColor: 0x123456 });
    roundTrip({ groundColor: 42 });
    roundTrip({ zenithColor: 0x43 });
    roundTrip({ nadirColor: 0 });

    roundTrip({ skyExponent: 0.2 });
    roundTrip({ groundExponent: -2.2 });

    roundTrip({ image: { type: SkyBoxImageType.None } });

    roundTrip({ image: { type: SkyBoxImageType.Spherical, texture: "0x123" } });
    roundTrip({ image: { type: SkyBoxImageType.Spherical, texture: "images/sky.jpg" } });

    roundTrip({ image: { type: SkyBoxImageType.Cube, textures: { front: "0x1", back: "0x2", left: "0x3", right: "0x4", top: "0x5", bottom: "0x6" } } });
    roundTrip({ image: { type: SkyBoxImageType.Cube, textures: { front: "front.jpg", back: "back.png", left: "left.jpeg", right: "right.jpg", top: "top.png", bottom: "bottom.png" } } });
  });

  describe("onClone", () => {
    it("remaps excludedElements when cloning", () => {
      const cloneContext = new IModelElementCloneContext(db, db2);
      const displayStyleJsonProps: DisplayStyleSettingsProps = {excludedElements: ["0x1", "0x2", "0x3", "0x4"]};
      const displayStyleId = DisplayStyle3d.insert(db, IModel.dictionaryId, "TestStyle", displayStyleJsonProps);

      cloneContext.remapElement("0x1", "0xa");
      cloneContext.remapElement("0x3", "0xc");
      const displayStyle = db.elements.getElement<DisplayStyle3d>(displayStyleId);
      const displayStyleClone = cloneContext.cloneElement(displayStyle);

      const excludedElementsClone  = CompressedId64Set.decompressArray(displayStyleClone.jsonProperties.styles.excludedElements);
      expect(excludedElementsClone.length).to.equal(2);
      expect(excludedElementsClone).to.contain.members(["0xa", "0xc"]);
    });

    it("remaps subCategory overrides when cloning", () => {
      const cloneContext = new IModelElementCloneContext(db, db2);
      const displayStyleJsonProps: DisplayStyleSettingsProps = {subCategoryOvr: [
        {subCategory: "0x1", weight: 5},
        {subCategory: "0x2", weight: 3},
        {subCategory: "0x3", invisible: false},
        {subCategory: "0x4", invisible: true},
      ]};
      const displayStyleId = DisplayStyle3d.insert(db, IModel.dictionaryId, "TestStyle", displayStyleJsonProps);

      cloneContext.remapElement("0x1", "0xa");
      cloneContext.remapElement("0x4", "0xd");
      const displayStyle = db.elements.getElement<DisplayStyle3d>(displayStyleId);
      const displayStyleClone = cloneContext.cloneElement(displayStyle);

      const subCategoryOvrClone  = displayStyleClone.jsonProperties.styles.subCategoryOvr;
      expect(subCategoryOvrClone.length).to.equal(2);
      expect(subCategoryOvrClone).to.deep.contain.members([
        {subCategory: "0xa", weight: 5},
        {subCategory: "0xd", invisible: true},
      ]);
    });
  });
});
