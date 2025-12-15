/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BeDuration, BeEvent, Guid, Id64String } from "@itwin/core-bentley";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { DefinitionModel } from "../../Model";
import { Code, IModel, PhysicalElementProps, SectionDrawingProps, SubCategoryAppearance } from "@itwin/core-common";
import { SpatialCategory } from "../../Category";
import { Point3d, Range3d } from "@itwin/core-geometry";
import { CategorySelector, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { DisplayStyle3d } from "../../DisplayStyle";
import { Drawing, GeometricElement3d, SectionDrawing } from "../../Element";
import { SectionDrawingProvenance } from "../../SectionDrawingProvenance";

export interface FakeTimer {
  readonly promise: Promise<void>;
  readonly resolve: () => Promise<void>;
  readonly reject: (reason: string) => Promise<void>;
  readonly isResolved: () => boolean;
}

export function createFakeTimer(): FakeTimer {
  const onResolved = new BeEvent<() => void>();
  const onError = new BeEvent<(reason: string) => void>();
  const promise = new Promise<void>((resolve, reject) => {
    onResolved.addListener(() => resolve());
    onError.addListener((reason) => reject(reason));
  });

  let resolved = false;
  return {
    promise,
    isResolved: () => resolved,
    resolve: async () => {
      resolved = true;
      onResolved.raiseEvent();
      return BeDuration.wait(1);
    },
    reject: async (reason: string) => {
      onError.raiseEvent(reason);
      return BeDuration.wait(1);
    },
  };
}

export interface TestCase {
  readonly db: StandaloneDb;
  readonly definitionModelId: Id64String;
  readonly spatialCategoryId: Id64String;
  readonly altSpatialCategoryId: Id64String;
  readonly spatial1: { element: string, model: string }; // viewed by spatialView1 and spatialView2
  readonly spatial2: { element: string, model: string }; // viewed by spatialView2
  readonly spatial3: { element: string, model: string }; // not viewed by anyone
  readonly spatialView1: Id64String;
  readonly spatialView2: Id64String;
  readonly drawing1: Id64String;
  readonly drawing2: Id64String;

  touchSpatialElement(id: Id64String): void;
  insertSpatialModelAndElement(): { model: Id64String, element: Id64String };
  insertSpatialView(viewedModels: Id64String[]): Id64String;
  insertSectionDrawing(spatialViewId: Id64String | undefined): Id64String;
}

export namespace TestCase {
  export function create(name: string): TestCase {
    const filePath = IModelTestUtils.prepareOutputFile(name, `${name}.bim`);
    const db = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name, description: "" },
      enableTransactions: true,
    });

    let bisVer = db.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).least(22);

    const definitionModelId = DefinitionModel.insert(db, IModel.rootSubjectId, name);
    const spatialCategoryId = SpatialCategory.insert(db, definitionModelId, "SpatialCategory", new SubCategoryAppearance());
    const altSpatialCategoryId = SpatialCategory.insert(db, definitionModelId, "AltSpatialCategory", new SubCategoryAppearance());

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

      // The tests want to start with drawings that have up-to-date provenance.
      const drawing = db.elements.getElement<SectionDrawing>(id);
      SectionDrawingProvenance.store(drawing, SectionDrawingProvenance.compute(drawing));
      drawing.update();
      db.saveChanges();

      return id;
    }

    const spatial1 = insertSpatialModelAndElement();
    const spatial2 = insertSpatialModelAndElement();
    const spatial3 = insertSpatialModelAndElement();
    const spatialView1 = insertSpatialView([spatial1.model]);
    const spatialView2 = insertSpatialView([spatial1.model, spatial2.model]);
    const drawing1 = insertSectionDrawing(spatialView1);
    const drawing2 = insertSectionDrawing(spatialView2);

    db.saveChanges();
    
    return {
      db,
      definitionModelId,
      spatialCategoryId,
      altSpatialCategoryId,
      spatial1,
      spatial2,
      spatial3,
      spatialView1,
      spatialView2,
      drawing1,
      drawing2,
      insertSpatialModelAndElement,
      insertSpatialView,
      insertSectionDrawing,
      touchSpatialElement: (id) => {
        const elem = db.elements.getElement<GeometricElement3d>(id);
        elem.category = (elem.category === spatialCategoryId ? altSpatialCategoryId : spatialCategoryId);
        elem.update();
        db.saveChanges();
      },
    }
  }
}
