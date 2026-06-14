/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// CA property and class names mirror real ECSchema identifiers (PascalCase), so the EC naming
// is intentional throughout this reference catalog.
/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Custom attribute value-shape reference catalog.
 *
 * This is a *reference* file, not (yet) a test. It exists to make the XML-vs-JSON custom-attribute
 * conversion problem concrete and reviewable in one place, so design discussion stops happening in
 * the abstract.
 *
 * Every fragment here is grounded, not invented:
 * - `xml` fragments are taken verbatim from the `ec_CustomAttribute` table of a large production
 *   iModel (Jacobs Plantsight), or - for shapes that do not occur there - synthesized and run
 *   through native `XmlCAToJson` to get the authoritative result.
 * - `canonicalJson` is the flattened ECJSON form as it appears in the published `*.ecschema.json`
 *   packages (e.g. `@bentley/bis-core-schema`), or the native `XmlCAToJson` output with its
 *   `ecClass`/`ecSchema` envelope stripped (that envelope is an ECSql-function artifact and is NOT
 *   part of the canonical schema-serialization form).
 *
 * ------------------------------------------------------------------------------------------------
 * THE CORE PROBLEM
 * ------------------------------------------------------------------------------------------------
 * The `SchemaDocument` readers/writers are deliberately *class-blind*: they convert one format to
 * another without a resolved schema graph (serialization must work on a standalone document). CA
 * values in ECXML carry NO type information and NO struct-class name on array entries - both live
 * only in the CA class definition. The class-blind reader recovers what it safely can:
 *
 *   1. Scalar TYPES - RECOVERED HEURISTICALLY, with a reversibility guard. `<IsUnique>True</IsUnique>`
 *      is text "True" in XML; the reader promotes it to `true` only when the typed value
 *      re-serializes to the BYTE-IDENTICAL text - boolean only for exact EC-canonical `True`/`False`,
 *      number only when `String(Number(x)) === x` (which rejects "007", "1.0", "1e3", "NaN",
 *      whitespace). The guard means promotion can never change the XML round-trip. The only casualty
 *      is a *string* property whose value happens to be exactly "True" or a canonical number - rare,
 *      and even then the XML round-trip stays exact (only XML->JSON mis-types it).
 *   2. Single-entry struct ARRAYS - STILL UNRECOVERABLE. `<Indexes><DbIndex>..</DbIndex></Indexes>`
 *      (one entry) is lexically identical to a struct property whose single member is named
 *      `DbIndex`. No value-shape guard resolves it; it needs to know `Indexes` is a struct-array
 *      property.
 *
 * ------------------------------------------------------------------------------------------------
 * CONVERSION MATRIX (as-built, current readers/writers, with guarded scalar promotion)
 * ------------------------------------------------------------------------------------------------
 *   XML  -> doc -> XML   : EXACT for every shape below. The reversibility guard keeps promoted
 *                          scalars byte-identical on the way back out (true -> True, 0 -> 0), and the
 *                          struct-array wrapper object preserves struct-array entries.
 *   JSON -> doc -> JSON  : EXACT for every shape below.
 *   XML  -> doc -> JSON  : CANONICAL FOR SCALARS (promoted to bool/number by the reader). Residual
 *                          gaps are struct-array shape only: entries keep a wrapper key (the multi-
 *                          entry case the JSON writer can still unwrap), and a single-entry struct
 *                          array emerges as a struct.
 *   JSON -> doc -> XML   : LOSSY for struct arrays - the entry element name (struct class) is not
 *                          present in canonical JSON, so the writer cannot name the entry element
 *                          and skips it (SchemaXml-0006). Booleans emit EC-canonical True/False (the
 *                          writer capitalizes), so the boolean direction is no longer lossy.
 *
 * The remaining cross-format gaps are struct-array-only; both trace to the same root cause - the
 * struct-class name on array entries lives only in the CA class. With guarded promotion the scalar
 * shapes now match across XML- and JSON-loaded documents, so the model is homogeneous for scalars;
 * only the struct-array wrapper still differs by load source.
 *
 * Each entry below records, side by side:
 *   - `xml`                  : the source ECXML fragment (inside an <ECCustomAttributes> container)
 *   - `canonicalJson`        : the target canonical ECJSON form (ground truth)
 *   - `xmlReaderShape`       : what the current class-blind XML reader produces into the document
 *   - `jsonReaderShape`      : what the current class-blind JSON reader produces into the document
 * For scalars the two reader shapes now agree (guarded promotion). Where they still differ - the
 * struct-array wrapper - the SAME custom attribute lives in the document under two different in-
 * memory shapes depending on which format it was loaded from. That residual asymmetry is the wart
 * at the heart of the discussion.
 */

/** One catalog entry: a single CA value shape, in all its forms. */
export interface CustomAttributeFragment {
  /** Short scenario name. */
  readonly scenario: string;
  /** Where the example was sourced from. */
  readonly source: string;
  /** Source ECXML, as it appears inside an `<ECCustomAttributes>` element. */
  readonly xml: string;
  /** Canonical ECJSON (flattened `className` + inline props), ground truth. */
  readonly canonicalJson: object;
  /** Document shape produced by the current class-blind XML reader (`{ className, properties? }`). */
  readonly xmlReaderShape: object;
  /** Document shape produced by the current class-blind JSON reader (`{ className, properties? }`). */
  readonly jsonReaderShape: object;
  /** Notes on what is recoverable vs. class-dependent. */
  readonly notes: string;
}

export const customAttributeFragments: readonly CustomAttributeFragment[] = [
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Empty CA (no properties)",
    source: "ECDbSchemaPolicies.NoAdditionalLinkTables - iModel + published BisCore.ecschema.json",
    xml: `<NoAdditionalLinkTables xmlns="ECDbSchemaPolicies.01.00"/>`,
    canonicalJson: { className: "ECDbSchemaPolicies.NoAdditionalLinkTables" },
    xmlReaderShape: { className: "ECDbSchemaPolicies:NoAdditionalLinkTables" },
    jsonReaderShape: { className: "ECDbSchemaPolicies:NoAdditionalLinkTables" },
    notes: "Fully recoverable from XML alone. No properties, no types, no arrays. Round-trips in every direction.",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Scalar string",
    source: "CoreCustomAttributes.ClassHasCurrentTimeStampProperty - iModel",
    xml: `<ClassHasCurrentTimeStampProperty xmlns="CoreCustomAttributes.01.03">
  <PropertyName>LastMod</PropertyName>
</ClassHasCurrentTimeStampProperty>`,
    canonicalJson: { className: "CoreCustomAttributes.ClassHasCurrentTimeStampProperty", PropertyName: "LastMod" },
    xmlReaderShape: { className: "CoreCustomAttributes:ClassHasCurrentTimeStampProperty", properties: { PropertyName: "LastMod" } },
    jsonReaderShape: { className: "CoreCustomAttributes:ClassHasCurrentTimeStampProperty", properties: { PropertyName: "LastMod" } },
    notes: "Recoverable from XML alone - the value IS a string, so no typing needed. The only canonical-shape gap is the flattening (className + inline props), which the JSON writer does.",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Scalar string backed by an enum",
    source: "CoreCustomAttributes.DateTimeInfo - iModel (DateTimeKind is a string-backed enum)",
    xml: `<DateTimeInfo xmlns="CoreCustomAttributes.01.03">
  <DateTimeKind>Utc</DateTimeKind>
</DateTimeInfo>`,
    canonicalJson: { className: "CoreCustomAttributes.DateTimeInfo", DateTimeKind: "Utc" },
    xmlReaderShape: { className: "CoreCustomAttributes:DateTimeInfo", properties: { DateTimeKind: "Utc" } },
    jsonReaderShape: { className: "CoreCustomAttributes:DateTimeInfo", properties: { DateTimeKind: "Utc" } },
    notes: "String-backed enum serializes identically to a plain string in both formats. No type gap. (An int-backed enum would behave like the int scalar below.)",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Scalar boolean (promoted by guard)",
    source: "ECDbMap.PropertyMap - iModel + canonical native output",
    xml: `<PropertyMap xmlns="ECDbMap.02.00">
  <IsNullable>False</IsNullable>
  <IsUnique>True</IsUnique>
  <Collation>NoCase</Collation>
</PropertyMap>`,
    canonicalJson: { className: "ECDbMap.PropertyMap", IsNullable: false, IsUnique: true, Collation: "NoCase" },
    xmlReaderShape: { className: "ECDbMap:PropertyMap", properties: { IsNullable: false, IsUnique: true, Collation: "NoCase" } },
    jsonReaderShape: { className: "ECDbMap:PropertyMap", properties: { IsNullable: false, IsUnique: true, Collation: "NoCase" } },
    notes: "RESOLVED by guarded promotion. The reader promotes exact \"True\"/\"False\" to booleans; both reader shapes now match canonical. Round-trip stays exact because the XML writer re-emits EC-canonical \"True\"/\"False\" (it capitalizes, not String(value)'s lowercase). \"Collation\" stays a string (not \"True\"/\"False\" or a canonical number).",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Scalar int (promoted by guard)",
    source: "BisCore.CustomHandledProperty - iModel + canonical native output",
    xml: `<CustomHandledProperty xmlns="BisCore.01.10">
  <StatementTypes>0</StatementTypes>
</CustomHandledProperty>`,
    canonicalJson: { className: "BisCore.CustomHandledProperty", StatementTypes: 0 },
    xmlReaderShape: { className: "BisCore:CustomHandledProperty", properties: { StatementTypes: 0 } },
    jsonReaderShape: { className: "BisCore:CustomHandledProperty", properties: { StatementTypes: 0 } },
    notes: "RESOLVED by guarded promotion. \"0\" promotes to 0 because String(Number(\"0\")) === \"0\". A value like \"007\" or \"1.0\" would NOT promote (String(Number(x)) !== x) and would stay a string. Note native also rewrites the xmlns version (BisCore.01.10 -> resolved 01.14); the class-blind reader keeps only the name, which is the version-lenient behavior we want.",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Primitive array (string[])",
    source: "BisCore.ClassHasHandler / ReservedPropertyNames - iModel + published BisCore.ecschema.json",
    xml: `<ClassHasHandler xmlns="BisCore.01.10">
  <Restrictions>
    <string>Clone</string>
  </Restrictions>
</ClassHasHandler>`,
    canonicalJson: { className: "BisCore.ClassHasHandler", Restrictions: ["Clone"] },
    xmlReaderShape: { className: "BisCore:ClassHasHandler", properties: { Restrictions: ["Clone"] } },
    jsonReaderShape: { className: "BisCore:ClassHasHandler", properties: { Restrictions: ["Clone"] } },
    notes: "Recoverable from XML alone. The repeated <string> primitive-keyword children are detected as a primitive array. NOTE: the guarded scalar promotion applies to scalars only, NOT to array entries - a primitive array of int/bool still reads as strings (e.g. [\"5\"], not [5]). That smaller gap is left open on purpose; the element name does carry the type, but the writer's int/double guessing and boolean casing make round-trip promotion there riskier than it is worth right now.",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Struct property (single nested struct, not an array)",
    source: "CoreCustomAttributes.SupplementalSchema - synthesized, confirmed via native XmlCAToJson",
    xml: `<SupplementalSchema xmlns="CoreCustomAttributes.01.03">
  <PrimarySchemaReference>
    <SchemaName>BisCore</SchemaName>
    <MajorVersion>1</MajorVersion>
    <MinorVersion>10</MinorVersion>
    <WriteVersion>0</WriteVersion>
  </PrimarySchemaReference>
  <Precedence>200</Precedence>
  <Purpose>Tagging</Purpose>
</SupplementalSchema>`,
    canonicalJson: {
      className: "CoreCustomAttributes.SupplementalSchema",
      PrimarySchemaReference: { SchemaName: "BisCore", MajorVersion: 1, MinorVersion: 10, WriteVersion: 0 },
      Precedence: 200,
      Purpose: "Tagging",
    },
    xmlReaderShape: {
      className: "CoreCustomAttributes:SupplementalSchema",
      properties: {
        PrimarySchemaReference: { SchemaName: "BisCore", MajorVersion: 1, MinorVersion: 10, WriteVersion: 0 },
        Precedence: 200,
        Purpose: "Tagging",
      },
    },
    jsonReaderShape: {
      className: "CoreCustomAttributes:SupplementalSchema",
      properties: {
        PrimarySchemaReference: { SchemaName: "BisCore", MajorVersion: 1, MinorVersion: 10, WriteVersion: 0 },
        Precedence: 200,
        Purpose: "Tagging",
      },
    },
    notes: "STRUCTURE recoverable from XML (nested object); the int members inside the struct are promoted by the same guard (MajorVersion 1, Precedence 200, etc.), so both reader shapes match canonical. A struct is unambiguous because its members have distinct names - contrast the single-entry struct array below.",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Struct array, multiple entries",
    source: "ECDbMap.DbIndexList - iModel + published BisCore.ecschema.json (on Element)",
    xml: `<DbIndexList xmlns="ECDbMap.02.00">
  <Indexes>
    <DbIndex>
      <Name>ix_bis_Element_FederationGuid</Name>
      <IsUnique>True</IsUnique>
      <Properties>
        <string>FederationGuid</string>
      </Properties>
      <Where>IndexedColumnsAreNotNull</Where>
    </DbIndex>
    <DbIndex>
      <Name>ix_bis_Element_Code</Name>
      <IsUnique>True</IsUnique>
      <Properties>
        <string>CodeSpec.Id</string>
        <string>CodeScope.Id</string>
        <string>CodeValue</string>
      </Properties>
    </DbIndex>
  </Indexes>
</DbIndexList>`,
    canonicalJson: {
      className: "ECDbMap.DbIndexList",
      Indexes: [
        { Name: "ix_bis_Element_FederationGuid", IsUnique: true, Properties: ["FederationGuid"], Where: "IndexedColumnsAreNotNull" },
        { Name: "ix_bis_Element_Code", IsUnique: true, Properties: ["CodeSpec.Id", "CodeScope.Id", "CodeValue"] },
      ],
    },
    xmlReaderShape: {
      className: "ECDbMap:DbIndexList",
      properties: {
        Indexes: [
          { DbIndex: { Name: "ix_bis_Element_FederationGuid", IsUnique: true, Properties: ["FederationGuid"], Where: "IndexedColumnsAreNotNull" } },
          { DbIndex: { Name: "ix_bis_Element_Code", IsUnique: true, Properties: ["CodeSpec.Id", "CodeScope.Id", "CodeValue"] } },
        ],
      },
    },
    jsonReaderShape: {
      className: "ECDbMap:DbIndexList",
      properties: {
        Indexes: [
          { Name: "ix_bis_Element_FederationGuid", IsUnique: true, Properties: ["FederationGuid"], Where: "IndexedColumnsAreNotNull" },
          { Name: "ix_bis_Element_Code", IsUnique: true, Properties: ["CodeSpec.Id", "CodeScope.Id", "CodeValue"] },
        ],
      },
    },
    notes: "One residual divergence from canonical: the WRAPPER. The XML reader keeps each entry as { DbIndex: {...} } because the writer needs the entry element name (struct class) to emit <DbIndex>; canonical JSON drops it. For >=2 entries the wrapper is unambiguously the struct-type element, so the JSON writer CAN safely unwrap it. The scalar IsUnique is now promoted to true by the guard (matches canonical). JSON->doc->XML is still LOSSY here: the canonical/JSON shape has no DbIndex wrapper, so the XML writer cannot name the entry element and skips it (SchemaXml-0006).",
  },
  // ------------------------------------------------------------------------------------------------
  {
    scenario: "Struct array, single entry (AMBIGUOUS - the hard case)",
    source: "CoreCustomAttributes.SupplementalProvenance - synthesized, confirmed via native XmlCAToJson",
    xml: `<SupplementalProvenance xmlns="CoreCustomAttributes.01.03">
  <SupplementalSchemaNamesAndPurposes>
    <SchemaNameAndPurpose>
      <SchemaName>OpenPlant_Supplemental_Tagging.01.00.08</SchemaName>
      <Purpose>Tagging</Purpose>
    </SchemaNameAndPurpose>
  </SupplementalSchemaNamesAndPurposes>
</SupplementalProvenance>`,
    canonicalJson: {
      className: "CoreCustomAttributes.SupplementalProvenance",
      SupplementalSchemaNamesAndPurposes: [
        { SchemaName: "OpenPlant_Supplemental_Tagging.01.00.08", Purpose: "Tagging" },
      ],
    },
    xmlReaderShape: {
      className: "CoreCustomAttributes:SupplementalProvenance",
      properties: {
        // Read as a STRUCT, not a one-element array: lexically indistinguishable without the class.
        SupplementalSchemaNamesAndPurposes: {
          SchemaNameAndPurpose: { SchemaName: "OpenPlant_Supplemental_Tagging.01.00.08", Purpose: "Tagging" },
        },
      },
    },
    jsonReaderShape: {
      className: "CoreCustomAttributes:SupplementalProvenance",
      properties: {
        SupplementalSchemaNamesAndPurposes: [
          { SchemaName: "OpenPlant_Supplemental_Tagging.01.00.08", Purpose: "Tagging" },
        ],
      },
    },
    notes: "THE UNDECIDABLE CASE. <Names><SchemaNameAndPurpose>..</SchemaNameAndPurpose></Names> with ONE child is byte-identical to a struct property whose single member is named SchemaNameAndPurpose. The XML reader (>=2 guard) reads it as a struct. Canonical wants a one-element array. Cannot be resolved without knowing the property is a struct array. NOTE: XML->doc->XML still round-trips EXACTLY, because the struct reading re-emits the same XML. Only XML->JSON is wrong here.",
  },
];
