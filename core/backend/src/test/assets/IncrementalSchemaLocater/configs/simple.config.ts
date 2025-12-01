/* eslint-disable @typescript-eslint/naming-convention */
export default {
  "label": "Simple Profile iModel",
  "bimFile": "SimpleIModel.bim",
  "schemas": [
    {
      "name": "SimpleSchema",
      "description": "A simple test schema",
      "label": "Simple Schema",
      "references": [
        "BisCore",
        "CoreCustomAttributes",
        "Formats",
        "Units"
      ],
      "itemCount": 30,
      "checkStubs": [
        {
          "item": "SimpleSchema.UnitSystem_Test",
          "properties": {
            "schemaItemType": "UnitSystem",
            "label": "Test",
            "description": "UnitSystem Test"
          }
        },
        {
          "item": "SimpleSchema.Phenomenon_Test",
          "properties": {
            "schemaItemType": "Phenomenon",
            "label": "Test",
            "description": "Phenomenon Test",
            "definition": "u:NUMBER"
          }
        },
        {
          "item": "SimpleSchema.Category_Test",
          "properties": {
            "schemaItemType": "PropertyCategory",
            "label": "Test",
            "description": "PropertyCategory Test",
            "priority": 1000
          }
        },
        {
          "item": "SimpleSchema.Enumeration_Integer",
          "properties": {
            "schemaItemType": "Enumeration",
            "label": "Test",
            "description": "Enumeration Integer",
            "type": "int",
            "isStrict": true,
            "enumerators": [
              {
                "name": "Enumerator0",
                "value": 0,
                "label": "0",
                "description": "Enumerator 0"
              },
              {
                "name": "Enumerator1",
                "value": 1,
                "label": "1",
                "description": "Enumerator 1"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.Enumeration_String",
          "properties": {
            "schemaItemType": "Enumeration",
            "label": "Test",
            "description": "Enumeration String",
            "type": "string",
            "isStrict": false,
            "enumerators": [
              {
                "name": "Enumerator0",
                "value": "0"
              },
              {
                "name": "Enumerator1",
                "value": "1"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.Unit_Test1",
          "properties": {
            "schemaItemType": "Unit",
            "label": "Test1",
            "description": "Unit Test1",
            "phenomenon": "SimpleSchema.Phenomenon_Test",
            "unitSystem": "SimpleSchema.UnitSystem_Test",
            "definition": "u:ONE",
            "numerator": 10.0
          }
        },
        {
          "item": "SimpleSchema.Unit_Test2",
          "properties": {
            "schemaItemType": "Unit",
            "label": "Test2",
            "description": "Unit Test2",
            "phenomenon": "Units.TEMPERATURE",
            "unitSystem": "Units.USCUSTOM",
            "definition": "u:ONE",
            "numerator": 5.0,
            "denominator": 3.0,
            "offset": 0.01325
          }
        },
        {
          "item": "SimpleSchema.InvertedUnit_Test1",
          "properties": {
            "schemaItemType": "InvertedUnit",
            "label": "Test1",
            "description": "InvertedUnit Test1",
            "invertsUnit": "SimpleSchema.Unit_Test1",
            "unitSystem": "SimpleSchema.UnitSystem_Test"
          }
        },
        {
          "item": "SimpleSchema.InvertedUnit_Test2",
          "properties": {
            "schemaItemType": "InvertedUnit",
            "label": "Test2",
            "description": "InvertedUnit Test2",
            "invertsUnit": "Units.FT_PER_FT",
            "unitSystem": "Units.USCUSTOM"
          }
        },
        {
          "item": "SimpleSchema.Constant_Test1",
          "properties": {
            "schemaItemType": "Constant",
            "label": "Test1",
            "description": "Constant Test1",
            "phenomenon": "SimpleSchema.Phenomenon_Test",
            "definition": "Unit_Test1",
            "numerator": 1.0e3
          }
        },
        {
          "item": "SimpleSchema.Constant_Test2",
          "properties": {
            "schemaItemType": "Constant",
            "label": "Test2",
            "description": "Constant Test2",
            "phenomenon": "Units.ANGLE",
            "definition": "Unit_Test2",
            "numerator": 180.0,
            "denominator": 0.5
          }
        },
        {
          "item": "SimpleSchema.Format_Station",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Station",
            "type": "Station",
            "precision": 2,
            "formatTraits": [
              "TrailZeroes",
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            "thousandSeparator": " ",
            "decimalSeparator": ",",
            "stationSeparator": "+",
            "stationOffsetSize": 3,
            "minWidth": 3
          }
        },
        {
          "item": "SimpleSchema.Format_Scientific",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Scientific",
            "type": "Scientific",
            "scientificType": "Normalized",
            "precision": 6,
            "formatTraits": [
              "KeepSingleZero"
            ],
            "decimalSeparator": ",",
            "thousandSeparator": " "
          }
        },
        {
          "item": "SimpleSchema.Format_Decimal",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Decimal",
            "type": "Decimal",
            "precision": 4,
            "showSignOption": "NoSign",
            "formatTraits": [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            "thousandSeparator": " ",
            "decimalSeparator": ",",
            "minWidth": 3,
            "roundFactor": 0.1
          }
        },
        {
          "item": "SimpleSchema.Format_Fractional",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Fractional",
            "type": "Fractional",
            "precision": 8,
            "formatTraits": [
              "KeepSingleZero",
              "ShowUnitLabel"
            ],
            "uomSeparator": ""
          }
        },
        {
          "item": "SimpleSchema.KindOfQuantity_Test1",
          "properties": {
            "schemaItemType": "KindOfQuantity",
            "label": "Test1",
            "description": "KindOfQuantity Test1"
          }
        },
        {
          "item": "SimpleSchema.KindOfQuantity_Test2",
          "properties": {
            "schemaItemType": "KindOfQuantity",
            "label": "Test2",
            "description": "KindOfQuantity Test2"
          }
        },
        {
          "item": "SimpleSchema.StructClass_Test1",
          "properties": {
            "schemaItemType": "StructClass",
            "modifier": "Abstract",
            "label": "Test1",
            "description": "StructClass Test1"
          }
        },
        {
          "item": "SimpleSchema.StructClass_Test2",
          "properties": {
            "schemaItemType": "StructClass",
            "modifier": "Sealed",
            "baseClass": "SimpleSchema.StructClass_Test1",
            "label": "Test2",
            "description": "StructClass Test2"
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test1",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "appliesTo": "AnyClass",
            "modifier": "Abstract",
            "label": "Test1",
            "description": "CustomAttributeClass Test1"
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test2",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "appliesTo": "AnyProperty",
            "baseClass": "BisCore.CustomHandledProperty",
            "label": "Test2",
            "description": "CustomAttributeClass Test2"
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test3",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "modifier": "Sealed",
            "appliesTo": "Any",
            "baseClass": "SimpleSchema.CustomAttributeClass_Test1",
            "label": "Test3",
            "description": "CustomAttributeClass Test3"
          }
        },
        {
          "item": "SimpleSchema.IMixin_Test1",
          "properties": {
            "schemaItemType": "Mixin",
            "appliesTo": "BisCore.Element",
            "label": "Test1",
            "description": "Mixin Test1"
          }
        },
        {
          "item": "SimpleSchema.IMixin_Test2",
          "properties": {
            "schemaItemType": "Mixin",
            "baseClass": "SimpleSchema.IMixin_Test1",
            "appliesTo": "BisCore.PhysicalElement",
            "label": "Test2",
            "description": "Mixin Test2"
          }
        },
        {
          "item": "SimpleSchema.EntityClass_Test1",
          "properties": {
            "schemaItemType": "EntityClass",
            "baseClass": "BisCore.PhysicalElement",
            "label": "Test1",
            "description": "EntityClass Test1",
            "mixins": [
              "SimpleSchema.IMixin_Test1"
            ]
          }
        },
        {
          "item": "SimpleSchema.EntityClass_Test2",
          "properties": {
            "schemaItemType": "EntityClass",
            "modifier": "Abstract",
            "baseClass": "SimpleSchema.EntityClass_Test1",
            "label": "Test2",
            "description": "EntityClass Test2",
            "mixins": [
              "SimpleSchema.IMixin_Test2"
            ]
          }
        },
        {
          "item": "SimpleSchema.EntityClass_Test3",
          "properties": {
            "schemaItemType": "EntityClass",
            "modifier": "Sealed",
            "baseClass": "SimpleSchema.EntityClass_Test2",
            "label": "Test3",
            "description": "EntityClass Test3"
          }
        },
        {
          "item": "SimpleSchema.EntityClass_Test3",
          "properties": {
            "schemaItemType": "EntityClass",
            "baseClass": "SimpleSchema.EntityClass_Test2",
            "label": "Test3",
            "description": "EntityClass Test3"
          }
        },
        {
          "item": "SimpleSchema.RelationshipClass_Test1",
          "properties": {
            "schemaItemType": "RelationshipClass",
            "modifier": "Sealed",
            "baseClass": "BisCore.ElementRefersToElements",
            "label": "Test1",
            "description": "RelationshipClass Test1",
            "strength": "Referencing",
            "strengthDirection": "Forward"
          }
        },
        {
          "item": "SimpleSchema.RelationshipClass_Test2",
          "properties": {
            "schemaItemType": "RelationshipClass",
            "modifier": "None",
            "baseClass": "BisCore.ModelModelsElement",
            "label": "Test2",
            "description": "RelationshipClass Test2",
            "strength": "Embedding",
            "strengthDirection": "Backward"
          }
        }
      ],
      "checkHierachy": {
        "derivedClass": "SimpleSchema.EntityClass_Test3",
        "baseClass": "SimpleSchema.IMixin_Test1"
      },
      "checkFullLoad": [
        {
          "item": "SimpleSchema.Format_Decimal",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Decimal",
            "type": "Decimal",
            "precision": 4,
            "showSignOption": "NoSign",
            "formatTraits": [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            "thousandSeparator": " ",
            "decimalSeparator": ",",
            "minWidth": 3,
            "roundFactor": 0.1,
            "composite": {
              "spacer": "",
              "includeZero": false,
              "units": [
                {
                  "name": "Units.G",
                  "label": "g"
                },
                {
                  "name": "Units.MG",
                  "label": "mg"
                }
              ]
            }
          }
        },
        {
          "item": "SimpleSchema.Format_Fractional",
          "properties": {
            "schemaItemType": "Format",
            "label": "Test",
            "description": "Format Fractional",
            "type": "Fractional",
            "precision": 8,
            "formatTraits": [
              "KeepSingleZero",
              "ShowUnitLabel"
            ],
            "uomSeparator": "",
            "composite": {
              "spacer": "",
              "units": [
                {
                  "name": "SimpleSchema.Unit_Test1",
                  "label": "test"
                }
              ]
            }
          }
        },
        {
          "item": "SimpleSchema.KindOfQuantity_Test1",
          "properties": {
            "schemaItemType": "KindOfQuantity",
            "label": "Test1",
            "description": "KindOfQuantity Test1",
            "relativeError": 0.001,
            "persistenceUnit": "SimpleSchema.Unit_Test1",
            "presentationUnits": [
              "SimpleSchema.Format_Fractional(4)[SimpleSchema.Unit_Test1]"
            ]
          }
        },
        {
          "item": "SimpleSchema.KindOfQuantity_Test2",
          "properties": {
            "schemaItemType": "KindOfQuantity",
            "label": "Test2",
            "description": "KindOfQuantity Test2",
            "relativeError": 0.0001,
            "persistenceUnit": "Units.MG",
            "presentationUnits": [
              "Formats.DefaultRealU[Units.MG]",
              "Formats.DefaultRealU(1)[Units.G]"
            ]
          }
        },
        {
          "item": "SimpleSchema.StructClass_Test1",
          "properties": {
            "schemaItemType": "StructClass",
            "modifier": "Abstract",
            "label": "Test1",
            "description": "StructClass Test1",
            "properties": [
              {
                "name": "DoubleProperty",
                "type": "PrimitiveProperty",
                "category": "SimpleSchema.Category_Test",
                "label": "Double",
                "description": "Double Property",
                "typeName": "double"
              },
              {
                "name": "Point3dProperty",
                "type": "PrimitiveProperty",
                "isReadOnly": true,
                "label": "Point3",
                "description": "Point3 Property",
                "typeName": "point3d",
                "customAttributes": [
                  {
                    "className": "CoreCustomAttributes.HiddenProperty"
                  },
                  {
                    "className": "BisCore.CustomHandledProperty"
                  }
                ]
              },
              {
                "name": "LongArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 0,
                "maxOccurs": 52,
                "label": "LongArray",
                "description": "LongArray Property",
                "typeName": "long"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.StructClass_Test2",
          "properties": {
            "schemaItemType": "StructClass",
            "modifier": "Sealed",
            "baseClass": "SimpleSchema.StructClass_Test1",
            "label": "Test2",
            "description": "StructClass Test2",
            "customAttributes": [
              {
                "className": "BisCore.ClassHasHandler"
              }
            ],
            "properties": [
              {
                "name": "DateTimeProperty",
                "type": "PrimitiveProperty",
                "kindOfQuantity": "SimpleSchema.KindOfQuantity_Test1",
                "label": "DateTime",
                "description": "DateTime Property",
                "typeName": "dateTime"
              },
              {
                "name": "BooleanProperty",
                "type": "PrimitiveProperty",
                "priority": 1001,
                "label": "Boolean",
                "description": "Boolean Property",
                "typeName": "boolean"
              },
              {
                "name": "StringEnumerationArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 0,
                "maxOccurs": 3,
                "label": "StringEnumerationArray",
                "description": "StringEnumerationArray Property",
                "typeName": "SimpleSchema.Enumeration_String"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test1",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "appliesTo": "AnyClass",
            "modifier": "Abstract",
            "label": "Test1",
            "description": "CustomAttributeClass Test1",
            "properties": [
              {
                "name": "StringProperty",
                "type": "PrimitiveProperty",
                "label": "String",
                "description": "String Property",
                "extendedTypeName": "Json",
                "minLength": 1,
                "maxLength": 150,
                "typeName": "string"
              },
              {
                "name": "StructProperty",
                "type": "StructProperty",
                "label": "Struct",
                "description": "Struct Property",
                "typeName": "SimpleSchema.StructClass_Test2"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test2",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "appliesTo": "AnyProperty",
            "baseClass": "BisCore.CustomHandledProperty",
            "label": "Test2",
            "description": "CustomAttributeClass Test2",
            "customAttributes": [
              {
                "className": "SimpleSchema.CustomAttributeClass_Test3"
              }
            ],
            "properties": [
              {
                "name": "BinaryProperty",
                "type": "PrimitiveProperty",
                "label": "Binary",
                "description": "Binary Property",
                "typeName": "binary"
              },
              {
                "name": "IntegerArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 0,
                "maxOccurs": 150,
                "maxValue": 1000,
                "label": "IntegerArray",
                "description": "IntegerArray Property",
                "typeName": "int"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.CustomAttributeClass_Test3",
          "properties": {
            "schemaItemType": "CustomAttributeClass",
            "modifier": "Sealed",
            "appliesTo": "Any",
            "baseClass": "SimpleSchema.CustomAttributeClass_Test1",
            "label": "Test3",
            "description": "CustomAttributeClass Test3",
            "properties": [
              {
                "name": "IntegerProperty",
                "type": "PrimitiveProperty",
                "minValue": 1,
                "maxValue": 101,
                "label": "Integer",
                "description": "Integer Property",
                "typeName": "int",
                "customAttributes": [
                  {
                    "className": "BisCore.AutoHandledProperty",
                    "StatementTypes": 3
                  }
                ]
              },
              {
                "name": "IntegerEnumerationArray",
                "type": "PrimitiveArrayProperty",
                "label": "IntegerEnumerationArray",
                "description": "IntegerEnumerationArray Property",
                "minOccurs": 0,
                "maxOccurs": 2147483647,
                "typeName": "BisCore.SectionType"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.IMixin_Test1",
          "properties": {
            "schemaItemType": "Mixin",
            "appliesTo": "BisCore.Element",
            "label": "Test1",
            "description": "Mixin Test1",
            "properties": [
              {
                "name": "LongProperty",
                "type": "PrimitiveProperty",
                "category": "SimpleSchema.Category_Test",
                "label": "Long",
                "description": "Long Property",
                "typeName": "long"
              },
              {
                "name": "BooleanArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 1,
                "maxOccurs": 5,
                "label": "BooleanArray",
                "description": "BooleanArray Property",
                "typeName": "boolean"
              }
            ],
            "customAttributes": [
              {
                "className": "SimpleSchema.CustomAttributeClass_Test3"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.IMixin_Test2",
          "properties": {
            "schemaItemType": "Mixin",
            "baseClass": "SimpleSchema.IMixin_Test1",
            "appliesTo": "BisCore.PhysicalElement",
            "label": "Test2",
            "description": "Mixin Test2",
            "properties": [
              {
                "name": "IGeometryProperty",
                "type": "PrimitiveProperty",
                "label": "IGeometry",
                "description": "IGeometry Property",
                "typeName": "Bentley.Geometry.Common.IGeometry",
                "customAttributes": [
                  {
                    "className": "CoreCustomAttributes.Deprecated",
                    "Description": "Deprecated renamed property."
                  },
                  {
                    "className": "CoreCustomAttributes.HiddenProperty"
                  }
                ]
              },
              {
                "name": "DoubleArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minValue": 0.1,
                "maxValue": 9.9,
                "maxOccurs": 10,
                "minOccurs": 2,
                "label": "DoubleArray",
                "description": "DoubleArray Property",
                "typeName": "double"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.EntityClass_Test3",
          "properties": {
            "schemaItemType": "EntityClass",
            "modifier": "Sealed",
            "baseClass": "SimpleSchema.EntityClass_Test2",
            "label": "Test3",
            "description": "EntityClass Test3",
            "properties": [
              {
                "name": "StringEnumerationProperty",
                "type": "PrimitiveProperty",
                "label": "StringEnumeration",
                "description": "StringEnumeration Property",
                "typeName": "CoreCustomAttributes.ProductionStatusValue"
              }
            ]
          }
        },
        {
          "item": "SimpleSchema.RelationshipClass_Test1",
          "properties": {
            "schemaItemType": "RelationshipClass",
            "modifier": "Sealed",
            "baseClass": "BisCore.ElementRefersToElements",
            "label": "Test1",
            "description": "RelationshipClass Test1",
            "strength": "Referencing",
            "strengthDirection": "Forward",
            "customAttributes": [
              {
                "className": "CoreCustomAttributes.HiddenClass",
                "Show": false
              }
            ],
            "properties": [
              {
                "name": "Point2dArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 5,
                "maxOccurs": 75,
                "label": "Point2dArray",
                "description": "Point2dArray Property",
                "typeName": "point2d"
              },
              {
                "name": "Point3dArrayProperty",
                "type": "PrimitiveArrayProperty",
                "minOccurs": 3,
                "maxOccurs": 13,
                "label": "Point3dArray",
                "description": "Point3dArray Property",
                "typeName": "point3d"
              }
            ],
            "source": {
              "multiplicity": "(0..*)",
              "roleLabel": "refers to",
              "polymorphic": true,
              "abstractConstraint": "BisCore.Element",
              "constraintClasses": [
                "BisCore.Element"
              ],
              "customAttributes": [
                {
                  "className": "SimpleSchema.CustomAttributeClass_Test4",
                  "StringProperty": "Source"
                }
              ]
            },
            "target": {
              "multiplicity": "(0..*)",
              "roleLabel": "is referenced by",
              "polymorphic": true,
              "abstractConstraint": "BisCore.Element",
              "constraintClasses": [
                "BisCore.Element"
              ],
              "customAttributes": [
                {
                  "className": "SimpleSchema.CustomAttributeClass_Test4",
                  "StringProperty": "Target"
                }
              ]
            }
          }
        },
        {
          "item": "BisCore.Drawing",
          "properties": {
            "schemaItemType": "EntityClass",
            "baseClass": "BisCore.Document",
            "description": "A bis:Drawing is a bis:Document of a 2D drawing.",
            "customAttributes": [
              {
                "className": "BisCore.ClassHasHandler"
              }
            ],
            "mixins": [
              "BisCore.ISubModeledElement"
            ]
          }
        }
      ]
    }
  ]
}