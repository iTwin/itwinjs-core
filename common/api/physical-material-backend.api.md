## API Report File for "@itwin/physical-material-backend"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { DefinitionElementProps } from '@itwin/core-common';
import { IModelDb } from '@itwin/core-backend';
import { PhysicalMaterial } from '@itwin/core-backend';
import { Schema } from '@itwin/core-backend';

// @public
export class Aggregate extends PhysicalMaterial {
    constructor(props: DefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// @public
export class Aluminum extends PhysicalMaterial {
    constructor(props: DefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// @public
export class Asphalt extends PhysicalMaterial {
    constructor(props: DefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// @public
export class Concrete extends PhysicalMaterial {
    constructor(props: DefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// @public
export class PhysicalMaterialSchema extends Schema {
    // (undocumented)
    static registerSchema(): void;
    static get schemaFilePath(): string;
    // (undocumented)
    static get schemaName(): string;
}

// @public
export class Steel extends PhysicalMaterial {
    constructor(props: DefinitionElementProps, iModel: IModelDb);
    // @internal (undocumented)
    static get className(): string;
}

// (No @packageDocumentation comment for this package)

```
