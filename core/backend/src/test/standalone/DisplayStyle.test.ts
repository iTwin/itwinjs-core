/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@bentley/bentleyjs-core";
import { IModel, SkyBoxImageType, SkyBoxProps, SkyCubeProps } from "@bentley/imodeljs-common";
import { DisplayStyle3d, StandaloneDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("DisplayStyle", () => {
  let db: StandaloneDb;

  before(() => {
    db = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("DisplayStyle", "DisplayStyle.bim"), {
      rootSubject: { name: "DisplayStyle tests", description: "DisplayStyle tests" },
      client: "DisplayStyle",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });

  after(() => {
    db.abandonChanges();
    db.close();
  });

  it("preserves skybox", () => {
    function roundTrip(sky: SkyBoxProps): void {
      const props = { environment: { sky } };
      const name = Guid.createValue();
      const id = DisplayStyle3d.insert(db, IModel.dictionaryId, name, props);
      expect(id).not.to.equal("0");

      const style = db.elements.getElement<DisplayStyle3d>(id);
      expect(style.settings.environment.sky).not.to.be.undefined;
      for (const key of Object.keys(sky)) {
        const propName = key as keyof SkyBoxProps;
        expect(style.settings.environment.sky![propName]).to.deep.equal(sky[propName]);
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

    function roundTripImage(type: SkyBoxImageType, texIdOrCube: string | SkyCubeProps): void {
      if (typeof texIdOrCube === "string")
        roundTrip({ image: { type, texture: texIdOrCube } });
      else
        roundTrip({ image: { type, textures: texIdOrCube } });
    }

    roundTripImage(SkyBoxImageType.Spherical, "0x123");
    roundTripImage(SkyBoxImageType.Cylindrical, "0x123");
    roundTripImage(SkyBoxImageType.Cube, { front: "0x1", back: "0x2", left: "0x3", right: "0x4", top: "0x5", bottom: "0x6" });
  });
});
