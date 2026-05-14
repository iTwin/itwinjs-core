/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Creates a test iModel - Desktop app move/copy performance regression.
 *
 * The generated iModel contains N physical models with M elements each.
 * Each model becomes a separate tile tree reference in the viewport,
 * which amplifies the cost of decoration rebuilds during dynamics.
 */

import * as os from "os";
import * as path from "path";
import { Id64String } from "@itwin/core-bentley";
import {
  CategorySelector, DisplayStyle3d, ModelSelector, PhysicalModel,
  SpatialCategory, SpatialViewDefinition, StandaloneDb,
} from "@itwin/core-backend";
import {
  Code, ColorByName, GeometricElement3dProps, GeometryStreamBuilder, IModel, SubCategoryAppearance,
} from "@itwin/core-common";
import {
  Box, LineSegment3d, LineString3d, Loop, Point3d, Range3d, Vector3d, YawPitchRollAngles,
} from "@itwin/core-geometry";

export interface CreateReproIModelResult {
  filePath: string;
  numModels: number;
  totalElements: number;
}

/**
 * Create equipment-like geometry: a box body with wire stubs extending from each face.
 * This produces enough geometry to generate meaningful tile trees.
 */
function buildEquipmentGeometry(
  builder: GeometryStreamBuilder,
  width: number,
  depth: number,
  height: number,
): void {
  // Main body — a solid box
  const box = Box.createDgnBox(
    Point3d.create(0, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(),
    Point3d.create(0, 0, height),
    width, depth, width, depth, true,
  );
  if (box)
    builder.appendGeometry(box);

  // Wire stubs extending from sides (simulates cable connections)
  const cx = width / 2;
  const cy = depth / 2;
  const stubLen = 0.8;

  // Left side stubs
  builder.appendGeometry(LineSegment3d.create(
    Point3d.create(0, cy, height * 0.3),
    Point3d.create(-stubLen, cy, height * 0.3),
  ));
  builder.appendGeometry(LineSegment3d.create(
    Point3d.create(0, cy, height * 0.7),
    Point3d.create(-stubLen, cy, height * 0.7),
  ));
  // Right side stubs
  builder.appendGeometry(LineSegment3d.create(
    Point3d.create(width, cy, height * 0.3),
    Point3d.create(width + stubLen, cy, height * 0.3),
  ));
  builder.appendGeometry(LineSegment3d.create(
    Point3d.create(width, cy, height * 0.7),
    Point3d.create(width + stubLen, cy, height * 0.7),
  ));

  // Top connector plate — a closed loop polygon on top
  builder.appendGeometry(Loop.createPolygon([
    Point3d.create(cx - 0.2, cy - 0.2, height),
    Point3d.create(cx + 0.2, cy - 0.2, height),
    Point3d.create(cx + 0.2, cy + 0.2, height),
    Point3d.create(cx - 0.2, cy + 0.2, height),
    Point3d.create(cx - 0.2, cy - 0.2, height),
  ]));
}

/**
 * Create a simple bus bar geometry: a long rectangular profile with taps.
 */
function buildBusBarGeometry(
  builder: GeometryStreamBuilder,
  length: number,
): void {
  const barHeight = 0.15;
  const barWidth = 0.05;

  // Main bar
  builder.appendGeometry(Box.createDgnBox(
    Point3d.create(0, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(),
    Point3d.create(0, 0, barHeight),
    length, barWidth, length, barWidth, true,
  )!);

  // Tap stubs every 2m
  const numTaps = Math.floor(length / 2);
  for (let t = 0; t < numTaps; t++) {
    const tapX = (t + 1) * 2;
    builder.appendGeometry(LineSegment3d.create(
      Point3d.create(tapX, barWidth / 2, barHeight),
      Point3d.create(tapX, barWidth / 2, barHeight + 0.5),
    ));
  }
}

/**
 * Create cable routing geometry: a 3D polyline.
 */
function buildCableGeometry(
  builder: GeometryStreamBuilder,
  fromPt: Point3d,
  toPt: Point3d,
): void {
  // Route with a vertical jog in the middle
  const midX = (fromPt.x + toPt.x) / 2;
  const maxZ = Math.max(fromPt.z, toPt.z) + 1.5;
  builder.appendGeometry(LineString3d.create([
    fromPt,
    Point3d.create(fromPt.x, fromPt.y, maxZ),
    Point3d.create(midX, (fromPt.y + toPt.y) / 2, maxZ),
    Point3d.create(toPt.x, toPt.y, maxZ),
    toPt,
  ]));
}

export function createReproIModel(numModels: number, elementsPerModel: number): CreateReproIModelResult {
  const filePath = path.join(os.tmpdir(), `repro-1659-${Date.now()}.bim`);

  const db = StandaloneDb.createEmpty(filePath, {
    rootSubject: { name: "Repro1659-DesktopAppSimulation" },
    allowEdit: JSON.stringify({ txns: true }),
  });

  try {
    // Create spatial categories for different equipment types
    const equipmentCat = SpatialCategory.insert(db, IModel.dictionaryId, "Equipment",
      new SubCategoryAppearance({ color: ColorByName.steelBlue }));
    const busCat = SpatialCategory.insert(db, IModel.dictionaryId, "BusBars",
      new SubCategoryAppearance({ color: ColorByName.peru }));
    const cableCat = SpatialCategory.insert(db, IModel.dictionaryId, "Cables",
      new SubCategoryAppearance({ color: ColorByName.darkGreen }));

    const modelIds: Id64String[] = [];
    const allRange = new Range3d();

    // Element spacing constants
    const elementSpacing = 5.0;  // meters between elements
    const modelSpacing = 40.0;   // meters between model rows

    for (let m = 0; m < numModels; m++) {
      const modelId = PhysicalModel.insert(db, IModel.rootSubjectId, `ElectricalSystem-${m}`);
      modelIds.push(modelId);

      for (let e = 0; e < elementsPerModel; e++) {
        const x = e * elementSpacing;
        const y = m * modelSpacing;

        // Vary element types based on index
        const elementType = e % 5;
        const builder = new GeometryStreamBuilder();
        let category: Id64String;
        let width: number, depth: number, height: number;

        switch (elementType) {
          case 0: // Transformer
          case 1: // Switchgear
            width = 1.2 + (e % 3) * 0.3;
            depth = 0.8 + (e % 4) * 0.2;
            height = 1.5 + (m % 5) * 0.3;
            buildEquipmentGeometry(builder, width, depth, height);
            category = equipmentCat;
            break;
          case 2: // Bus bar
            buildBusBarGeometry(builder, 3.0 + (e % 3));
            category = busCat;
            width = 3.0 + (e % 3);
            depth = 0.05;
            height = 0.65;
            break;
          case 3: // Cable
            buildCableGeometry(builder,
              Point3d.create(0, 0, 0.5),
              Point3d.create(elementSpacing * 0.8, 0, 0.5),
            );
            category = cableCat;
            width = elementSpacing * 0.8;
            depth = 0;
            height = 2.0;
            break;
          default: // Small meter/sensor
            width = 0.3;
            depth = 0.3;
            height = 0.4;
            buildEquipmentGeometry(builder, width, depth, height);
            category = equipmentCat;
            break;
        }

        const elementProps: GeometricElement3dProps = {
          classFullName: "Generic:PhysicalObject",
          model: modelId,
          category,
          code: Code.createEmpty(),
          placement: {
            origin: Point3d.create(x, y, 0),
            angles: YawPitchRollAngles.createDegrees(0, 0, 0),
          },
          geom: builder.geometryStream,
        };

        db.elements.insertElement(elementProps);

        allRange.extendXYZ(x - 1, y - 1, -0.5);
        allRange.extendXYZ(x + width + 1, y + depth + 1, height + 1);
      }
    }

    // Create view definition showing all models
    const dictionary = IModel.dictionaryId;
    const modelSelectorId = ModelSelector.insert(db, dictionary, "Repro1659-AllModels", modelIds);
    const categorySelectorId = CategorySelector.insert(db, dictionary, "Repro1659-AllCategories",
      [equipmentCat, busCat, cableCat]);

    const displayStyleId = db.elements.insertElement({
      classFullName: DisplayStyle3d.classFullName,
      code: DisplayStyle3d.createCode(db, dictionary, "Repro1659-Style"),
      model: dictionary,
      jsonProperties: {
        styles: {
          viewflags: {
            renderMode: 6, // SmoothShade
            visEdges: true,
          },
          backgroundColor: ColorByName.darkSlateGray,
        },
      },
    });

    // Create a top-down view of the full extent
    const viewRange = allRange.clone();
    viewRange.expandInPlace(200);

    SpatialViewDefinition.insertWithCamera(db, dictionary, "Repro1659-View", modelSelectorId, categorySelectorId, displayStyleId, viewRange);

    db.saveChanges("Created repro iModel for #1659");
    db.close();

    return {
      filePath,
      numModels,
      totalElements: numModels * elementsPerModel,
    };
  } catch (e) {
    db.abandonChanges();
    db.close();
    throw e;
  }
}
