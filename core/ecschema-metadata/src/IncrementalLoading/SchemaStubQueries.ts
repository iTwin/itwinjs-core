/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { SchemaItemQueries } from "./SchemaItemQueries";

export const modifier = (alias: string) => {
  return `
    CASE
      WHEN [${alias}].[modifier] = 0 THEN 'None'
      WHEN [${alias}].[modifier] = 1 THEN 'Abstract'
      WHEN [${alias}].[modifier] = 2 THEN 'Sealed'
      ELSE NULL
    END
  `;
};

export const strength = (alias: string) => {
  return `
    CASE
      WHEN [${alias}].[RelationshipStrength] = 0 THEN 'Referencing'
      WHEN [${alias}].[RelationshipStrength] = 1 THEN 'Holding'
      WHEN [${alias}].[RelationshipStrength] = 2 THEN 'Embedding'
      ELSE NULL
    END
  `;
};

export const strengthDirection = (alias: string) => {
  return `
    CASE
      WHEN [${alias}].[RelationshipStrengthDirection] = 1 THEN 'Forward'
      WHEN [${alias}].[RelationshipStrengthDirection] = 2 THEN 'Backward'
      ELSE NULL
    END
  `;
};

const withAppliesTo = `
  AppliesToCTE AS (
    SELECT
      [mixinAppliesTo].[ECInstanceId] AS [AppliesToId],
      [appliesToSchema].[name] as [AppliesToSchema],
      json_extract(XmlCAToJson([ca].[Class].[Id], [ca].[Instance]), '$.IsMixin.AppliesToEntityClass') AS [AppliesTo]
    FROM [meta].[CustomAttribute] [ca]
    JOIN [meta].[ECClassDef] [mixinAppliesTo]
      ON [mixinAppliesTo].[ECInstanceId] = [ca].[ContainerId]
    JOIN [meta].[ECSchemaDef] [appliesToSchema]
      ON [appliesToSchema].[ECInstanceId] = [mixinAppliesTo].[Schema].[Id]
    WHERE [ca].[ContainerType] = 30
      AND json_extract(XmlCAToJson([ca].[Class].[Id], [ca].[Instance]), '$.ecClass') = 'IsMixin'
  )
`;

const withSchemaReferences = `
  SchemaReferences AS (
    SELECT
      [ref].[SourceECInstanceId] AS [SchemaId],
      CONCAT([Name],'.',[VersionMajor],'.',[VersionWrite],'.',[VersionMinor]) AS [fullName]
    FROM
      [meta].[ECSchemaDef] AS [refSchema]
    INNER JOIN [meta].[SchemaHasSchemaReferences] [ref]
      ON [ref].[TargetECInstanceId] = [refSchema].[ECInstanceId]
  )
`;

const customAttributeQuery = `
  SELECT
    [Schema].[Id] AS [SchemaId],
    json_object(
      'name', [class].[Name],
      'schemaItemType', 'CustomAttributeClass',
      'modifier', ${modifier("class")},
      'label', [class].[DisplayLabel],
      'description', [class].[Description],
      'appliesTo', [class].[CustomAttributeContainerType],
      'baseClasses', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'CustomAttributeClass',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description],
            'appliesTo', [baseClass].[CustomAttributeContainerType]
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasAllBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
      )
    ) AS [item]
  FROM [meta].[ECClassDef] [class]
  WHERE [class].[Type] = 3
`;

const structQuery = `
  SELECT
    [Schema].[Id] AS [SchemaId],
    json_object(
      'name', [class].[Name],
      'schemaItemType', 'StructClass',
      'modifier', ${modifier("class")},
      'label', [class].[DisplayLabel],
      'description', [class].[Description],
      'baseClasses', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'StructClass',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description]
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasAllBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
      )
    ) AS [item]
  FROM [meta].[ECClassDef] [class]
  WHERE [class].[Type] = 2
`;

const relationshipQuery = `
  SELECT
    [Schema].[Id] AS [SchemaId],
    json_object(
      'name', [class].[Name],
      'schemaItemType', 'RelationshipClass',
      'modifier', ${modifier("class")},
      'label', [class].[DisplayLabel],
      'description', [class].[Description],
      'strength', ${strength("class")},
      'strengthDirection', ${strengthDirection("class")},
      'baseClasses', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'RelationshipClass',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description],
            'strength', ${strength("baseClass")},
            'strengthDirection', ${strengthDirection("baseClass")}
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasAllBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
      )
    ) AS [item]
  FROM [meta].[ECClassDef] [class]
  WHERE [class].[Type] = 1
`;

const entityQuery = `
  SELECT
    [Schema].[Id] AS [SchemaId],
    json_object(
      'name', [class].[Name],
      'schemaItemType', 'EntityClass',
      'modifier', ${modifier("class")},
      'label', [class].[DisplayLabel],
      'description', [class].[Description],
      'baseClasses', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'EntityClass',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description]
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasAllBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
          AND NOT EXISTS(SELECT 1 FROM [meta].[ClassCustomAttribute] [ca] WHERE [baseClass].[ECInstanceId] = [ca].[Class].[Id]
            AND [ca].[CustomAttributeClass].[Id] Is ([CoreCA].[IsMixin]))
        ),
      'mixins', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'Mixin',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description],
            'appliesTo', (
              SELECT IIF(instr([atCTE].[AppliesTo], ':') > 1, ec_classname(ec_classId([atCTE].[AppliesTo]), 's.c'), CONCAT([atCTE].[AppliesToSchema], '.', [atCTE].[AppliesTo]))
              FROM [AppliesToCTE] [atCTE]
              WHERE [atCTE].[AppliesToId] = [baseClass].[ECInstanceId]
            ),
            'baseClasses', (
              SELECT
                json_group_array(json(json_object(
                  'schema', ec_classname([mixinBaseClass].[ECInstanceId], 's'),
                  'name', [mixinBaseClass].[Name],
                  'schemaItemType', 'Mixin',
                  'modifier', ${modifier("mixinBaseClass")},
                  'label', [mixinBaseClass].[DisplayLabel],
                  'description', [mixinBaseClass].[Description],
                  'appliesTo', (
                    SELECT IIF(instr([atCTE].[AppliesTo], ':') > 1, ec_classname(ec_classId([atCTE].[AppliesTo]), 's.c'), CONCAT([atCTE].[AppliesToSchema], '.', [atCTE].[AppliesTo]))
                    FROM [AppliesToCTE] [atCTE]
                    WHERE [atCTE].[AppliesToId] = [mixinBaseClass].[ECInstanceId]
                  )
                )))
              FROM
                [meta].[ECClassDef] [mixinBaseClass]
              INNER JOIN [meta].[ClassHasAllBaseClasses] [mixinBaseClassMap]
                ON [mixinBaseClassMap].[TargetECInstanceId] = [mixinBaseClass].[ECInstanceId]
              WHERE [mixinBaseClassMap].[SourceECInstanceId] = [baseClass].[ECInstanceId]
            )
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
          AND EXISTS(SELECT 1 FROM [meta].[ClassCustomAttribute] [ca] WHERE [baseClass].[ECInstanceId] = [ca].[Class].[Id]
            AND [ca].[CustomAttributeClass].[Id] Is ([CoreCA].[IsMixin]))
          )
    ) AS [item]
  FROM [meta].[ECClassDef] [class]
  WHERE [class].[Type] = 0
    AND NOT EXISTS(SELECT 1 FROM [meta].[ClassCustomAttribute] [ca] WHERE [class].[ECInstanceId] = [ca].[Class].[Id]
      AND [ca].[CustomAttributeClass].[Id] Is ([CoreCA].[IsMixin]))
`;

const mixinQuery = `
  SELECT
    [Schema].[Id] AS [SchemaId],
    json_object(
      'name', [class].[Name],
      'schemaItemType', 'Mixin',
      'modifier', ${modifier("class")},
      'label', [class].[DisplayLabel],
      'description', [class].[Description],
      'appliesTo', (
        SELECT IIF(instr([atCTE].[AppliesTo], ':') > 1, ec_classname(ec_classId([atCTE].[AppliesTo]), 's.c'), CONCAT([atCTE].[AppliesToSchema], '.', [atCTE].[AppliesTo]))
        FROM [AppliesToCTE] [atCTE]
        WHERE [atCTE].[AppliesToId] = [class].[ECInstanceId]
      ),
      'baseClasses', (
        SELECT
          json_group_array(json(json_object(
            'schema', ec_classname([baseClass].[ECInstanceId], 's'),
            'name', [baseClass].[Name],
            'schemaItemType', 'Mixin',
            'modifier', ${modifier("baseClass")},
            'label', [baseClass].[DisplayLabel],
            'description', [baseClass].[Description],
            'appliesTo', (
              SELECT IIF(instr([atCTE].[AppliesTo], ':') > 1, ec_classname(ec_classId([atCTE].[AppliesTo]), 's.c'), CONCAT([atCTE].[AppliesToSchema], '.', [atCTE].[AppliesTo]))
              FROM [AppliesToCTE] [atCTE]
              WHERE [atCTE].[AppliesToId] = [baseClass].[ECInstanceId]
            )
          )))
        FROM
          [meta].[ECClassDef] [baseClass]
        INNER JOIN [meta].[ClassHasAllBaseClasses] [baseClassMap]
          ON [baseClassMap].[TargetECInstanceId] = [baseclass].[ECInstanceId]
        WHERE [baseClassMap].[SourceECInstanceId] = [class].[ECInstanceId]
      )
    ) AS [item]
    FROM [meta].[ECClassDef] [class]
    WHERE [class].[Type] = 0 AND EXISTS (SELECT 1 FROM [meta].[ClassCustomAttribute] [ca] WHERE [class].[ECInstanceId] = [ca].[Class].[Id]
      AND [ca].[CustomAttributeClass].[Id] Is ([CoreCA].[IsMixin]))
`;

const withSchemaItems = `
SchemaItems AS (
  ${customAttributeQuery}
  UNION ALL
  ${structQuery}
  UNION ALL
  ${relationshipQuery}
  UNION ALL
  ${entityQuery}
  UNION ALL
  ${mixinQuery}
  UNION ALL
  ${SchemaItemQueries.enumeration()}
  UNION ALL
  ${SchemaItemQueries.kindOfQuantity()}
  UNION ALL
  ${SchemaItemQueries.propertyCategory()}
  UNION ALL
  ${SchemaItemQueries.unit()}
  UNION ALL
  ${SchemaItemQueries.invertedUnit()}
  UNION ALL
  ${SchemaItemQueries.constant()}
  UNION ALL
  ${SchemaItemQueries.phenomenon()}
  UNION ALL
  ${SchemaItemQueries.unitSystem()}
  UNION ALL
  ${SchemaItemQueries.format()}
  )
`;

const schemaStubQuery = `
  WITH
    ${withAppliesTo},
    ${withSchemaItems}
  SELECT
    [items].[item]
  FROM
    [SchemaItems] [items]
  JOIN [meta].[ECSchemaDef] [schemaDef]
    ON [schemaDef].[ECInstanceId] = [items].[SchemaId]
  WHERE [schemaDef].[Name] = :schemaName
`;

const schemaInfoQuery = `
  WITH
    ${withSchemaReferences}
  SELECT
    [Name] as [name],
    CONCAT('',[VersionMajor],'.',[VersionWrite],'.',[VersionMinor]) AS [version],
    [Alias] as [alias],
    [DisplayLabel] as [label],
    [Description] as [description],
    (
      SELECT
        json_group_array([schemaReferences].[fullName])
      FROM
        [SchemaReferences] [schemaReferences]
      WHERE
        [schemaReferences].[SchemaId] = [schemaDef].[ECInstanceId]
    ) AS [references]
  FROM
    [meta].[ECSchemaDef] [schemaDef]
`;

/**
 * Partial Schema queries.
 * @internal
 */
export const ecsqlQueries = {
  schemaStubQuery,
  schemaInfoQuery,
};
