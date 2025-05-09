## API Report File for "@itwin/analytical-backend"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { ElementRefersToElements } from '@itwin/core-backend';
import { GeometricElement3d } from '@itwin/core-backend';
import { GeometricElement3dProps } from '@itwin/core-common';
import { GeometricModel3d } from '@itwin/core-backend';
import { IModelDb } from '@itwin/core-backend';
import { InformationPartitionElement } from '@itwin/core-backend';
import { Schema } from '@itwin/core-backend';
import { TypeDefinitionElement } from '@itwin/core-backend';
import { TypeDefinitionElementProps } from '@itwin/core-common';

// @beta
export abstract class AnalyticalElement extends GeometricElement3d {
    // @internal
    constructor(props: GeometricElement3dProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// @beta
export abstract class AnalyticalModel extends GeometricModel3d {
    // @internal (undocumented)
    static get className(): string;
}

// @beta
export class AnalyticalPartition extends InformationPartitionElement {
    // @internal (undocumented)
    static get className(): string;
}

// @beta
export class AnalyticalSchema extends Schema {
    // (undocumented)
    static registerSchema(): void;
    static get schemaFilePath(): string;
    // (undocumented)
    static get schemaName(): string;
}

// @beta
export class AnalyticalSimulatesSpatialElement extends ElementRefersToElements {
    // @internal (undocumented)
    static get className(): string;
}

// @beta
export abstract class AnalyticalType extends TypeDefinitionElement {
    // @internal
    constructor(props: TypeDefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// (No @packageDocumentation comment for this package)

```
