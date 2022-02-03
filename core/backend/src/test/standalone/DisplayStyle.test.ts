/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid } from "@itwin/core-bentley";
import type { SkyBoxProps } from "@itwin/core-common";
import { IModel, SkyBoxImageType } from "@itwin/core-common";
import { DisplayStyle3d, StandaloneDb } from "../../core-backend";
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
});
