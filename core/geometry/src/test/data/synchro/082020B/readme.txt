syncrhomesh.json is data directly from a syncrho mesh.
The uv_params array has null entries.  This has domino effects in native readers.
polyface.json has a direct dump of a polyface that preserves the nulls
insertedMesh.json has .imjs style with the param array ended at the null.  The index array thus refers out of bounds.
The upper synchro directory may have existed on some prior push, then been deleted.   This seems to confuse linux.  Maybe its git does not match.