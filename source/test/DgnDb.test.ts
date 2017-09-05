/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { DgnDbToken, DgnDb } from "../dgnplatform/DgnDb";
import { DgnDbTestUtils } from "./DgnDbTestUtils";

describe("DgnDb", () => {

  it("should open an existing DgnDb", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    assert.isTrue(token !== undefined);
  });

  it("should produce an array of rows with executeQuery", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {result: allrowsdata} = await DgnDb.callExecuteQuery(token, "SELECT * FROM bis.Element");

    if (!allrowsdata) {
      assert(false);
      return;
    }

    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });

  it("should get a well-known element by ID", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {error, result: eldata} = await DgnDb.callGetElement(token, JSON.stringify({id: "0X1"}));
    assert.equal(undefined, error);
    if (undefined === eldata)
      assert.fail();
    else {
      assert.isNotNull(eldata);
      assert.isString(eldata);
    }
  });

  it("should get display properties", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {error, result: eldata} = await DgnDb.callGetElementPropertiesForDisplay(token,  "0X1");
    assert.equal(undefined, error);
    if (undefined === eldata)
      assert.fail();
    else {
      let input = JSON.parse(String(eldata));
      var output : any =
      { 
        'Descriptor': {
            'PreferredDisplayType': 'PropertyPane',
            'SelectClasses': [
                {
                    'SelectClassInfo': {
                        'Id': '206',
                        'Name': 'BisCore:Subject',
                        'Label': 'Subject'
                    },
                    'IsPolymorphic': false,
                    'PathToPrimaryClass': [ ],
                    'RelatedPropertyPaths': [ ]
                }
            ],
            'Fields': [
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_CodeValue',
                    'DisplayLabel': 'Code',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '63',
                                    'Name': 'BisCore:Element',
                                    'Label': 'Element'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'CodeValue',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                },
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_UserLabel',
                    'DisplayLabel': 'User Label',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '63',
                                    'Name': 'BisCore:Element',
                                    'Label': 'Element'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'UserLabel',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                },
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_Description',
                    'DisplayLabel': 'Description',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'Description',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                }
            ],
            'SortingFieldIndex': -1,
            'SortDirection': 0,
            'ContentFlags': 8,
            'FilterExpression': ''
        },
        'ContentSet': [
            {
                'DisplayLabel': '',
                'ImageId': '',
                'Values': {
                    'Subject_CodeValue': 'TBD',
                    'Subject_UserLabel': null,
                    'Subject_Description': ''
                },
                'DisplayValues': {
                    'Subject_CodeValue': 'TBD',
                    'Subject_UserLabel': null,
                    'Subject_Description': ''
                },
                'ClassInfo': {
                    'Id': '206',
                    'Name': 'BisCore:Subject',
                    'Label': 'Subject'
                },
                'PrimaryKeys': [
                    {
                        'ECClassId': '206',
                        'ECInstanceId': '1'
                    }
                ],
                'MergedFieldNames': [ ],
                'FieldValueKeys': {
                    'Subject_CodeValue': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ],
                    'Subject_Description': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ],
                    'Subject_UserLabel': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    };        
    assert.equal(JSON.stringify(input), JSON.stringify(output));
  }
  
  });
  
  function checkElementMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isNotNull(obj);
    assert.isString(obj.name);
    assert.equal(obj.name, "Element");
    assert.equal(obj.schema, "BisCore");
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);

    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    for (const ca of obj.customAttributes) {
      if (ca.ecclass.name === "ClassHasHandler")
        foundClassHasHandler = true;
      else if (ca.ecclass.name === "ClassHasCurrentTimeStampProperty")
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.properties.federationGuid);
    assert.isDefined(obj.properties.federationGuid.primitiveECProperty);
    assert.equal(obj.properties.federationGuid.primitiveECProperty.type, "binary");
    assert.equal(obj.properties.federationGuid.primitiveECProperty.extendedType, "BeGuid");
  }

  it("should get metadata for class (sync)", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {error, result: metadataStr} = DgnDb.callGetECClassMetaDataSync(token, "BisCore", "Element");
    assert.isUndefined(error);
    assert.notEqual(undefined, metadataStr);
    if (undefined !== metadataStr)
      checkElementMetaData(metadataStr);
    });

  it("should get metadata for class (async)", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const { error, result: metadataStr } = await DgnDb.callGetECClassMetaData(token, "BisCore", "Element");
    assert.isUndefined(error);
    if (undefined === metadataStr)
      assert.fail();
    else
      checkElementMetaData(metadataStr);
  });

  function checkClassHasHandlerMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isDefined(obj.properties.restrictions);
    assert.isDefined(obj.properties.restrictions.primitiveArrayECProperty);
    assert.equal(obj.properties.restrictions.primitiveArrayECProperty.type, "string");
    assert.equal(obj.properties.restrictions.primitiveArrayECProperty.minOccurs, 0);
  }

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (sync)", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {error, result: metadataStr} = DgnDb.callGetECClassMetaDataSync(token, "BisCore", "ClassHasHandler");
    assert.isUndefined(error);
    if (undefined === metadataStr)
      assert.fail();
    else
      checkClassHasHandlerMetaData(metadataStr);
  });

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (async)", async () => {
    const token: DgnDbToken = await DgnDbTestUtils.openDgnDb("test.bim", true);
    const {error, result: metadataStr} = await DgnDb.callGetECClassMetaData(token, "BisCore", "ClassHasHandler");
    assert.isUndefined(error);
    if (undefined === metadataStr)
      assert.fail();
    else
      checkClassHasHandlerMetaData(metadataStr);
  });
});
