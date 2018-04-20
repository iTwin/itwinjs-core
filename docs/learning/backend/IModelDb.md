# Accessing local Briefcases via IModelDb

A Briefcase if a local copy of an iModel. It is a local file.l Briefcase files have a ".bim" (briefcase of iModel) extension. The IModelDb class provides methods for opening, closing, and accessing Briefcases. An instance of IModelDb in memory holds a Briefcase file open.

Briefcases are obtained from iModelHub and are each assigned a unique Id called a BriefcaseId.

Briefcases are synchronized via ChangeSets.

IModelDb is defined in `@bentley/imodeljs-backend`.