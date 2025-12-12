/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, BeEvent, Guid, Id64Set, Id64String } from "@itwin/core-bentley";
import { DrawingUpdates } from "../../DrawingMonitor";
import { createDrawingMonitor, DrawingMonitorImpl } from "../../internal/DrawingMonitorImpl";
import { StandaloneDb } from "../../IModelDb";
import { TxnIdString } from "../../TxnManager";
import { IModelTestUtils } from "../IModelTestUtils";
import { DefinitionModel, GeometricModel } from "../../Model";
import { Code, IModel, PhysicalElementProps, SectionDrawingProps, SubCategoryAppearance } from "@itwin/core-common";
import { SpatialCategory } from "../../Category";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { CategorySelector, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { DisplayStyle3d } from "../../DisplayStyle";
import { Drawing, GeometricElement3d, SectionDrawing } from "../../Element";
import { DrawingProvenance } from "../../internal/DrawingProvenance";

function createFakeTimer() {
  const onResolved = new BeEvent<() => void>();
  const onError = new BeEvent<(reason: string) => void>();
  const promise = new Promise<void>((resolve, reject) => {
    onResolved.addListener(() => resolve());
    onError.addListener((reason) => reject(reason));
  });

  return {
    promise,
    resolve: async () => {
      onResolved.raiseEvent();
      return BeDuration.wait(1);
    },
    reject: async (reason: string) => {
      onError.raiseEvent(reason);
      return BeDuration.wait(1);
    },
  };
}

async function computeUpdates(drawingIds: Id64Set): Promise<DrawingUpdates> {
  const map = new Map<string, string>();
  for (const id of drawingIds) {
    map.set(id, id);
  }

  return map;
}

async function awaitState(mon: DrawingMonitorImpl, state: string): Promise<void> {
  if (mon.state.name === state) {
    return;
  }

  await BeDuration.wait(1);
  return awaitState(mon, state);
}

describe.only("DrawingMonitorImpl", () => {
  let db: StandaloneDb;
  let definitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let altSpatialCategoryId: Id64String;
  let spatial1: { element: string, model: string }; // viewed by spatialView1 and spatialView2
  let spatial2: { element: string, model: string }; // viewed by spatialView2
  let spatial3: { element: string, model: string }; // not viewed by anyone
  let spatialView1: Id64String;
  let spatialView2: Id64String;
  let drawing1: Id64String;
  let drawing2: Id64String;

  function insertSpatialModelAndElement(): { model: Id64String, element: Id64String } {
    const model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(db, { spec: "0x1", scope: "0x1", value: Guid.createValue() })[1];

    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      model,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      placement: {
        origin: [0, 0, 0],
        angles: { yaw: 0, roll: 0, pitch: 0 },
      },
      geom: IModelTestUtils.createBox(new Point3d(1, 1, 1)),
    }

    const element = db.elements.insertElement(props);
    db.saveChanges();
    return { model, element };
  }

  function insertSpatialView(viewedModels: Id64String[]): Id64String {
    const guid = Guid.createValue();
    const modelSelector = ModelSelector.insert(db, definitionModelId, guid, viewedModels);
    const categorySelector = CategorySelector.insert(db, definitionModelId, guid, [spatialCategoryId, altSpatialCategoryId]);
    const displayStyle = DisplayStyle3d.insert(db, definitionModelId, guid);
    const viewRange = new Range3d(0, 0, 0, 500, 500, 500);
    const viewId = SpatialViewDefinition.insertWithCamera(db, definitionModelId, guid, modelSelector, categorySelector, displayStyle, viewRange);
    db.saveChanges();
    return viewId;
  }

  function insertSectionDrawing(spatialViewId: Id64String | undefined): Id64String {
    const props: SectionDrawingProps = {
      classFullName: SectionDrawing.classFullName,
      model: definitionModelId,
      code: Drawing.createCode(db, definitionModelId, Guid.createValue()),
      spatialView: spatialViewId ? { id: spatialViewId } : undefined,
    };

    const id = db.elements.insertElement(props);
    db.saveChanges();
    return id;
  }

  function touchSpatialElement(id: Id64String): void {
    const elem = db.elements.getElement<GeometricElement3d>(id);
    elem.category = (elem.category === spatialCategoryId ? altSpatialCategoryId : spatialCategoryId);
    elem.update();
    db.saveChanges();
  }

  function getGeometryGuid(modelId: Id64String): string {
    const model = db.models.getModel<GeometricModel>(modelId);
    expect(model.geometryGuid).not.to.be.undefined;
    return model.geometryGuid!;
  }

  before(async () => {
    const filePath = IModelTestUtils.prepareOutputFile("DrawingMonitorImplTests", "DrawingMonitorImpl.bim");
    db = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "DrawingMonitorImpl", description: "" },
      enableTransactions: true,
    });

    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);

    definitionModelId = DefinitionModel.insert(db, IModel.rootSubjectId, "DrawingProvenance");
    spatialCategoryId = SpatialCategory.insert(db, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    altSpatialCategoryId = SpatialCategory.insert(db, definitionModelId, "AltSpatialCategory", new SubCategoryAppearance());

    spatial1 = insertSpatialModelAndElement();
    spatial2 = insertSpatialModelAndElement();
    spatial3 = insertSpatialModelAndElement();
    spatialView1 = insertSpatialView([spatial1.model]);
    spatialView2 = insertSpatialView([spatial1.model, spatial2.model]);
    drawing1 = insertSectionDrawing(spatialView1);
    drawing2 = insertSectionDrawing(spatialView2);

    DrawingProvenance.update(drawing1, db);
    DrawingProvenance.update(drawing2, db);

    db.saveChanges();

  });

  after(() => db.close());

  async function test(getUpdateDelay: (() => Promise<void>) | undefined, func: (monitor: DrawingMonitorImpl) => Promise<void>): Promise<void> {
    const monitor = createDrawingMonitor({
      getUpdateDelay: getUpdateDelay ?? (() => Promise.resolve()),
      iModel: db,
      computeUpdates,
    });

    try {
      await func(monitor);
    } finally {
      monitor.terminate();
    }
  }

  describe("state transitions", () => {
    let initialTxnId: TxnIdString;

    beforeEach(() => {
      initialTxnId = db.txns.getCurrentTxnId();
    });

    afterEach(() => {
      db.txns.reverseTo(initialTxnId);
    });

    describe("Idle", () => {
      it("geometry change detected => Delayed", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          touchSpatialElement(spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Idle (empty) if no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            expect(mon.state.name).to.equal("Idle");
            const promise = mon.getUpdates();
            expect(mon.state.name).to.equal("Idle");
            const results = await promise;
            expect(results.size).to.equal(0);
          })
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          expect(mon.state.name).to.equal("Idle");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    })

    describe("Terminated", () => {
      it("geometry change detected => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          touchSpatialElement(spatial1.element);
          expect(mon.state.name).to.equal("Terminated");
        });
      });

      it("getUpdates => Error", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          expect(() => mon.getUpdates()).to.throw();
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");

          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });

    describe("Delayed", async () => {
      it("geometry change detected => Delayed (restart)", async () => {
        const timer = createFakeTimer();
        await test(() => timer.promise, async (mon) => {
          touchSpatialElement(spatial1.element);
          const state = mon.state;
          expect(state.name).to.equal("Delayed");
      
          touchSpatialElement(spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          expect(mon.state).not.to.equal(state);
        });
      });

      describe("delay expired", () => {
        it("=> Requested if any drawings require regeneration", async () => {

        });

        it("=> Cached (empty) if no drawings require regeneration", async () => {
          const timer = createFakeTimer();
          await test(() => timer.promise, async (mon) => {
            touchSpatialElement(spatial1.element);
            expect(mon.state.name).to.equal("Delayed");
            await timer.resolve();
            expect(mon.state.name).to.equal("Cached");
            const results = await mon.getUpdates();
            expect(results.size).to.equal(2);
          });
        });
      });

      describe("getUpdates", () => {
        it("=> Requested if any drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            touchSpatialElement(spatial1.element);
            expect(mon.state.name).to.equal("Delayed");
            const promise = mon.getUpdates();
            expect(mon.state.name).to.equal("Requested");
            const results = await promise;
            expect(results.size).to.equal(2);
          });
        });
      });

      it("terminate => Terminated", async () => {
        await test(undefined, async (mon) => {
          touchSpatialElement(spatial1.element);
          expect(mon.state.name).to.equal("Delayed");
          mon.terminate();
          expect(mon.state.name).to.equal("Terminated");
        });
      });
    });

    describe("Requested", async () => {
      
    });

    describe.skip("Cached", async () => {
      describe("geometry change detected", () => {
        it("=> Delayed if not awaiting updates", async () => {
          const timer = createFakeTimer();
          await test(() => timer.promise, async (mon) => {
            expect(mon.state.name).to.equal("Idle");

            touchSpatialElement(spatial1.element);
            expect(mon.state.name).to.equal("Delayed");

            await timer.resolve();
            expect(mon.state.name).to.equal("Cached");

            touchSpatialElement(spatial1.element);
            expect(mon.state.name).to.equal("Delayed"); // ###TODO actually Cached (timer already resolved, I think)
          });
        });

        it("=> Requested if awaiting updates and drawings require regeneration", async () => {

        });

        it("=> Idle (empty) if awaiting updates and no drawings require regeneration", async () => {
          await test(undefined, async (mon) => {
            const promise = mon.getUpdates();
            const state = mon.state;
            expect(state.name).to.equal("Idle");

            touchSpatialElement(spatial1.element);
            expect(mon.state.name).to.equal("Idle"); // ###TODO actually Delayed
            expect(mon.state).not.to.equal(state);
            const results = await promise;
            expect(results.size).to.equal(0);
          });
        });
      });

      it("###TODO");
    });
  });
});

