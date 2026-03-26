/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/************************************************************************************
 * All SchemaItem queries for each SchemaItemType are defined here. These queries
 * are shared for both 'partial schema' and 'full schema' queries.
 ***********************************************************************************/

/**
 * Query for SchemaItemType KindOfQuantity data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const kindOfQuantity = (singleSchema?: boolean) => `
SELECT
  [koq].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'KindOfQuantity',
    'name', [koq].[Name],
    'label', [koq].[DisplayLabel],
    'description', [koq].[Description],
    'relativeError', [koq].[RelativeError],
    'persistenceUnit', [koq].[PersistenceUnit]
    ${singleSchema ? `
    ,'presentationUnits', (
        SELECT json_group_array(js."value")
        FROM [meta].[KindOfQuantityDef] [koq1], json1.json_each([PresentationUnits]) js
        WHERE [koq1].[ECInstanceId] = [koq].[ECInstanceId]
    ) `: ""}
  ) as [item]
FROM
  [meta].[KindOfQuantityDef] [koq]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [koq].[Schema].[Id]
WHERE [schema].[Name] = :schemaName
` : ""}
`;

/**
 * Query for SchemaItemType PropertyCategory data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const propertyCategory = (singleSchema?: boolean) => `
SELECT
  [pc].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'PropertyCategory',
    'name', [pc].[Name],
    'label', [pc].[DisplayLabel],
    'description', [pc].[Description],
    'priority', [pc].[Priority]
  ) as [item]
FROM
  [meta].[PropertyCategoryDef] [pc]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [pc].[Schema].[Id]
WHERE [schema].[Name] = :schemaName
` : ""}
`;

/**
 * Query for SchemaItemType Enumeration data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const enumeration = (singleSchema?: boolean) => `
SELECT
  [ed].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'Enumeration',
    'name', [ed].[Name],
    'label', [ed].[DisplayLabel],
    'description', [ed].[Description],
    'type', IIF([ed].[Type] = 1281, 'int', IIF([ed].[Type] = 2305, 'string', null)),
    'isStrict', IIF([ed].[IsStrict] = 1, json('true'), json('false')),
    'enumerators', (
      SELECT json_group_array(json(json_object(
        'name', json_extract(js."value", '$.Name'),
        'value', IFNULL(json_extract(js."value", '$.StringValue'), (json_extract(js."value", '$.IntValue'))),
        'label', json_extract(js."value", '$.DisplayLabel'),
        'description', json_extract(js."value", '$.Description')
      )))
      FROM [meta].[ECEnumerationDef] [enumerationDef], json1.json_each([EnumValues]) js
      WHERE [enumerationDef].[ECInstanceId] = [ed].[ECInstanceId]
    )
  ) as [item]
FROM
  [meta].[ECEnumerationDef] [ed]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [ed].[Schema].[Id]
WHERE [schema].[Name] = :schemaName` : ""}
`;

/**
 * Query for SchemaItemType Unit data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const unit = (singleSchema?: boolean) => `
SELECT
  [ud].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'Unit',
    'name', [ud].[Name],
    'label', [ud].[DisplayLabel],
    'description', [ud].[Description],
    'definition', [ud].[Definition],
    'numerator', IIF([ud].[Numerator] IS NULL, NULL, json(format('%.16g', [ud].[Numerator]))),
    'denominator', IIF([ud].[Denominator] IS NULL, NULL, json(format('%.16g', [ud].[Denominator]))),
    'offset', IIF([ud].[Offset] IS NULL, NULL, json(format('%!.15f', [ud].[Offset]))),
    'unitSystem', CONCAT([uss].[Name],'.', [usd].[Name]),
    'phenomenon', CONCAT([ps].[Name],'.', [pd].[Name])
  ) as item
FROM
  [meta].[UnitDef] [ud]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [ud].[Schema].[Id]` : ""}
JOIN [meta].[UnitSystemDef] [usd]
  ON [usd].[ECInstanceId] = [ud].[UnitSystem].[Id]
JOIN [meta].[ECSchemaDef] [uss]
  ON [uss].[ECInstanceId] = [usd].[Schema].[Id]
JOIN [meta].[PhenomenonDef] [pd]
  ON [pd].[ECInstanceId] = [ud].[Phenomenon].[Id]
JOIN [meta].[ECSchemaDef] [ps]
  ON [ps].[ECInstanceId] = [pd].[Schema].[Id]
WHERE
  ${singleSchema ? `
  [schema].[Name] = :schemaName AND` : ""}
  [ud].[IsConstant] = 0 AND
  [ud].[InvertingUnit] IS NULL
`;

/**
 * Query for SchemaItemType InvertedUnit data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const invertedUnit = (singleSchema?: boolean) => `
SELECT
  [ud].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'InvertedUnit',
    'name', [ud].[Name],
    'label', [ud].[DisplayLabel],
    'description', [ud].[Description],
    'unitSystem', CONCAT([systemSchema].[Name],'.', [usd].[Name]),
    'invertsUnit', IIF([iud].[Name] IS NULL, null, CONCAT([ius].[Name],'.', [iud].[Name]))
  ) as [item]
FROM
  [meta].[UnitDef] [ud]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [ud].[Schema].[Id]` : ""}
JOIN [meta].[UnitSystemDef] [usd]
  ON [usd].[ECInstanceId] = [ud].[UnitSystem].[Id]
JOIN [meta].[ECSchemaDef] [systemSchema]
  ON [systemSchema].[ECInstanceId] = [usd].[Schema].[Id]
LEFT JOIN [meta].[UnitDef] [iud]
  ON [iud].[ECInstanceId] = [ud].[InvertingUnit].[Id]
LEFT JOIN [meta].[ECSchemaDef] [ius]
  ON [ius].[ECInstanceId] = [iud].[Schema].[Id]
WHERE
  ${singleSchema ? `
  [schema].[Name] = :schemaName AND` : ""}
  [ud].[IsConstant] = 0 AND
  [ud].[InvertingUnit] IS NOT NULL
`;

/**
 * Query for SchemaItemType Constant data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const constant = (singleSchema?: boolean) => `
SELECT
  [cd].[Schema].[Id] AS [SchemaId],
  json_object(
    'schemaItemType', 'Constant',
    'name', [cd].[Name],
    'label', [cd].[DisplayLabel],
    'description', [cd].[Description],
    'definition', [cd].[Definition],
    'numerator', IIF([cd].[Numerator] IS NULL, NULL, json(format('%.16g', [cd].[Numerator]))),
    'denominator', IIF([cd].[Denominator] IS NULL, NULL, json(format('%.16g', [cd].[Denominator]))),
    'phenomenon', CONCAT([phenomSchema].[Name],'.', [phenomDef].[Name])
  ) as item
FROM
  [meta].[UnitDef] [cd]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [cd].[Schema].[Id]` : ""}
JOIN [meta].[PhenomenonDef] [phenomDef]
  ON [phenomDef].[ECInstanceId] = [cd].[Phenomenon].[Id]
JOIN [meta].[ECSchemaDef] [phenomSchema]
  ON [phenomSchema].[ECInstanceId] = [phenomDef].[Schema].[Id]
WHERE
  ${singleSchema ? `
  [schema].[Name] = :schemaName AND` : ""}
  [cd].[IsConstant] = 1
`;

/**
 * Query for SchemaItemType UnitSystem data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const unitSystem = (singleSchema?: boolean) => `
SELECT
  [us].[Schema].[Id] AS [SchemaId],
  json_object (
    'schemaItemType', 'UnitSystem',
    'name', [us].[Name],
    'label', [us].[DisplayLabel],
    'description', [us].[Description]
  ) as [item]
FROM
  [meta].[UnitSystemDef] [us]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [us].[Schema].[Id]
WHERE [schema].[Name] = :schemaName` : ""}
`;

/**
 * Query for SchemaItemType Phenomenon data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const phenomenon = (singleSchema?: boolean) => `
SELECT
  [pd].[Schema].[Id] AS [SchemaId],
  json_object(
    'schemaItemType', 'Phenomenon',
    'name', [pd].[Name],
    'label', [pd].[DisplayLabel],
    'description', [pd].[Description],
    'definition', [pd].[Definition]
  ) as [item]
FROM
  [meta].[PhenomenonDef] [pd]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [pd].[Schema].[Id]
WHERE [schema].[Name] = :schemaName` : ""}
`;

/**
 * Query for SchemaItemType Format data.
 * @param singleSchema Indicates if a filter and join for a single Schema should be applied.
 */
const format = (singleSchema?: boolean) => `
SELECT
  [fd].[Schema].[Id] AS [SchemaId],
  json_object(
    'schemaItemType', 'Format',
    'name', [fd].[Name],
    'label', [fd].[DisplayLabel],
    'description', [fd].[Description],
    'type', json_extract([fd].[NumericSpec], '$.type'),
    'precision', json_extract([fd].[NumericSpec], '$.precision'),
    'roundFactor', json_extract([fd].[NumericSpec], '$.roundFactor'),
    'minWidth', json_extract([fd].[NumericSpec], '$.minWidth'),
    'showSignOption', json_extract([fd].[NumericSpec], '$.showSignOption'),
    'decimalSeparator', json_extract([fd].[NumericSpec], '$.decimalSeparator'),
    'thousandSeparator', json_extract([fd].[NumericSpec], '$.thousandSeparator'),
    'uomSeparator', json_extract([fd].[NumericSpec], '$.uomSeparator'),
    'scientificType', json_extract([fd].[NumericSpec], '$.scientificType'),
    'stationOffsetSize', json_extract([fd].[NumericSpec], '$.stationOffsetSize'),
    'stationSeparator', json_extract([fd].[NumericSpec], '$.stationSeparator'),
    'formatTraits', json_extract([fd].[NumericSpec], '$.formatTraits')
    ${singleSchema ? `
    ,'composite', (
      SELECT
        json_object(
          'spacer', json_extract([fd1].[CompositeSpec], '$.spacer'),
          'includeZero', json(IIF(json_extract([fd1].[CompositeSpec], '$.includeZero') = 1, 'true', IIF(json_extract([fd1].[CompositeSpec], '$.includeZero') = 0, 'false', null))),
          'units', (
            SELECT json_group_array(json(json_object(
              'name', CONCAT([sd].[Name], '.', [ud].[Name]),
              'label', [fud].[Label]
            )))
            FROM [meta].[FormatDef] [fd2]
              LEFT JOIN [meta].[FormatCompositeUnitDef] [fud] ON [fud].[Format].[Id] = [fd2].[ECInstanceId]
              LEFT JOIN [meta].[UnitDef] [ud] ON [ud].[ECInstanceId] = [fud].[Unit].[Id]
              INNER JOIN [meta].[ECSchemaDef] [sd] ON [sd].[ECInstanceId] = [ud].[Schema].[Id]
            WHERE [fd2].[ECInstanceId] = [fd1].[ECInstanceId]
          )
        )
      FROM [meta].[FormatDef] [fd1]
      WHERE [fd1].[ECInstanceId]= [fd].[ECInstanceId] AND [fd1].[CompositeSpec] IS NOT NULL
    )` : ""}
) AS item
FROM
  [meta].[FormatDef] [fd]
${singleSchema ? `
JOIN
  [meta].[ECSchemaDef] [schema] ON [schema].[ECInstanceId] = [fd].[Schema].[Id]
WHERE [schema].[Name] = :schemaName` : ""}
`

/**
 * Queries for each SchemaItemType
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const SchemaItemQueries = {
  kindOfQuantity,
  propertyCategory,
  enumeration,
  unit,
  invertedUnit,
  constant,
  unitSystem,
  phenomenon,
  format
};
