/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";
import { GraphicBuilder } from "../../render/GraphicBuilder";
import { GraphicType } from "../../common/render/GraphicType";
import { Point2d } from "@itwin/core-geometry";
import { GraphicTemplate } from "../../core-frontend";
import { _nodes } from "../../common/internal/Symbols";

describe.only("GraphicTemplate", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  it("produces reusable non-disposable geometry", () => {
    function expectDisposed(tmplt: GraphicTemplate, expected: boolean): void {
      for (const node of tmplt[_nodes]) {
        for (const geom of node.geometry) {
          expect(geom.isDisposed).to.equal(expected);
        }
      }
    }

    const builder = IModelApp.renderSystem.createGraphic({ type: GraphicType.Scene, computeChordTolerance: () => 0 });
    builder.addLineString2d([new Point2d(0, 1), new Point2d(2, 3)], 0);
    builder.addShape2d([new Point2d(0, 0), new Point2d(0, 5), new Point2d(5, 0), new Point2d(0, 0)], 0);
    const template = builder.finishTemplate();
    expectDisposed(template, false);
    const graphic = IModelApp.renderSystem.createGraphicFromTemplate({ template });

    graphic.dispose();
    expectDisposed(template, false);
  });
  
  it("is not instanceable if GraphicBuilder or GraphicDescription specifies a view-independent origin", () => {
    
  });

  it("produces a batch if features are specified", () => {
    
  });

  it("produces a Branch if GraphicDescription specifies a translation", () => {
    
  });

  it("is instanceable otherwise", () => {
    
  });
});
