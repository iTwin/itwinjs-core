# Loading ECSchemas from XML Files

To load [EC Schemas](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema) from XML files, you need to locate these files on the file system. The Bentley package [@itwin/ecschema-locaters](https://www.itwinjs.org/reference/ecschema-locaters) provides locater classes that implement [ISchemaLocater](https://www.itwinjs.org/reference/ecschema-metadata/context/ischemalocater) to locate schemas in a given [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext).

## PublishedSchemaXmlFileLocater

The Bentley provided [@itwin/core-backend](https://www.itwinjs.org/reference/core-backend) package includes a set of standard schema assets accessible at [KnownLocations.nativeAssetsDir](https://www.itwinjs.org/reference/core-backend/imodelhost/knownlocations).

While the [SchemaXmlFileLocater](https://www.itwinjs.org/reference/ecschema-locaters/locaters/schemaxmlfilelocater) can locate schemas along user-defined search paths, it cannot access these standard schemas from the backend package assets. These standard schemas can be loaded using the [PublishedSchemaXmlFileLocater](https://www.itwinjs.org/reference/ecschema-locaters/locaters/publishedschemaxmlfilelocater).

### Constructor

The `PublishedSchemaXmlFileLocater` class takes a single argument: the native assets directory path of the backend package. This directory path can be accessed using the [KnownLocations.nativeAssetsDir](https://www.itwinjs.org/reference/core-backend/imodelhost/knownlocations) getter provided by the core-backend package.

### Usage

The primary purpose of `PublishedSchemaXmlFileLocater` is to locate the standard schemas released by the core-backend package, making it a read-only locater. User-defined schemas should always take precedence over standard schemas. Therefore, when a schema context has multiple locaters, the `PublishedSchemaXmlFileLocater` should be added last to the locater list. This ensures that standard schemas are loaded only as a fallback when no user-defined version of the schema can be found.

The [SchemaContext](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext) provides a method to achieve this: [addFallbackLocater(locater: ISchemaLocater)](https://www.itwinjs.org/reference/ecschema-metadata/context/schemacontext/addFallbackLocater). This method ensures that the locater remains at the end of the list, regardless of any existing locaters in the context or any new locaters added subsequently. Calling `addFallbackLocater` with the `PublishedSchemaXmlFileLocater` ensures that standard schemas are considered as fallbacks.

### Example

```typescript
import { SchemaContext } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";

const schemaContext = new SchemaContext();
const publishedSchemaLocater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);
schemaContext.addFallbackLocater(publishedSchemaLocater);