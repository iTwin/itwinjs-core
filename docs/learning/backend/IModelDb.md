# Accessing local Briefcases via the IModelDb class

The [IModelDb]($backend) class class provides methods for opening, closing, and accessing a [briefcase](../Glossary.md#briefcase), that is, a local copy of an iModel. An instance of IModelDb in memory holds a briefcase file open.

An IModelDb is used by a service or by the backend of an iModelJs app.

Use [IModelDb.open]($backend) to obtain and open an IModelDb from iModelHub.

*Example*:
``` ts
[[include:IModelDb.open]]
```

Use [IModelDb.close]($backend) to close the local briefcase.