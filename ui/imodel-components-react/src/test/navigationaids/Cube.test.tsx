/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Matrix3d } from "@itwin/core-geometry";
import { Cube, CubeFace, Face } from "../../imodel-components-react/navigationaids/Cube";

describe("Cube", () => {
  describe("<Cube />", () => {
    it("should render", () => {
      const r = Matrix3d.createIdentity();
      mount(<Cube rotMatrix={r} />);
    });
    it("renders correctly", () => {
      const r = Matrix3d.createIdentity();
      shallow(<Cube rotMatrix={r} />).should.matchSnapshot();
    });
    it("renders with faces correctly", () => {
      const r = Matrix3d.createIdentity();
      shallow(<Cube rotMatrix={r} faces={{
        [Face.Top]: <div>Top Face</div>,
        [Face.Bottom]: <div>Bottom Face</div>,
        [Face.Front]: <div>Front Face</div>,
        [Face.Back]: <div>Back Face</div>,
        [Face.Left]: <div>Left Face</div>,
        [Face.Right]: <div>Right Face</div>,
      }} />).should.matchSnapshot();
    });
  });
  describe("<CubeFace />", () => {
    it("should render", () => {
      const r = Matrix3d.createIdentity();

      mount(<CubeFace rotMatrix={r} face={Face.Top} />);
    });
    it("renders correctly", () => {
      const r = Matrix3d.createIdentity();
      shallow(<CubeFace rotMatrix={r} face={Face.Top} />).should.matchSnapshot();
    });
    it("correctly renders nothing when face is Face.None", () => {
      const r = Matrix3d.createIdentity();
      shallow(<CubeFace rotMatrix={r} face={Face.None} />).should.matchSnapshot();
    });
  });
});
