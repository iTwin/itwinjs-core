# @itwin/ecschema-locaters

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/ecschema-locaters__ package contains classes for locating and loading EC schema files from the file system. `SchemaXmlFileSource` provides filesystem discovery for the `Authoring.SchemaResolver` API; the older locater classes integrate with `SchemaContext`.

```ts
import { SchemaXmlFileSource } from "@itwin/ecschema-locaters";
import { Authoring } from "@itwin/ecschema-metadata";

const resolver = new Authoring.SchemaResolver();
resolver.addSource(new SchemaXmlFileSource([standardDirectory, applicationDirectory]));
const resolution = await resolver.resolveNames(["MySchema"]);
await resolution.loadDocuments(schemaSet);
```

## Documentation

See the [iTwin.js](https://www.itwinjs.org) documentation for more information.
