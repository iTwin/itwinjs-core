# Serializing EC Schemas to XML

When working the [EC Schema instances](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema),
it may be necessary to serialize the Schema to an XML file. The first option is a utility method found in the
Bentley provided package [@itwin/ecschema-locaters](https://www.itwinjs.org/reference/ecschema-locaters).
The second option utilizes two interfaces from the [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom)
package. Both options will be covered here.

## SchemaFileUtility in @itwin/ecschema-locaters

The SchemaFileUtility class in the [@itwin/ecschema-locaters](https://www.itwinjs.org/reference/ecschema-locaters) package
contains the 'writeSchemaXmlFile' method. This method takes the EC Schema instance and a path to the file to create. The
SchemaFileUtility.writeSchemaXmlFile method is asynchronous, requiring the 'await' keyword.

```ts
await SchemaFileUtility.writeSchemaXmlFile(schema, outDir);
```

## @xmldom/xmldom package

If you prefer to not have a dependency on the @itwin/ecschema-locaters package, the following example demonstrates how
to serialize the Schema to an XML file using the DOMParser and XMLSerializer interface from the
[@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) package. The [fs-extra](https://www.npmjs.com/package/fs-extra)
package is used to work with the file system.

```ts
import * as fs from "fs-extra"; // file system api
import { DOMParser, XMLSerializer } from "@xmldom/xmldom"; // XML support
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "@itwin/ecschema-editing"; // For creating a small sample Schema for this tutorial
```

First, you must have an instance of an [EC Schema](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema)
to serialize. The schema may be created, loaded from an iModel, or perhaps from an xml file on the file system. In this
sample we will be creating a new Schema using schema editing API available in the
[@itwin/ecschema-editing package](https://www.itwinjs.org/reference/ecschema-editing).

```ts
const context = new SchemaContext();
const sampleEditor = new SchemaContextEditor(context);
const sampleSchema = await sampleEditor.createSchema("sampleSchema", "sampleAlias", 1, 0, 0);
```

Now that we have a schema to work with, create a new DOM XML document using the DOMParser. The
Document can then be passed to the Schema.toXml() method which returns the Document containing the schema XML.
We can then utilize the XMLSerializer interface to serialize the XML to a string.

```ts
let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
xmlDoc = await sampleSchema.toXml(xmlDoc);
const serializer = new XMLSerializer();
const xml = serializer.serializeToString(xmlDoc);
```

We can now use the file system API to write the xml to file.

```ts
fs.writeFileSync("c:\\sample\\path\\to\\file", xml);
```
