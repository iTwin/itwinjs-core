/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./SchemaFileLocater";
export * from "./SchemaXml";
export * from "./SchemaJsonFileLocater";
export * from "./SchemaXmlFileLocater";
export * from "./StubSchemaXmlFileLocater";
export * from "./SchemaXmlStringLocater";

/** @docs-package-description
 * The ecschema-locaters package contains classes for locating ECSchemas within a given
 * [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext). Each locater
 * implements the [ISchemaLocater interface](https://www.itwinjs.org/reference/ecschema-metadata/context/ischemalocater/).
 */
/**
 * @docs-group-description Locaters
 * ISchemaLocater implementations used to locate schemas in a given [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext).
 */
/**
 * @docs-group-description Utils
 * A set of utility classes used throughout the package.
 */
