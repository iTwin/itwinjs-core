/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { EcefLocation, EcefLocationProps, IModel, IModelProps, RootSubjectProps } from "../IModel";
import { GeographicCRS } from "../geometry/CoordinateReferenceSystem";

interface TestIModelProps extends IModelProps {
  key: string;
}

class TestIModel extends IModel {
  public get isOpen() { return true; }
  public get isSnapshot() { return true; }
  public get isBriefcase() { return false; }

  public constructor(props: TestIModelProps) {
    super(props, OpenMode.Readonly);
    this.initFromProps(props);
  }

  public initFromProps(props: IModelProps): void {
    this.initialize(props.name ?? props.rootSubject.name, props);
  }

  public getProps(): IModelProps {
    return {
      name: this.name,
      rootSubject: { ...this.rootSubject },
      projectExtents: this.projectExtents.toJSON(),
      globalOrigin: this.globalOrigin.toJSON(),
      ecefLocation: this.ecefLocation,
      geographicCoordinateSystem: this.geographicCoordinateSystem,
    };
  }
}

describe("IModel", () => {
  describe("changed events", () => {
    interface ChangedProp<T> {
      prev: T;
      curr: T;
    }

    interface IModelChangedProps {
      name?: ChangedProp<string>;
      subject?: ChangedProp<RootSubjectProps>;
      extents?: ChangedProp<Range3d>;
      globalOrigin?: ChangedProp<Point3d>;
      ecef?: ChangedProp<EcefLocation | undefined>;
      gcs?: ChangedProp<GeographicCRS | undefined>;
    }

    function expectChange(imodel: IModel, func: () => void, expected: IModelChangedProps): void {
      const actual: IModelChangedProps = { };

      imodel.onNameChanged.addOnce((prev) => {
        expect(actual.name).to.be.undefined;
        actual.name = { prev, curr: imodel.name };
      });

      imodel.onRootSubjectChanged.addOnce((prev) => {
        expect(actual.subject).to.be.undefined;
        actual.subject = { prev, curr: imodel.rootSubject };
      });

      imodel.onProjectExtentsChanged.addOnce((prev) => {
        expect(actual.extents).to.be.undefined;
        actual.extents = { prev, curr: imodel.projectExtents };
      });

      imodel.onGlobalOriginChanged.addOnce((prev) => {
        expect(actual.globalOrigin).to.be.undefined;
        actual.globalOrigin = { prev, curr: imodel.globalOrigin };
      });

      imodel.onEcefLocationChanged.addOnce((prev) => {
        expect(actual.ecef).to.be.undefined;
        actual.ecef = { prev, curr: imodel.ecefLocation };
      });

      imodel.onGeographicCoordinateSystemChanged.addOnce((prev) => {
        expect(actual.gcs).to.be.undefined;
        actual.gcs = { prev, curr: imodel.geographicCoordinateSystem };
      });

      func();

      expect(actual).to.deep.equal(expected);
    }

    function expectNoChange(imodel: IModel, func: () => void): void {
      expectChange(imodel, func, { });
    }

    it("are dispatched when properties change", () => {
      const props: TestIModelProps = {
        key: "",
        name: "imodel",
        rootSubject: { name: "subject", description: "SUBJECT" },
        projectExtents: { low: [0, 1, 2], high: [3, 4, 5] },
        globalOrigin: [-1, -2, -3],
      };

      const imodel = new TestIModel(props);

      expectChange(imodel, () => imodel.name = "new name", { name: { prev: "imodel", curr: "new name" } });

      expectChange(imodel, () => imodel.rootSubject = { name: "subj" }, {
        subject: {
          prev: props.rootSubject,
          curr: { name: "subj" },
        },
      });

      const newRange = Range3d.fromJSON({ low: [0, 0, 0], high: [100, 100, 100] });
      expectChange(imodel, () => imodel.projectExtents = newRange, { extents: { prev: imodel.projectExtents, curr: newRange } });

      const newOrigin = new Point3d(101, 202, 303);
      expectChange(imodel, () => imodel.globalOrigin = newOrigin, { globalOrigin: { prev: imodel.globalOrigin, curr: newOrigin } });

      const ecef = new EcefLocation({
        origin: [42, 21, 0],
        orientation: { yaw: 1, pitch: 1, roll: -1 },
      });
      expectChange(imodel, () => imodel.setEcefLocation(ecef), { ecef: { prev: undefined, curr: ecef } });
      const newEcef = new EcefLocation({
        origin: [0, 10, 20],
        orientation: { yaw: 5, pitch: 90, roll: -45 },
      });
      expectChange(imodel, () => imodel.setEcefLocation(newEcef), { ecef: { prev: ecef, curr: newEcef } });
      expectChange(imodel, () => imodel.initFromProps({...imodel.getProps(), ecefLocation: undefined}), { ecef: { prev: newEcef, curr: undefined } });

      const newProps: TestIModelProps = {
        key: "",
        name: "abc",
        rootSubject: { name: "new subject" },
        projectExtents: { low: [-100, 0, -50], high: [100, 20, 50] },
        globalOrigin: [123, 456, 789],
      };
      expectChange(imodel, () => imodel.initFromProps(newProps), {
        name: { prev: imodel.name, curr: "abc" },
        subject: { prev: imodel.rootSubject, curr: { name: "new subject" } },
        extents: { prev: imodel.projectExtents, curr: Range3d.fromJSON(newProps.projectExtents) },
        globalOrigin: { prev: imodel.globalOrigin, curr: Point3d.fromJSON(newProps.globalOrigin) },
      });
    });

    it("are not dispatched when no net property change", () => {
      const ecefLocation: EcefLocationProps = {
        origin: [0, 1, 2],
        orientation: { yaw: 0, pitch: 45, roll: 90 },
      };

      const props: TestIModelProps = {
        key: "",
        name: "imodel",
        rootSubject: { name: "subject", description: "SUBJECT" },
        projectExtents: { low: [0, 1, 2], high: [3, 4, 5] },
        globalOrigin: [-1, -2, -3],
        ecefLocation,
      };

      const imodel = new TestIModel(props);

      expectNoChange(imodel, () => imodel.name = imodel.name);
      expectNoChange(imodel, () => imodel.rootSubject = { ...imodel.rootSubject });
      expectNoChange(imodel, () => imodel.projectExtents = imodel.projectExtents.clone());
      expectNoChange(imodel, () => imodel.globalOrigin = imodel.globalOrigin.clone());
      expectNoChange(imodel, () => imodel.geographicCoordinateSystem = undefined);
      expectNoChange(imodel, () => imodel.setEcefLocation({...ecefLocation}));

      expectNoChange(imodel, () => imodel.initFromProps({...props}));
      expectNoChange(imodel, () => imodel.initFromProps(imodel.getProps()));
    });

    it("are not dispatched when members of RootSubjectProps are directly modified", () => {
      const imodel = new TestIModel({
        key: "",
        name: "imodel",
        rootSubject: { name: "subject", description: "SUBJECT" },
        projectExtents: { low: [0, 1, 2], high: [3, 4, 5] },
        globalOrigin: [-1, -2, -3],
      });

      expectNoChange(imodel, () => imodel.rootSubject.name = "new name");
      expectNoChange(imodel, () => imodel.rootSubject.description = "new description");
    });
  });
});
