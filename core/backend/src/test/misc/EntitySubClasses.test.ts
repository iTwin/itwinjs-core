import { AuxCoordSystemProps, Code, GeometricModel2dProps, ModelProps } from "@itwin/core-common";
import { expect } from "chai";
import { SnapshotDb } from "../../IModelDb.js";
import { GeometricModel2d } from "../../Model.js";
import { AuxCoordSystem2d, AuxCoordSystem3d } from "../../ViewDefinition.js";
import { IModelTestUtils } from "../IModelTestUtils.js";

describe("EntitySubClasses", () => {
  let iModelDb: SnapshotDb;

  before(() => {
    const testFileName = IModelTestUtils.prepareOutputFile("EntitySubClasses", "Empty.bim");
    iModelDb = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "Subject" } });
  });

  after(() => {
    iModelDb.close();
  })

  it("should correctly set globalOrigin for GeometricModel2d", async () => {
    const modelProps: ModelProps = {
      modeledElement: { id: "" },
      classFullName: GeometricModel2d.classFullName,
    }

    let model = iModelDb.constructEntity<GeometricModel2d, GeometricModel2dProps>({
      ...modelProps,
      globalOrigin: undefined,
    });
    expect(model.globalOrigin).to.be.undefined;

    model = iModelDb.constructEntity<GeometricModel2d, GeometricModel2dProps>({
      ...modelProps,
      globalOrigin: { x: 1, y: 2 },
    });
    expect(model.globalOrigin?.x).to.equal(1);
    expect(model.globalOrigin?.y).to.equal(2);

    model = iModelDb.constructEntity<GeometricModel2d, GeometricModel2dProps>({
      ...modelProps,
      globalOrigin: [3, 4],
    });
    expect(model.globalOrigin?.x).to.equal(3);
    expect(model.globalOrigin?.y).to.equal(4);
  });

  it("should correctly set origin, angle for AuxCoordSystem2d", async () => {
    const props: AuxCoordSystemProps = {
      classFullName: AuxCoordSystem2d.classFullName,
      model: "",
      code: Code.createEmpty(),
    }

    let coordSystem = new AuxCoordSystem2d({
      ...props,
    }, iModelDb);
    expect(coordSystem.origin).to.be.undefined;
    expect(coordSystem.angle).to.be.undefined;

    coordSystem = new AuxCoordSystem2d({
      ...props,
      origin: { x: 1, y: 2 },
      angle: 45,
    }, iModelDb);
    expect(coordSystem.origin?.x).to.equal(1);
    expect(coordSystem.origin?.y).to.equal(2);
    expect(coordSystem.angle).to.be.equal(45);

    coordSystem = new AuxCoordSystem2d({
      ...props,
      origin: [3, 4],
      angle: { radians: Math.PI / 2 },
    }, iModelDb);
    expect(coordSystem.origin?.x).to.equal(3);
    expect(coordSystem.origin?.y).to.equal(4);
    expect(coordSystem.angle).to.be.equal(90);
  });

  it("should correctly set origin, yaw, pitch, roll for AuxCoordSystem3d", async () => {
    const props: AuxCoordSystemProps = {
      classFullName: AuxCoordSystem3d.classFullName,
      model: "",
      code: Code.createEmpty(),
    }

    let coordSystem = new AuxCoordSystem3d(props, iModelDb)
    expect(coordSystem.origin).to.be.undefined;
    expect(coordSystem.yaw).to.be.undefined;
    expect(coordSystem.pitch).to.be.undefined;
    expect(coordSystem.roll).to.be.undefined;

    coordSystem = new AuxCoordSystem3d({
      ...props,
      origin: { x: 1, y: 2, z: 3 },
      yaw: 10,
      pitch: 20,
      roll: 30,
    }, iModelDb)
    expect(coordSystem.origin?.x).to.equal(1);
    expect(coordSystem.origin?.y).to.equal(2);
    expect(coordSystem.origin?.z).to.equal(3);
    expect(coordSystem.yaw).to.be.equal(10);
    expect(coordSystem.pitch).to.be.equal(20);
    expect(coordSystem.roll).to.be.equal(30);

    coordSystem = new AuxCoordSystem3d({
      ...props,
      origin: [4, 5, 6],
      yaw: { radians: Math.PI / 4 },
      pitch: { radians: Math.PI / 2 },
      roll: { radians: Math.PI },
    }, iModelDb)
    expect(coordSystem.origin?.x).to.equal(4);
    expect(coordSystem.origin?.y).to.equal(5);
    expect(coordSystem.origin?.z).to.equal(6);
    expect(coordSystem.yaw).to.be.equal(45);
    expect(coordSystem.pitch).to.be.equal(90);
    expect(coordSystem.roll).to.be.equal(180);
  });
});
