import { GenericInstanceFilter } from "@itwin/core-common";

export const testECSQL = `
SELECT 1 FROM PCJ_TestSchema:TestClass as this
  JOIN BisCore:ModelContainsElements as rel_0_0 ON rel_0_0.TargetECInstanceId = this.ECInstanceId
  JOIN BisCore:Model as class_0_0 ON rel_0_0.SourceECInstanceId = class_0_0.ECInstanceId
  JOIN BisCore:ModelModelsElement as rel_0_1 ON rel_0_1.SourceECInstanceId = class_0_0.ECInstanceId
  JOIN BisCore:ISubModeledElement as class_0_1 ON rel_0_1.TargetECInstanceId = class_0_1.ECInstanceId
  JOIN BisCore:ElementHasLinks as rel_0_2 ON rel_0_2.SourceECInstanceId = class_0_1.ECInstanceId
  JOIN BisCore:RepositoryLink as rel_UrlLink_0 ON rel_0_2.TargetECInstanceId = rel_UrlLink_0.ECInstanceId
  WHERE (([this].[Model].[Id] = 0x10)
    AND ([this].[UserLabel] = Properties_60InstancesWithUrl2.dgn OR [this].[UserLabel] = TestClass)
    AND ([this].[String_Property_1] = Lithuania OR [this].[String_Property_1] = United States)
    AND ([rel_UrlLink_0].[Url] = file:///d|/temp/properties_60instanceswithurl2.dgn)
    AND ([rel_UrlLink_0].[UserLabel] = Properties_60InstancesWithUrl2.dgn)
    AND [this].[Boolean_Property] IS TRUE)
`;
export const testClassName = "PCJ_TestSchema:TestClass";
export const testGenericInstanceFilter: GenericInstanceFilter = {
  rules: {
    operator: "and",
    rules: [
      {
        operator: "or",
        rules: [
          {
            operator: "is-equal",
            value: {
              displayValue: "BisCore.DictionaryModel",
              rawValue: {
                className: "BisCore:DictionaryModel",
                id: "0x10",
              },
            },
            sourceAlias: "this",
            propertyName: "Model",
            propertyTypeName: "navigation",
          },
        ],
      },
      {
        operator: "or",
        rules: [
          {
            operator: "is-equal",
            value: {
              displayValue: "Properties_60InstancesWithUrl2.dgn",
              rawValue: "Properties_60InstancesWithUrl2.dgn",
            },
            sourceAlias: "this",
            propertyName: "UserLabel",
            propertyTypeName: "string",
          },
          {
            operator: "is-equal",
            value: {
              displayValue: "TestClass",
              rawValue: "TestClass",
            },
            sourceAlias: "this",
            propertyName: "UserLabel",
            propertyTypeName: "string",
          },
        ],
      },
      {
        operator: "or",
        rules: [
          {
            operator: "is-equal",
            value: {
              displayValue: "Lithuania",
              rawValue: "Lithuania",
            },
            sourceAlias: "this",
            propertyName: "String_Property_1",
            propertyTypeName: "string",
          },
          {
            operator: "is-equal",
            value: {
              displayValue: "United States",
              rawValue: "United States",
            },
            sourceAlias: "this",
            propertyName: "String_Property_1",
            propertyTypeName: "string",
          },
        ],
      },
      {
        operator: "or",
        rules: [
          {
            operator: "is-equal",
            value: {
              displayValue: "file:///d|/temp/properties_60instanceswithurl2.dgn",
              rawValue: "file:///d|/temp/properties_60instanceswithurl2.dgn",
            },
            sourceAlias: "rel_UrlLink_0",
            propertyName: "Url",
            propertyTypeName: "string",
          },
        ],
      },
      {
        operator: "or",
        rules: [
          {
            operator: "is-equal",
            value: {
              displayValue: "Properties_60InstancesWithUrl2.dgn",
              rawValue: "Properties_60InstancesWithUrl2.dgn",
            },
            sourceAlias: "rel_UrlLink_0",
            propertyName: "UserLabel",
            propertyTypeName: "string",
          },
        ],
      },
      {
        operator: "is-true",
        sourceAlias: "this",
        propertyName: "Boolean_Property",
        propertyTypeName: "boolean",
      },
    ],
  },
  relatedInstances: [
    {
      path: [
        {
          sourceClassName: "PCJ_TestSchema:TestClass",
          targetClassName: "BisCore:Model",
          relationshipClassName: "BisCore:ModelContainsElements",
          isForwardRelationship: false,
        },
        {
          sourceClassName: "BisCore:Model",
          targetClassName: "BisCore:ISubModeledElement",
          relationshipClassName: "BisCore:ModelModelsElement",
          isForwardRelationship: true,
        },
        {
          sourceClassName: "BisCore:ISubModeledElement",
          targetClassName: "BisCore:RepositoryLink",
          relationshipClassName: "BisCore:ElementHasLinks",
          isForwardRelationship: true,
        },
      ],
      alias: "rel_UrlLink_0",
    },
  ],
  propertyClassNames: [
    "BisCore:Element",
    "PCJ_TestSchema:TestClass",
  ],
};
