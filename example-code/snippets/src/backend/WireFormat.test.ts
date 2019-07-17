/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Id64, OpenMode } from "@bentley/bentleyjs-core";
import { Arc3d, Point3d, AngleSweep, Angle, LineString3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { ElementProps, GeometricElement3dProps, GeometryStreamBuilder, IModel, ModelProps, Placement3dProps, Code } from "@bentley/imodeljs-common";
import { IModelDb } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";

/**
 * Example code organized as tests to make sure that it builds and runs successfully.
 * > Note: these snippets get included by `docs/learning/WireFormat.md`
 */
describe("Wire Format Snippets", () => {
  let iModel: IModelDb;

  before(() => {
    iModel = IModelTestUtils.openIModel("test.bim", { copyFilename: "wire-format.bim", openMode: OpenMode.ReadWrite });
  });

  after(() => {
    iModel.closeStandalone();
  });

  it("Root Subject", () => {
    // __PUBLISH_EXTRACT_START__ WireFormat_RootSubject.code
    const elementProps = iModel.elements.getElementProps(IModel.rootSubjectId) as ElementProps;
    const json = JSON.stringify(elementProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(elementProps);

    /* tslint:disable */
    const expectedProps =
    // __PUBLISH_EXTRACT_START__ WireFormat_RootSubject.json
    {
      "classFullName": "BisCore:Subject",
      "code": {
        "scope": "0x1",
        "spec": "0x1f",
        "value": "DgnDbTestUtils"
      },
      "description": "",
      "id": "0x1",
      "model": "0x1"
    }
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */

    expect(JSON.parse(json)).deep.eq(expectedProps);
  });

  it("RepositoryModel", () => {
    // __PUBLISH_EXTRACT_START__ WireFormat_RepositoryModel.code
    const modelProps = iModel.models.getModel(IModel.repositoryModelId) as ModelProps;
    const json = JSON.stringify(modelProps, undefined, 2);
    // __PUBLISH_EXTRACT_END__
    assert.isDefined(modelProps);

    /* tslint:disable */
    const expectedProps =
    // __PUBLISH_EXTRACT_START__ WireFormat_RepositoryModel.json
    {
      "classFullName": "BisCore:RepositoryModel",
      "id": "0x1",
      "isPrivate": false,
      "isTemplate": false,
      "jsonProperties": {},
      "modeledElement": {
        "id": "0x1",
        "relClassName": "BisCore:ModelModelsElement",
      },
      "parentModel": "0x1",
      "name": "DgnDbTestUtils"
    }
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */

    expect(JSON.parse(json)).deep.eq(expectedProps);
  });

  it("GeometricElement3d", () => {
    const modelId = Id64.invalid;
    const categoryId = Id64.invalid;
    // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d.code
    // Construct an Arc3d (local coordinates)
    const center = new Point3d(0, 0, 0);
    const radius = 1;
    const sweep: AngleSweep = AngleSweep.createStartEnd(Angle.createDegrees(90), Angle.createDegrees(180));
    const arc: Arc3d = Arc3d.createXY(center, radius, sweep);
    const arcJson: string = JSON.stringify(arc, undefined, 2);

    // Construct a LineString3d (local coordinates)
    const points: Point3d[] = [
      new Point3d(0, 0, 0),
      new Point3d(1, 2, 0),
      new Point3d(1, 2, 4),
    ];
    const lineString: LineString3d = LineString3d.createPoints(points);
    const lineStringJson: string = JSON.stringify(lineString, undefined, 2);

    // Construct a GeometryStream containing the Arc3d and LineString3d created above (local coordinates)
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(arc);
    builder.appendGeometry(lineString);
    const geometryStreamJson: string = JSON.stringify(builder.geometryStream, undefined, 2);

    // Construct a Placement (world coordinates)
    const origin = new Point3d(100, 100, 0);
    const angles = YawPitchRollAngles.createDegrees(0, 90, 0);
    const placement: Placement3dProps = { origin, angles };
    const placementJson: string = JSON.stringify(placement, undefined, 2);

    // Construct a GeometricElement3d using the GeometryStream and Placement created above
    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      placement,
      geom: builder.geometryStream,
    };
    const elementPropsJson: string = JSON.stringify(elementProps, undefined, 2);

    // __PUBLISH_EXTRACT_END__

    /* tslint:disable */
    const expectedArcJson =
    // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d_Arc.json
    {
      "center": [
        0,
        0,
        0
      ],
      "sweep": [
        90,
        180
      ],
      "vector0": [
        1,
        0,
        0
      ],
      "vector90": [
        0,
        1,
        0
      ]
    }
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */
    expect(JSON.parse(arcJson)).deep.eq(expectedArcJson);

    /* tslint:disable */
    const expectedLineStringJson =
      // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d_LineString.json

      [
        [
          0,
          0,
          0
        ],
        [
          1,
          2,
          0
        ],
        [
          1,
          2,
          4
        ]
      ]
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */
    expect(JSON.parse(lineStringJson)).deep.eq(expectedLineStringJson);

    /* tslint:disable */
    const expectedGeomStreamJson =
      // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d_GeometryStream.json
      [
        {
          "arc": {
            "center": [
              0,
              0,
              0
            ],
            "vectorX": [
              1,
              0,
              0
            ],
            "vectorY": [
              0,
              1,
              0
            ],
            "sweepStartEnd": [
              90,
              180
            ]
          }
        },
        {
          "lineString": [
            [
              0,
              0,
              0
            ],
            [
              1,
              2,
              0
            ],
            [
              1,
              2,
              4
            ]
          ]
        }
      ]
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */
    expect(JSON.parse(geometryStreamJson)).deep.eq(expectedGeomStreamJson);

    /* tslint:disable */
    const expectedPlacementJson =
    // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d_Placement.json
    {
      "origin": [
        100,
        100,
        0
      ],
      "angles": {
        "pitch": 90
      }
    }
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */
    expect(JSON.parse(placementJson)).deep.eq(expectedPlacementJson);

    /* tslint:disable */
    const expectedElementJson =
    // __PUBLISH_EXTRACT_START__ WireFormat_GeometricElement3d_Element.json
    {
      "classFullName": "Generic:PhysicalObject",
      "model": "0",
      "code": {
        "spec": "0x1",
        "scope": "0x1",
        "value": ""
      },
      "category": "0",
      "placement": {
        "origin": [
          100,
          100,
          0
        ],
        "angles": {
          "pitch": 90
        }
      },
      "geom": [
        {
          "arc": {
            "center": [
              0,
              0,
              0
            ],
            "vectorX": [
              1,
              0,
              0
            ],
            "vectorY": [
              0,
              1,
              0
            ],
            "sweepStartEnd": [
              90,
              180
            ]
          }
        },
        {
          "lineString": [
            [
              0,
              0,
              0
            ],
            [
              1,
              2,
              0
            ],
            [
              1,
              2,
              4
            ]
          ]
        }
      ]
    }
      // __PUBLISH_EXTRACT_END__
      ;
    /* tslint:enable */
    expect(JSON.parse(elementPropsJson)).deep.eq(expectedElementJson);
  });

});
