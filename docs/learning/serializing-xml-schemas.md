# Serializing EC Schemas to XML

When working the [EC Schema instances](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema),
it may be necessary to serialize the Schema to an XML file. The first option is a utility method found in the
Bentley provided package [@itwin/ecschema-locaters](https://www.itwinjs.org/reference/ecschema-locaters).
The second option utilizes two interfaces from the [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom)
package. Both options will be covered here.

## SchemaXml in @itwin/ecschema-locaters

The [SchemaXml.writeFile]($ecschema-locaters) method takes the EC Schema instance and serializes it to a specified location on disk. Note: this method is `async`, requiring the caller to `await` it.

```ts
await SchemaXml.writeFile(schema, outDir);
```

## @xmldom/xmldom package

If you prefer to not have a dependency on the @itwin/ecschema-locaters package, the following example demonstrates how
to serialize the Schema to an XML file using the DOMParser and XMLSerializer interface from the
[@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) package. The [fs-extra](https://www.npmjs.com/package/fs-extra)
package is used to work with the file system.

```ts
[[include:Serialize_Schema_To_XML_Imports]]
```

First, you must have an instance of an [EC Schema](https://www.itwinjs.org/reference/ecschema-metadata/metadata/schema)
to serialize. The schema may be created, loaded from an iModel, or perhaps from an xml file on the file system. In this
sample we will be creating a new Schema using schema editing API available in the
[@itwin/ecschema-editing package](https://www.itwinjs.org/reference/ecschema-editing).

```ts
[[include:Serialize_Schema_To_XML_Create]]
```

Now that we have a schema to work with, create a new DOM XML document using the DOMParser. The
Document can then be passed to the Schema.toXml() method which returns the Document containing the schema XML.
We can then utilize the XMLSerializer interface to serialize the XML to a string.

```ts
[[include:Serialize_Schema_To_XML]]
```

We can now use the file system API to write the xml to file.

```ts
[[include:Serialize_Schema_To_XML_Write]]
```

## Schemas from an iModel

First use the [SchemaLoader]($ecschema-metadata) to create a SchemaContextEditor that knows about the schemas in the iModel

```ts
[[include:IModelSchemas.loadFromDb]]
```

Once an editor has been created the new schema can be created with classes that reference BisCore

```ts
[[include:IModelSchemas.editSchemas]]
```

Finally the new schema can be extracted from the editor, serialized to xml and imported into the iModel

```ts
[[include:IModelSchemas.importToIModel]]
```
