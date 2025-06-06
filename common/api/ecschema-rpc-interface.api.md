## API Report File for "@itwin/ecschema-rpcinterface-common"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { IModelRpcProps } from '@itwin/core-common';
import { ISchemaLocater } from '@itwin/ecschema-metadata';
import { RpcInterface } from '@itwin/core-common';
import { Schema } from '@itwin/ecschema-metadata';
import { SchemaContext } from '@itwin/ecschema-metadata';
import { SchemaInfo } from '@itwin/ecschema-metadata';
import { SchemaKey } from '@itwin/ecschema-metadata';
import { SchemaKeyProps } from '@itwin/ecschema-metadata';
import { SchemaMatchType } from '@itwin/ecschema-metadata';
import { SchemaProps } from '@itwin/ecschema-metadata';

// @internal
export abstract class ECSchemaRpcInterface extends RpcInterface {
    static getClient(): ECSchemaRpcInterface;
    getSchemaJSON(_tokenProps: IModelRpcProps, _schemaName: string): Promise<SchemaProps>;
    getSchemaKeys(_tokenProps: IModelRpcProps): Promise<SchemaKeyProps[]>;
    // (undocumented)
    static readonly interfaceName = "ECSchemaRpcInterface";
    // (undocumented)
    static interfaceVersion: string;
    static version: string;
}

// @public @preview
export class ECSchemaRpcLocater implements ISchemaLocater {
    constructor(token: IModelRpcProps);
    getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined>;
    getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined>;
    // @deprecated
    getSchemaSync(_schemaKey: SchemaKey, _matchType: SchemaMatchType, _context: SchemaContext): Schema | undefined;
    // @internal (undocumented)
    readonly token: IModelRpcProps;
}

// (No @packageDocumentation comment for this package)

```
