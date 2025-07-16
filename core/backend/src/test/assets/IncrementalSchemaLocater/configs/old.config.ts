export default {
  "label": "Old Profile iModel",
  "bimFile": "OldProfile.bim",
  "schemas": [
    {
      "name": "Schema_TestBase",
      "references": [
        "BisCore"
      ],
      "itemCount": 5,
      "checkStubs": [
        {
          "item": "Schema_TestBase.Category_TestBase",
          "properties": {
            "schemaItemType": "PropertyCategory",
            "label": "Test1",
            "description": "Category Test1",
            "priority": 0
          }
        }
      ],
      "checkHierachy": {
        "derivedClass": "Schema_TestBase.EntityClass_TestBase",
        "baseClass": "BisCore.PhysicalElement"
      },
      "checkFullLoad": [
        {
          "item": "Schema_TestBase.CustomAttributeClass_Test2",
          "properties": {
            "description": "CustomAttributeClass Test2",
            "properties": [
              {
                "name": "Property_Test1",
                "type": "PrimitiveProperty",
                "description": "Property Test1",
                "typeName": "string"
              }
            ],
            "appliesTo": "AnyClass"
          }
        },
        {
          "item": "Schema_TestBase.StructClass_TestBase",
          "properties": {
            "schemaItemType": "StructClass",
            "properties": [
              {
                "name": "Property_Test1",
                "type": "PrimitiveProperty",
                "description": "Property Test1",
                "label": "Test1",
                "category": "Schema_TestBase.Category_TestBase",
                "typeName": "string"
              },
              {
                "name": "Property_Test2",
                "type": "PrimitiveProperty",
                "description": "Property Test2",
                "label": "Test2",
                "typeName": "string"
              }
            ]
          }
        }
      ]
    }
  ]
}