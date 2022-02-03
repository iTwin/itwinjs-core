/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken, GuidString, Id64String } from "@itwin/core-bentley";
import { Box, Point3d, Range3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import type { GeometryPartProps, GeometryStreamProps, PhysicalElementProps, SubCategoryAppearance} from "@itwin/core-common";
import {
  Code, ColorDef, GeometryParams,
  GeometryStreamBuilder, IModel,
} from "@itwin/core-common";
import { IModelHost } from "../../IModelHost";
import type { IModelDb} from "../../core-backend";
import { BriefcaseDb, BriefcaseManager, DefinitionModel, GeometryPart, PhysicalModel, PhysicalObject, RenderMaterialElement, SpatialCategory, SubCategory, Subject } from "../../core-backend";
import { HubMock } from "../HubMock";
import { IModelTestUtils } from "../IModelTestUtils";
import { HubWrappers } from "..";

class TestIModelWriter {
  public static insertGeometryPart(iModel: IModelDb, definitionModelId: Id64String): Id64String {
    const geometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(iModel, definitionModelId, "GeometryPart"),
      geom: TestIModelWriter.createBox(Point3d.create(3, 3, 3)),
    };
    const geometryPartId = iModel.elements.insertElement(geometryPartProps);
    return geometryPartId;
  }

  // Insert PhysicalObject1
  public static insertPhysicalObject(iModel: IModelDb, physicalModelId: Id64String, spatialCategoryId: Id64String, subCategoryId?: Id64String, renderMaterialId?: Id64String, geometryPartId?: Id64String) {
    const physicalObjectProps1: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      userLabel: "PhysicalObject1",
      geom: TestIModelWriter.createBox(Point3d.create(1, 1, 1), spatialCategoryId, subCategoryId, renderMaterialId, geometryPartId),
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };
    const physicalObjectId1 = iModel.elements.insertElement(physicalObjectProps1);
    return physicalObjectId1;
  }

  private static createBox(size: Point3d, categoryId?: Id64String, subCategoryId?: Id64String, renderMaterialId?: Id64String, geometryPartId?: Id64String): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    if ((undefined !== categoryId) && (undefined !== subCategoryId)) {
      geometryStreamBuilder.appendSubCategoryChange(subCategoryId);
      if (undefined !== renderMaterialId) {
        const geometryParams = new GeometryParams(categoryId, subCategoryId);
        geometryParams.materialId = renderMaterialId;
        geometryStreamBuilder.appendGeometryParamsChange(geometryParams);
      }
    }
    geometryStreamBuilder.appendGeometry(Box.createDgnBox(
      Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
      size.x, size.y, size.x, size.y, true,
    )!);
    if (undefined !== geometryPartId) {
      geometryStreamBuilder.appendGeometryPart3d(geometryPartId);
    }
    return geometryStreamBuilder.geometryStream;
  }

  public static insertSpatialCategory(iModel: IModelDb, modelId: Id64String, categoryName: string, color: ColorDef): Id64String {
    const appearance: SubCategoryAppearance.Props = {
      color: color.toJSON(),
      transp: 0,
      invisible: false,
    };
    return SpatialCategory.insert(iModel, modelId, categoryName, appearance);
  }
}

describe("PushChangesTest (#integration)", () => {
  let iTwinId: GuidString;
  let accessToken: AccessToken;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();
    HubMock.startup("PushChangesTest");

    accessToken = "manager token";
    iTwinId = HubMock.iTwinId;

    IModelHost.authorizationClient = {
      getAccessToken: async () => accessToken,
    };
  });

  after(async () => {
    HubMock.shutdown();
  });

  it.skip("Push changes while refreshing token", async () => {
    const iModelName = IModelTestUtils.generateUniqueName("PushChangesTest");
    const iModelId = await HubWrappers.recreateIModel({ accessToken, iTwinId, iModelName, noLocks: true });

    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken, iTwinId, iModelId });
    let iModel: BriefcaseDb | undefined;
    try {
      iModel = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });

      // Initialize project extents
      const projectExtents = new Range3d(-1000, -1000, -1000, 1000, 1000, 1000);
      iModel.updateProjectExtents(projectExtents);

      // Insert RepositoryModel structure
      const subjectId = Subject.insert(iModel, IModel.rootSubjectId, "Subject", "Subject Description");
      const definitionModelId = DefinitionModel.insert(iModel, subjectId, "Definition");
      const physicalModelId = PhysicalModel.insert(iModel, subjectId, "Physical");

      // Insert definitions
      const spatialCategoryId = TestIModelWriter.insertSpatialCategory(iModel, definitionModelId, "SpatialCategory", ColorDef.green);
      const subCategoryId = SubCategory.insert(iModel, spatialCategoryId, "SubCategory", { color: ColorDef.blue.toJSON() });
      const renderMaterialId = RenderMaterialElement.insert(iModel, definitionModelId, "RenderMaterial", new RenderMaterialElement.Params("PaletteName"));

      // Insert physical object
      const geometryPartId = TestIModelWriter.insertGeometryPart(iModel, definitionModelId);
      TestIModelWriter.insertPhysicalObject(iModel, physicalModelId, spatialCategoryId, subCategoryId, renderMaterialId, geometryPartId);

      iModel.saveChanges();

      // Push changes
      await iModel.pushChanges({ description: "Some changes" });

      // Validate that the token did refresh before the push
    } finally {
      if (iModel !== undefined)
        iModel.close();
      await BriefcaseManager.deleteBriefcaseFiles(briefcaseProps.fileName, accessToken);
    }
  });

});
