# Organizing Repository-global Definition Elements

Instances of [DefinitionElement](../glossary.md#DefinitionElement) hold configuration-related information that is meant to be referenced and shared. They are expected to be contained in `DefinitionModel`s as explained in [Model Fundamentals](../fundamentals/model-fundamentals.md).

Examples of `DefinitionElement`s include instances of:

* `Category` and `Subcategory`
* `TypeDefinitionElement`
* `RenderMaterial`
* `PhysicalMaterial`
* `LineStyle`
* etc.

In some cases, one or more iModel data writers have the need to coordinate the sharing of the same `DefinitionElement`s among themselves, in light of a single iModel. This need is typically the result of data-alignment efforts in a BIS Domain. In those cases, a BIS Domain may standardize some of its concepts in terms of particular instances of its own `DefinitionElement` subclasses.

Consequently, BIS defines a strategy for anyone to be able to locate any repository-global `DefinitionElement`s in an iModel. The [DictionaryModel](../glossary.md#DictionaryModel) addresses such need.

## The DictionaryModel

The `DictionaryModel` is a singleton container for repository-global `DefinitionElement` instances. It can be accessed via a `DefinitionPartition` with code 'BisCore.DictionaryModel' always created as a child of the root `Subject` of an iModel.

Storing `DefinitionElement`s directly on the `DictionaryModel` may face *Code* collision problems. It is recommended that `DefinitionElement`s are instead organized in submodels of `DefinitionContainer`s.

Any repository-global `DefinitionElement`s introduced by a BIS Domain are expected to be organized in a submodel of `DefinitionContainer` instance, identified by the BIS Domain's schema alias, followed by the ':DomainDefinitions' suffix on their *Code*s.

Standardized `DomainElement` instances within those `DefinitionContainer` submodels are also expected to carry their BIS Domain's schema alias as prefix on their *Code*s.

&nbsp;
![Repository-Global DefinitionElements](../media/repository-global-definitions.png)
&nbsp;

Application schemas, as explained in [BIS Organization](../intro/bis-organization.md), shall contain no data that other Application schemas need or want to access. Therefore, Application-specific `DefinitionElement`s shall be stored in a model-hierarchy different than the `DictionaryModel`'s.

---
| Next: [3D Guidance](../physical-perspective/3d-guidance.md)
|:---
