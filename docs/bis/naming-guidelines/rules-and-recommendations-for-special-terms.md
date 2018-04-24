# Rules and Recommendation for Special Terms

This section contains rules and recommendations [rec.] related to special terms from the BIS upper ontology

## Model

 | |Description|Note|
|---|---|---|
| Rule | Model classes must always be suffixes with Model. | E.g. `FunctionalModel`, `PhysicalModel`<br><br>Exception: `Model1d`, `Model2d`, `Model3d`|
| Rec. | Model should be names based on what is being modeled or on what it contains what about perspective. | E.g. `BuildingModel` or `FloorsModel` or `Model2d` or a combination such as `Building2dFloorModel`<br><br><span style="color:red;font-weight:bold">We need more discussion on this waiting for input from Shaun</span>|



## Element

 | |Description|Note|
|---|---|---|
| Rule | Abstract terms should only appear higher in the inheritance hierarchy than concrete terms. | E.g. The term `Element` is used to suffix some abstract classes. Once `Element` is dropped from the name – because the class is concrete - it never comes back.<br><br>User-facing classes are normally concrete and we especially don’t want to add superfluous terms to those.<br><br>*See: [list of special terms](#standard-relationship-strengths-names)*|
| Rec. | User-facing classes should not be expressed in abstract terms | E.g. Don’t use `InformationElement` when you can use `Document` |



## Aspect

| |Description|Note|
|---|---|---|
| Rec. | Suffix with `Aspect` | | |



## Type

 | |Description|Note|
|---|---|---|
| Rec. | Use the term `Type` for real world types rather than Class or Kind | E.g. `FunctionalType` rather than `FunctionalClass` or `FunctionalKind` |




## Role

 | |Description|Note|
|---|---|---|
| Rec. | Don’t suffix with `Role` | E.g. `Resource`, `Asset` rather than `ResourceRole` and `AssetRole` |
