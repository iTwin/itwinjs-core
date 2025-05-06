# Metadata packages in the iTwin.js Library

The metadata packages implement the abstract concepts of EC in typescript [EC overview](../../bis/ec/index.md)
The following packages exist:

- ($ecschema-metadata) is the basic package that exposes metadata objects.
- ($ecschema-editing) Since the basic package only implements an API for understanding schemas, this package adds editing on top of it.
- ($ecschema-locaters) contains classes for locating and loading EC schema files from the file system.
- ($ecschema-rpc) provides a schema RPC interface implementation

