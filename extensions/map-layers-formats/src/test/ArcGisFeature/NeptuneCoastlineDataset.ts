/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */
export class NeptuneCoastlineDataset {

  public static singlePolyJson = {
    objectIdFieldName: "OBJECTID",
    uniqueIdField: {
      name: "OBJECTID",
      isSystemMaintained: true,
    },
    globalIdFieldName: "",
    geometryProperties: {
      shapeAreaFieldName: "Shape__Area",
      shapeLengthFieldName: "Shape__Length",
    },
    geometryType: "esriGeometryPolygon",
    spatialReference: {
      wkid: 102100,
      latestWkid: 3857,
    },
    fields: [
      {
        name: "LU_2014",
        type: "esriFieldTypeString",
        alias: "2014 Land Use",
        sqlType: "sqlTypeOther",
        length: 100,
        domain: null,
        defaultValue: null,
      },
    ],
    features: [
      {
        attributes: {
          LU_2014: "Open Countryside",
        },
        geometry: {
          rings: [
            [
              [
                -154642,
                6581950,
              ],
              [
                -154699,
                6581951,
              ],
              [
                -154742,
                6581980,
              ],
              [
                -154848,
                6582105,
              ],
              [
                -154853,
                6582188,
              ],
              [
                -154800,
                6582227,
              ],
              [
                -154733,
                6582263,
              ],
              [
                -154442,
                6582348,
              ],
              [
                -154053,
                6582557,
              ],
              [
                -153772,
                6582607,
              ],
              [
                -153454,
                6582716,
              ],
              [
                -153400,
                6582694,
              ],
              [
                -153392,
                6582674,
              ],
              [
                -153573,
                6582606,
              ],
              [
                -153953,
                6582528,
              ],
              [
                -154342,
                6582318,
              ],
              [
                -154633,
                6582234,
              ],
              [
                -154701,
                6582197,
              ],
              [
                -154753,
                6582159,
              ],
              [
                -154758,
                6582100,
              ],
              [
                -154642,
                6581950,
              ],
            ],
          ],
        },
      },
    ],
  };

  // Note: I updated manually the attributes, to all 'values' to undefined (except for string_value),
  // otherwise the PBF reader would be confused.  I assume this a bug when the response get serialized as JSON.
  public static singlePolyPbf  = {
    version: "",
    queryResult: {
      featureResult: {
        objectIdFieldName: "OBJECTID",
        uniqueIdField: {
          name: "OBJECTID",
          isSystemMaintained: true,
        },
        globalIdFieldName: "",
        geohashFieldName: "",
        geometryProperties: {
          shapeAreaFieldName: "Shape__Area",
          shapeLengthFieldName: "Shape__Length",
          units: "",
        },
        geometryType: 3,
        spatialReference: {
          wkid: 102100,
          lastestWkid: 3857,
          vcsWkid: 0,
          latestVcsWkid: 0,
          wkt: "",
        },
        exceededTransferLimit: false,
        hasZ: false,
        hasM: false,
        transform: {
          quantizeOriginPostion: 0,
          scale: {
            xScale: 9.554628534322546,
            yScale: 9.554628534322546,
            mScale: 0,
            zScale: 0,
          },
          translate: {
            xTranslate: -825425.1849728118,
            yTranslate: 7520884.856089948,
            mTranslate: 0,
            zTranslate: 0,
          },
        },
        fields: [
          {
            name: "LU_2014",
            fieldType: 4,
            alias: "2014 Land Use",
            sqlType: 0,
            domain: "",
            defaultValue: "",
          },
        ],
        values: [],
        features: [
          {
            attributes: [
              {
                string_value: "Open Countryside",
                float_value: undefined,
                double_value: undefined,
                sint_value: undefined,
                uint_value: undefined,
                int64_value: undefined,
                uint64_value: undefined,
                sint64_value: undefined,
                bool_value: undefined,
              },
            ],
            geometry: {
              lengths: [
                21,
              ],
              coords: [
                70205,
                98270,
                -6,
                0,
                -4,
                -3,
                -12,
                -13,
                0,
                -9,
                5,
                -4,
                8,
                -4,
                30,
                -8,
                41,
                -22,
                29,
                -6,
                33,
                -11,
                6,
                2,
                1,
                2,
                -19,
                7,
                -40,
                9,
                -41,
                22,
                -30,
                8,
                -7,
                4,
                -6,
                4,
                0,
                6,
                12,
                16,
              ],
            },
          },
        ],
      },
    },
  };

  public static uniqueValueSFSDrawingInfo = {
    drawingInfo: {
      renderer: {
        type: "uniqueValue",
        field1: "LU_2014",
        field2: null,
        field3: null,
        fieldDelimiter: ", ",
        defaultSymbol: null,
        defaultLabel: null,
        uniqueValueInfos: [
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                0,
                0,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Lost To Sea Since 1965",
            label: "Lost To Sea Since 1965",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                104,
                104,
                104,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Urban/Built-up",
            label: "Urban/Built-up",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                115,
                76,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Shacks",
            label: "Shacks",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                230,
                0,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Industry",
            label: "Industry",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                230,
                0,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Wasteland",
            label: "Wasteland",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSBackwardDiagonal",
              color: [
                0,
                112,
                255,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Caravans",
            label: "Caravans",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSBackwardDiagonal",
              color: [
                230,
                152,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Defence",
            label: "Defence",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                230,
                152,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Transport",
            label: "Transport",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                255,
                255,
                115,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Open Countryside",
            label: "Open Countryside",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                38,
                115,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Woodland",
            label: "Woodland",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                85,
                255,
                0,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Managed Recreation/Sport",
            label: "Managed Recreation/Sport",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                0,
                112,
                255,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Amenity Water",
            label: "Amenity Water",
            description: "",
          },
          {
            symbol: {
              type: "esriSFS",
              style: "esriSFSSolid",
              color: [
                0,
                38,
                115,
                255,
              ],
              outline: {
                type: "esriSLS",
                style: "esriSLSSolid",
                color: [
                  0,
                  0,
                  0,
                  255,
                ],
                width: 0.4,
              },
            },
            value: "Inland Water",
            label: "Inland Water",
            description: "",
          },
        ],
      },
      transparency: 30,
      labelingInfo: null,
    },
  };

  public static uniqueValueSLSDrawingInfo = {
    drawingInfo: {
      renderer: {
        type: "uniqueValue",
        field1: "LU_2014",
        field2: null,
        field3: null,
        fieldDelimiter: ", ",
        defaultSymbol: null,
        defaultLabel: null,
        uniqueValueInfos: [
          {
            symbol: {
              type: "esriSLS",
              style: "esriSLSSolid",
              color: [
                0,
                255,
                0,
                255,
              ],
              width: 0.4,
            },
            value: "Lost To Sea Since 1965",
            label: "Lost To Sea Since 1965",
            description: "",
          },
          {
            symbol: {
              type: "esriSLS",
              style: "esriSLSSolid",
              color: [
                0,
                150,
                150,
                255,
              ],
              width: 0.4,
            },
            value: "Urban/Built-up",
            label: "Urban/Built-up",
            description: "",
          },

        ],
      },
      transparency: 30,
      labelingInfo: null,
    },
  };

}
