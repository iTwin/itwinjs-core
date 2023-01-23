/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */

export class ArcGISMapLayerDataset {

  public static readonly TilesOnlyDataset26918: any = {
    id: "ae830ad7b2a39acf",
    name: "Philadelphia2",
    capabilities: "Map,TilesOnly,Tilemap",
    description: "",
    serviceDescription: "",
    server: "nZ2Vb4CUwdo9AIiQ",
    type: "MapServer",
    access: "SECURE",
    status: "created",
    singleFusedMapCache: true,
    spatialReference:
  {
    wkid: 26918,
    latestWkid: 26918,
  },
    initialExtent:
  {
    xmin: 442494.57455522625,
    ymin: 4410580.203758644,
    xmax: 536978.6719738642,
    ymax: 4444183.334639749,
    spatialReference:
     {
       wkid: 26918,
       latestWkid: 26918,
     },
  },
    fullExtent:
  {
    xmin: 475778.10840000026,
    ymin: 4412107.618799999,
    xmax: 503695.13810000004,
    ymax: 4442655.9196,
    spatialReference:
     {
       wkid: 26918,
       latestWkid: 26918,
     },
  },
    minScale: 1.47914382E8,
    maxScale: 5842.0,
    minLOD: 0,
    maxLOD: 4,
    tileInfo:
  {
    rows: 256,
    cols: 256,
    dpi: 96,
    format: "PNG",
    compressionQuality: 0,
    storageFormat: "esriMapCacheStorageModeCompactV2",
    origin:
     {
       x: -5120900.0,
       y: 9998100.0,
     },
    spatialReference:
     {
       wkid: 26918,
       latestWkid: 26918,
     },
    lods: [
      {
        level: 0,
        resolution: 66.1459656252646,
        scale: 250000.0,
      },
      {
        level: 1,
        resolution: 33.0729828126323,
        scale: 125000.0,
      },
      {
        level: 2,
        resolution: 16.933367200067735,
        scale: 64000.0,
      },
      {
        level: 3,
        resolution: 8.466683600033868,
        scale: 32000.0,
      },
      {
        level: 4,
        resolution: 4.233341800016934,
        scale: 16000.0,
      },
    ],
  },
    documentInfo:
  {
    title: "Philadelphia2",
    author: "mcayerbentley",
    comments: "",
    subject: "landmarks2",
    category: "",
    keywords: "philly",
    credits: "",
    Title: "",
    Author: "",
    Comments: "",
    Subject: "landmarks",
    Category: "",
    AntialiasingMode: "Best",
    TextAntialiasingMode: "Force",
    Keywords: "philly",
  },
    copyrightText: "",
    tileServers: null,
    maxExportTilesCount: 100000,
    exportTilesAllowed: false,
    serviceItemId: "8d07f16c3861444e9d5af5835d5e9932",
    mapName: "Layers",
    units: "esriMeters",
    supportedImageFormatTypes: "PNG",
    layers: [
      {
        id: 0,
        name: "CityLandmarks26918",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
      },
    ],
    tables: [],
    resampling: false,
    currentVersion: 10.81,
  };

  public static readonly UsaTopoMaps: any = {
    currentVersion: 10.91,
    serviceDescription: "This map presents land cover imagery for the world and detailed topographic maps for the United States. The map includes the National Park Service (NPS) Natural Earth physical map at 1.24km per pixel for the world at small scales, i-cubed eTOPO 1:250,000-scale maps for the contiguous United States at medium scales, and National Geographic TOPO! 1:100,000 and 1:24,000-scale maps (1:250,000 and 1:63,000 in Alaska) for the United States at large scales. The TOPO! maps are seamless, scanned images of United States Geological Survey (USGS) paper topographic maps. For more information on this map, including the terms of use, visit us <a href=\"http://goto.arcgisonline.com/maps/USA_Topo_Maps \" target=\"_new\" >online<\/a>.",
    mapName: "Layers",
    description: "This map presents land cover imagery for the world and detailed topographic maps for the United States. The map includes the National Park Service (NPS) Natural Earth physical map at 1.24km per pixel for the world at small scales, i-cubed eTOPO 1:250,000-scale maps for the contiguous United States at medium scales, and National Geographic TOPO! 1:100,000 and 1:24,000-scale maps (1:250,000 and 1:63,000 in Alaska) for the United States at large scales. The TOPO! maps are seamless, scanned images of United States Geological Survey (USGS) paper topographic maps. For more information on this map, including our terms of use, visit us online at http://goto.arcgisonline.com/maps/USA_Topo_Maps",
    copyrightText: "Copyright:© 2013 National Geographic Society, i-cubed",
    supportsDynamicLayers: false,
    layers: [
      {
        id: 0,
        name: "USA Topo Maps",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Feature Layer",
        geometryType: "esriGeometryPolygon",
      },
    ],
    tables: [],
    spatialReference: {
      wkid: 102100,
      latestWkid: 3857,
    },
    singleFusedMapCache: true,
    tileInfo: {
      rows: 256,
      cols: 256,
      dpi: 96,
      format: "JPEG",
      compressionQuality: 75,
      origin: {
        x: -2.0037508342787E7,
        y: 2.0037508342787E7,
      },
      spatialReference: {
        wkid: 102100,
        latestWkid: 3857,
      },
      lods: [
        {
          level: 0,
          resolution: 156543.03392800014,
          scale: 5.91657527591555E8,
        },
        {
          level: 1,
          resolution: 78271.51696399994,
          scale: 2.95828763795777E8,
        },
        {
          level: 2,
          resolution: 39135.75848200009,
          scale: 1.47914381897889E8,
        },
        {
          level: 3,
          resolution: 19567.87924099992,
          scale: 7.3957190948944E7,
        },
        {
          level: 4,
          resolution: 9783.93962049996,
          scale: 3.6978595474472E7,
        },
        {
          level: 5,
          resolution: 4891.96981024998,
          scale: 1.8489297737236E7,
        },
        {
          level: 6,
          resolution: 2445.98490512499,
          scale: 9244648.868618,
        },
        {
          level: 7,
          resolution: 1222.992452562495,
          scale: 4622324.434309,
        },
        {
          level: 8,
          resolution: 611.4962262813797,
          scale: 2311162.217155,
        },
        {
          level: 9,
          resolution: 305.74811314055756,
          scale: 1155581.108577,
        },
        {
          level: 10,
          resolution: 152.87405657041106,
          scale: 577790.554289,
        },
        {
          level: 11,
          resolution: 76.43702828507324,
          scale: 288895.277144,
        },
        {
          level: 12,
          resolution: 38.21851414253662,
          scale: 144447.638572,
        },
        {
          level: 13,
          resolution: 19.10925707126831,
          scale: 72223.819286,
        },
        {
          level: 14,
          resolution: 9.554628535634155,
          scale: 36111.909643,
        },
        {
          level: 15,
          resolution: 4.77731426794937,
          scale: 18055.954822,
        },
      ],
    },
    initialExtent: {
      xmin: -2.2616419794228204E7,
      ymin: -1.6445800995315768E7,
      xmax: 2.2616419794228204E7,
      ymax: 1.6445800995315745E7,
      spatialReference: {
        cs: "pcs",
        wkid: 102100,
      },
    },
    fullExtent: {
      xmin: -2.003750722959434E7,
      ymin: -1.997186888040859E7,
      xmax: 2.003750722959434E7,
      ymax: 1.9971868880408563E7,
      spatialReference: {
        cs: "pcs",
        wkid: 102100,
      },
    },
    minScale: 0,
    maxScale: 0,
    units: "esriMeters",
    supportedImageFormatTypes: "PNG32,PNG24,PNG,JPG,DIB,TIFF,EMF,PS,PDF,GIF,SVG,SVGZ,BMP",
    documentInfo: {
      Title: "USA Topographic Map",
      Author: "Esri",
      Comments: "",
      Subject: "topography, topographic, land cover, physical, TOPO!",
      Category: "imageryBaseMapsEarthCover (Imagery, basemaps, and land cover)",
      AntialiasingMode: "None",
      TextAntialiasingMode: "Force",
      Keywords: "World,Global,United States,2011",
    },
    capabilities: "Map,Tilemap",
    supportedQueryFormats: "JSON, geoJSON",
    exportTilesAllowed: false,
    referenceScale: 0,
    datumTransformations: [
      {
        geoTransforms: [
          {
            wkid: 108001,
            latestWkid: 1241,
            transformForward: true,
            name: "NAD_1927_To_NAD_1983_NADCON",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 108001,
            latestWkid: 1241,
            transformForward: false,
            name: "NAD_1927_To_NAD_1983_NADCON",
          },
        ],
      },
    ],
    supportsDatumTransformation: true,
    maxRecordCount: 1000,
    maxImageHeight: 4096,
    maxImageWidth: 4096,
    supportedExtensions: "KmlServer",
  };

  public static readonly Bedrock: any = {
    currentVersion: 10.81,
    cimVersion: "2.8.0",
    serviceDescription: "",
    mapName: "Map",
    description: "",
    copyrightText: "",
    supportsDynamicLayers: false,
    layers: [
      {
        id: 0,
        name: "Bedrock016_clip.tif",
        parentLayerId: -1,
        defaultVisibility: true,
        subLayerIds: null,
        minScale: 0,
        maxScale: 0,
        type: "Raster Layer",
        supportsDynamicLegends: true,
      },
    ],
    tables: [],
    spatialReference: {
      wkid: 32086,
      latestWkid: 32086,
      xyTolerance: 0.001,
      zTolerance: 0.001,
      mTolerance: 0.001,
      falseX: -5317900,
      falseY: -10001000,
      xyUnits: 10000,
      falseZ: -100000,
      zUnits: 10000,
      falseM: -100000,
      mUnits: 10000,
    },
    singleFusedMapCache: true,
    tileInfo: {
      rows: 256,
      cols: 256,
      dpi: 96,
      format: "Mixed",
      compressionQuality: 75,
      origin: {
        x: -9696086.854175339,
        y: 1.0000886854175339E7,
      },
      spatialReference: {
        wkid: 32086,
        latestWkid: 32086,
        xyTolerance: 0.001,
        zTolerance: 0.001,
        mTolerance: 0.001,
        falseX: -5317900,
        falseY: -10001000,
        xyUnits: 10000,
        falseZ: -100000,
        zUnits: 10000,
        falseM: -100000,
        mUnits: 10000,
      },
      lods: [
        {
          level: 0,
          resolution: 78131.92854824483,
          scale: 2.9530177719021666E8,
        },
        {
          level: 1,
          resolution: 39065.964274122416,
          scale: 1.4765088859510833E8,
        },
        {
          level: 2,
          resolution: 19532.982137061208,
          scale: 7.382544429755417E7,
        },
        {
          level: 3,
          resolution: 9766.491068530604,
          scale: 3.691272214877708E7,
        },
        {
          level: 4,
          resolution: 4883.245534265302,
          scale: 1.845636107438854E7,
        },
        {
          level: 5,
          resolution: 2441.622767132651,
          scale: 9228180.53719427,
        },
        {
          level: 6,
          resolution: 1220.8113835663255,
          scale: 4614090.268597135,
        },
        {
          level: 7,
          resolution: 610.4056917831628,
          scale: 2307045.1342985677,
        },
        {
          level: 8,
          resolution: 305.2028458915814,
          scale: 1153522.5671492838,
        },
        {
          level: 9,
          resolution: 152.6014229457907,
          scale: 576761.2835746419,
        },
        {
          level: 10,
          resolution: 76.30071147289534,
          scale: 288380.64178732096,
        },
        {
          level: 11,
          resolution: 38.15035573644767,
          scale: 144190.32089366048,
        },
        {
          level: 12,
          resolution: 19.075177868223836,
          scale: 72095.16044683024,
        },
        {
          level: 13,
          resolution: 9.537588934111918,
          scale: 36047.58022341512,
        },
        {
          level: 14,
          resolution: 4.768794467055959,
          scale: 18023.79011170756,
        },
        {
          level: 15,
          resolution: 2.3843972335279795,
          scale: 9011.89505585378,
        },
        {
          level: 16,
          resolution: 1.1921986167639897,
          scale: 4505.94752792689,
        },
        {
          level: 17,
          resolution: 0.5960993083819949,
          scale: 2252.973763963445,
        },
        {
          level: 18,
          resolution: 0.29804965419099744,
          scale: 1126.4868819817225,
        },
      ],
    },
    initialExtent: {
      xmin: -460972.46787990216,
      ymin: 4898088.0126949875,
      xmax: 1322497.2969845918,
      ymax: 7019413.703165269,
      spatialReference: {
        wkid: 32086,
        latestWkid: 32086,
        xyTolerance: 0.001,
        zTolerance: 0.001,
        mTolerance: 0.001,
        falseX: -5317900,
        falseY: -10001000,
        xyUnits: 10000,
        falseZ: -100000,
        zUnits: 10000,
        falseM: -100000,
        mUnits: 10000,
      },
    },
    fullExtent: {
      xmin: -297190.4337307452,
      ymin: 5043397.727913556,
      xmax: 1093797.1743538762,
      ymax: 6026328.086568641,
      spatialReference: {
        wkid: 32086,
        latestWkid: 32086,
        xyTolerance: 0.001,
        zTolerance: 0.001,
        mTolerance: 0.001,
        falseX: -5317900,
        falseY: -10001000,
        xyUnits: 10000,
        falseZ: -100000,
        zUnits: 10000,
        falseM: -100000,
        mUnits: 10000,
      },
    },
    units: "esriMeters",
    supportedImageFormatTypes: "PNG32,PNG24,PNG,JPG,DIB,TIFF,EMF,PS,PDF,GIF,SVG,SVGZ,BMP",
    documentInfo: {
      Title: "P:\\HATCH\\GIS_MTL\\Lily\\PRO\\Lily_366363.aprx",
      Author: "",
      Comments: "",
      Subject: "",
      Category: "",
      AntialiasingMode: "None",
      TextAntialiasingMode: "Force",
      Version: "2.8.0",
      Keywords: "",
    },
    supportedQueryFormats: "JSON, geoJSON, PBF",
    referenceScale: 0.0,
    datumTransformations: [
      {
        geoTransforms: [
          {
            wkid: 108190,
            latestWkid: 108190,
            transformForward: true,
            name: "WGS_1984_(ITRF00)_To_NAD_1983",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 108190,
            latestWkid: 108190,
            transformForward: false,
            name: "WGS_1984_(ITRF00)_To_NAD_1983",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8072,
            latestWkid: 1172,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_3",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8072,
            latestWkid: 1172,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_3",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 108190,
            latestWkid: 108190,
            transformForward: false,
            name: "WGS_1984_(ITRF00)_To_NAD_1983",
          },
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_13",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_13",
          },
          {
            wkid: 108190,
            latestWkid: 108190,
            transformForward: true,
            name: "WGS_1984_(ITRF00)_To_NAD_1983",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: true,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
          {
            wkid: 15851,
            latestWkid: 15851,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_79_CONUS",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 15851,
            latestWkid: 15851,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_79_CONUS",
          },
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: false,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: true,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_13",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_13",
          },
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: false,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: true,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_13",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_13",
          },
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: false,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: true,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: false,
            name: "NAD_1927_To_WGS_1984_13",
          },
        ],
      },
      {
        geoTransforms: [
          {
            wkid: 8082,
            latestWkid: 1182,
            transformForward: true,
            name: "NAD_1927_To_WGS_1984_13",
          },
          {
            wkid: 1946,
            latestWkid: 1946,
            transformForward: false,
            name: "NAD_1983_CSRS_To_WGS_1984_2",
          },
        ],
      },
    ],
    supportsDatumTransformation: true,
    floorAwareMapProperties: {
      defaultFloorFilterSettings: {isEnabled: true},
    },
    archivingInfo: {supportsHistoricMoment: false},
    supportsClipping: true,
    supportsSpatialFilter: true,
    supportsTimeRelation: true,
    supportsQueryDataElements: true,
    maxRecordCount: 1000,
    maxImageHeight: 4096,
    maxImageWidth: 4096,
    capabilities: "TilesOnly,Tilemap",
    minScale: 9228180.53719427,
    maxScale: 288380.64178732096,
    exportTilesAllowed: false,
    maxExportTilesCount: 100000,
    supportedExtensions: "",
    serviceItemId: "25c229f3e90c49beb6e6885b0f898a3a",
  };
}
