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
    this.initFromProps(props.name ?? props.rootSubject.name, props);
  }

  public initFromProps(name: string, props: IModelProps): void {
    this.initialize(name, props);
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

      // ###TODO equivalent ECEF and GCS

      expectNoChange(imodel, () => imodel.initFromProps(imodel.name, {...props}));
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
