/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export class PhillyLandmarksDataset {

  // This is the output of a 'Query' request for a point over the philly airport, result is in PDF (64-based encoded arrayBuffer)
  public static phillyAirportGetFeatureInfoQueryPbf = "encoding=base64;Er4GCrsGCgNGSUQSBwoDRklEEAEaCEdsb2JhbElEMggI7dQlEM/PKjgDQgcI1J0GEJEeYigSEgkAqHBF+BsjQBEAqHBF+BsjQBoSCRSuKRKK91/BEY3CM4VRflJBagwKA0ZJRBAGGgNGSURqFAoIT0JKRUNUSUQaCE9CSkVDVElEag4KBE5BTUUQBBoETkFNRWoUCgdBRERSRVNTEAQaB0FERFJFU1NqGAoJRkVBVF9UWVBFEAQaCUZFQVRfVFlQRWoWCghTVUJfVFlQRRAEGghTVUJfVFlQRWoaCgpWQU5JVFlfTkFNEAQaClZBTklUWV9OQU1qGgoKU0VDT05EQVJZXxAEGgpTRUNPTkRBUllfag4KBEJMREcQBBoEQkxER2oaCgpQQVJFTlRfTkFNEAQaClBBUkVOVF9OQU1qGgoKUEFSRU5UX1RZUBAEGgpQQVJFTlRfVFlQahQKB0FDUkVBR0UQAxoHQUNSRUFHRWoaCgpQQVJFTlRfQUNSEAMaClBBUkVOVF9BQ1JqGgoKU2hhcGVfX0FyZRADGgpTaGFwZV9fQXJlahoKClNoYXBlX19MZW4QAxoKU2hhcGVfX0xlbmocCgtTaGFwZV9fQXJlYRADGgtTaGFwZV9fQXJlYWogCg1TaGFwZV9fTGVuZ3RoEAMaDVNoYXBlX19MZW5ndGhqKwoIR2xvYmFsSUQQCxoIR2xvYmFsSUQyE05FV0lEKCkgV0lUSCBWQUxVRVN6jgIKAyjfOAoDILxxCiQKIlBoaWxhZGVscGhpYSBJbnRlcm5hdGlvbmFsIEFpcnBvcnQKFAoSODUwMCBFU1NJTkdUT04gQVZFChAKDkFpcnBvcnQgR3JvdW5kCgMKASAKAwoBIAoDCgEgCgMKAU4KJAoiUGhpbGFkZWxwaGlhIEludGVybmF0aW9uYWwgQWlycG9ydAoQCg5BaXJwb3J0IEdyb3VuZAoJGeDvet1otKBACgkZD3T+N0wMokAKCRn9T3m5zTSWQQoJGdwnoJEWcABBCgkZAAAACZsNbEEKCRks5ZMvzB/qQAomCiQ5ZmZjODk1Yi02NGQxLTRiNDItOTU3Ny1jMTZjNjU0ZDk0Yzc=";
  public static phillyAirportGetFeatureInfoQueryJson = `{"objectIdFieldName":"FID","uniqueIdField":{"name":"FID","isSystemMaintained":true},"globalIdFieldName":"GlobalID","geometryProperties":{"shapeAreaFieldName":"Shape__Area","shapeLengthFieldName":"Shape__Length","units":"esriMeters"},"serverGens":{"minServerGen":617069,"serverGen":698323},"geometryType":"esriGeometryPolygon","spatialReference":{"wkid":102100,"latestWkid":3857},"transform":{"originPosition":"upperLeft","scale":[4.7773142671503592,4.7773142671503592],"translate":[-8377498.2988891602,4847942.0812841775]},"fields":[{"name":"FID","type":"esriFieldTypeOID","alias":"FID","sqlType":"sqlTypeInteger","domain":null,"defaultValue":null},{"name":"OBJECTID","type":"esriFieldTypeSmallInteger","alias":"OBJECTID","sqlType":"sqlTypeSmallInt","domain":null,"defaultValue":null},{"name":"NAME","type":"esriFieldTypeString","alias":"NAME","sqlType":"sqlTypeNVarchar","length":110,"domain":null,"defaultValue":null},{"name":"ADDRESS","type":"esriFieldTypeString","alias":"ADDRESS","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"FEAT_TYPE","type":"esriFieldTypeString","alias":"FEAT_TYPE","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"SUB_TYPE","type":"esriFieldTypeString","alias":"SUB_TYPE","sqlType":"sqlTypeNVarchar","length":31,"domain":null,"defaultValue":null},{"name":"VANITY_NAM","type":"esriFieldTypeString","alias":"VANITY_NAM","sqlType":"sqlTypeNVarchar","length":47,"domain":null,"defaultValue":null},{"name":"SECONDARY_","type":"esriFieldTypeString","alias":"SECONDARY_","sqlType":"sqlTypeNVarchar","length":67,"domain":null,"defaultValue":null},{"name":"BLDG","type":"esriFieldTypeString","alias":"BLDG","sqlType":"sqlTypeNVarchar","length":1,"domain":null,"defaultValue":null},{"name":"PARENT_NAM","type":"esriFieldTypeString","alias":"PARENT_NAM","sqlType":"sqlTypeNVarchar","length":63,"domain":null,"defaultValue":null},{"name":"PARENT_TYP","type":"esriFieldTypeString","alias":"PARENT_TYP","sqlType":"sqlTypeNVarchar","length":25,"domain":null,"defaultValue":null},{"name":"ACREAGE","type":"esriFieldTypeDouble","alias":"ACREAGE","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"PARENT_ACR","type":"esriFieldTypeDouble","alias":"PARENT_ACR","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Are","type":"esriFieldTypeDouble","alias":"Shape__Are","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Len","type":"esriFieldTypeDouble","alias":"Shape__Len","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Area","type":"esriFieldTypeDouble","alias":"Shape__Area","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"Shape__Length","type":"esriFieldTypeDouble","alias":"Shape__Length","sqlType":"sqlTypeFloat","domain":null,"defaultValue":null},{"name":"GlobalID","type":"esriFieldTypeGlobalID","alias":"GlobalID","sqlType":"sqlTypeOther","length":38,"domain":null}],"features":[{"attributes":{"FID":7263,"OBJECTID":7262,"NAME":"Philadelphia International Airport","ADDRESS":"8500 ESSINGTON AVE","FEAT_TYPE":"Airport Ground","SUB_TYPE":" ","VANITY_NAM":" ","SECONDARY_":" ","BLDG":"N","PARENT_NAM":"Philadelphia International Airport","PARENT_TYP":"Airport Ground","ACREAGE":2138.20481476,"PARENT_ACR":2310.1488647,"Shape__Are":93139822.3684692,"Shape__Len":134658.821106254,"Shape__Area":14707928.28125,"Shape__Length":53502.3808078266,"GlobalID":"9ffc895b-64d1-4b42-9577-c16c654d94c7"}}]}`;

  // This is the resulting  serializaed  MapLayerFeatureInfo objects (i.e expected result)
  public static phillyAirportGetFeatureInfoResultRef = [
    {
      layerName: "dummyFeatureLayer",
      info: [
        {
          subLayerName: "SampleLayer",
          displayFieldName: "SampleLayer",
          records: [
            {
              value: {valueFormat: 0, value: 7263, displayValue: "7263"},
              property: {name: "FID", displayLabel: "FID", typename: "integer"},
            },
            {
              value: {valueFormat: 0, value: 7262, displayValue: "7262"},
              property: {name: "OBJECTID", displayLabel: "OBJECTID", typename: "integer"},
            },
            {
              value: {
                valueFormat: 0,
                value: "Philadelphia International Airport",
                displayValue: "Philadelphia International Airport",
              },
              property: {name: "NAME", displayLabel: "NAME", typename: "string"},
            },
            {
              value: {
                valueFormat: 0,
                value: "8500 ESSINGTON AVE",
                displayValue: "8500 ESSINGTON AVE",
              },
              property: {name: "ADDRESS", displayLabel: "ADDRESS", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: "Airport Ground", displayValue: "Airport Ground"},
              property: {name: "FEAT_TYPE", displayLabel: "FEAT_TYPE", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: " ", displayValue: " "},
              property: {name: "SUB_TYPE", displayLabel: "SUB_TYPE", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: " ", displayValue: " "},
              property: {name: "VANITY_NAM", displayLabel: "VANITY_NAM", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: " ", displayValue: " "},
              property: {name: "SECONDARY_", displayLabel: "SECONDARY_", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: "N", displayValue: "N"},
              property: {name: "BLDG", displayLabel: "BLDG", typename: "string"},
            },
            {
              value: {
                valueFormat: 0,
                value: "Philadelphia International Airport",
                displayValue: "Philadelphia International Airport",
              },
              property: {name: "PARENT_NAM", displayLabel: "PARENT_NAM", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: "Airport Ground", displayValue: "Airport Ground"},
              property: {name: "PARENT_TYP", displayLabel: "PARENT_TYP", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: 2138.20481476, displayValue: "2138.20481476"},
              property: {name: "ACREAGE", displayLabel: "ACREAGE", typename: "double"},
            },
            {
              value: {valueFormat: 0, value: 2310.1488647, displayValue: "2310.1488647"},
              property: {name: "PARENT_ACR", displayLabel: "PARENT_ACR", typename: "double"},
            },
            {
              value: {
                valueFormat: 0,
                value: 93139822.3684692,
                displayValue: "93139822.3684692",
              },
              property: {name: "Shape__Are", displayLabel: "Shape__Are", typename: "double"},
            },
            {
              value: {valueFormat: 0, value: 134658.82110625, displayValue: "134658.82110625"},
              property: {name: "Shape__Len", displayLabel: "Shape__Len", typename: "double"},
            },
            {
              value: {valueFormat: 0, value: 14707928.28125, displayValue: "14707928.28125"},
              property: {name: "Shape__Area", displayLabel: "Shape__Area", typename: "double"},
            },
            {
              value: {valueFormat: 0, value: 53502.38080783, displayValue: "53502.38080783"},
              property: {name: "Shape__Length", displayLabel: "Shape__Length", typename: "double"},
            },
            {
              value: {
                valueFormat: 0,
                value: "9ffc895b-64d1-4b42-9577-c16c654d94c7",
                displayValue: "9ffc895b-64d1-4b42-9577-c16c654d94c7",
              },
              property: {name: "GlobalID", displayLabel: "GlobalID", typename: "string"},
            },
          ],
        },
      ],
    },
  ];

  public static fieldsCoverageGetFeatureInfoResultRef = [
    {
      layerName: "dummyFeatureLayer",
      info: [
        {
          subLayerName: "SampleLayer",
          displayFieldName: "SampleLayer",
          records: [
            {
              value: {valueFormat: 0, value: 1, displayValue: "1"},
              property: {
                name: "field_SmallInteger",
                displayLabel: "field_SmallInteger",
                typename: "integer",
              },
            },
            {
              value: {valueFormat: 0, value: 2, displayValue: "2"},
              property: {
                name: "field_Integer",
                displayLabel: "field_Integer",
                typename: "integer",
              },
            },
            {
              value: {valueFormat: 0, value: 3.1, displayValue: "3.1"},
              property: {name: "field_Single", displayLabel: "field_Single", typename: "float"},
            },
            {
              value: {valueFormat: 0, value: 4.1, displayValue: "4.1"},
              property: {name: "field_Double", displayLabel: "field_Double", typename: "double"},
            },
            {
              value: {valueFormat: 0, value: "field 5", displayValue: "field 5"},
              property: {name: "field_String", displayLabel: "field_String", typename: "string"},
            },
            {
              value: {valueFormat: 0, value: 6, displayValue: "6"},
              property: {name: "field_Date", displayLabel: "field_Date", typename: "integer"},
            },
            {
              value: {valueFormat: 0, value: true, displayValue: "true"},
              property: {name: "field_OID", displayLabel: "field_OID", typename: "bool"},
            },
            {
              value: {valueFormat: 0, value: 8, displayValue: "8"},
              property: {
                name: "field_Geometry",
                displayLabel: "field_Geometry",
                typename: "integer",
              },
            },
            {
              value: {valueFormat: 0, value: 9, displayValue: "9"},
              property: {name: "field_Raster", displayLabel: "field_Raster", typename: "integer"},
            },
          ],
        },
      ],
    },
  ];
  public static fieldsCoveragePbufferCollection =
  {
    version: "",
    queryResult:
     {
       featureResult:
        {
          objectIdFieldName: "FID",
          uniqueIdField:
           {
             name: "FID",
             isSystemMaintained: true,
           },
          globalIdFieldName: "GlobalID",
          geohashFieldName: "",
          serverGens:
           {
             minServerGen: 617069,
             serverGen: 698319,
           },
          geometryType: 3,
          spatialReference:
           {
             wkid: 102100,
             lastestWkid: 3857,
             vcsWkid: 0,
             latestVcsWkid: 0,
             wkt: "",
           },
          exceededTransferLimit: false,
          hasZ: false,
          hasM: false,
          transform:
           {
             quantizeOriginPostion: 0,
             scale:
              {
                xScale: 9.554628534318908,
                yScale: 9.554628534318908,
                mScale: 0,
                zScale: 0,
              },
             translate:
              {
                xTranslate: -8379944.283793945,
                yTranslate: 4847942.0812841775,
                mTranslate: 0,
                zTranslate: 0,
              },
           },
          fields: [
            {
              name: "field_SmallInteger",
              fieldType: 0,
              alias: "field_SmallInteger",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Integer",
              fieldType: 1,
              alias: "field_Integer",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Single",
              fieldType: 2,
              alias: "field_Single",
              sqlType: 7,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Double",
              fieldType: 3,
              alias: "field_Double",
              sqlType: 6,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_String",
              fieldType: 4,
              alias: "field_String",
              sqlType: 15,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Date",
              fieldType: 5,
              alias: "field_Date",
              sqlType: 4,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_OID",
              fieldType: 6,
              alias: "field_OID",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Geometry",
              fieldType: 7,
              alias: "field_Geometry",
              sqlType: 8,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field_Raster",
              fieldType: 8,
              alias: "field_Raster",
              sqlType: 0,
              domain: "",
              defaultValue: "",
            },
            {
              name: "field9",
              fieldType: 0,
              alias: "field9",
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
                  sint_value: 1,
                },
                {
                  int64_value: 2,
                },
                {
                  float_value: 3.1,
                },
                {
                  double_value: 4.1,
                },
                {
                  string_value: "field 5",
                },
                {
                  uint_value: 6,
                },
                {
                  bool_value: true,
                },
                {
                  uint64_value: 8,
                },
                {
                  sint64_value: 9,
                },
              ],
            },
          ],
        },
     },
  };

  public static polygonDrawingInfo = {drawingInfo:{renderer:{type:"simple",symbol:{type:"esriSFS",style:"esriSFSSolid",color:[76,129,205,191],outline:{type:"esriSLS",style:"esriSLSSolid",color:[0,0,0,255],width:0.75}}},transparency:0,labelingInfo:null}};
  public static lineDrawingInfo = {drawingInfo:{renderer:{type:"simple",symbol:{type:"esriSLS",style:"esriSLSSolid",color:[165,83,183,255],width:1}},transparency:0,labelingInfo:null} };
  public static pointDrawingInfo = {drawingInfo:{renderer:{type:"simple",symbol:{type:"esriPMS",url:"RedSphere.png",imageData:"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",contentType:"image/png",width:15,height:15}}} };

}

