# Information Models and Elements

## Introduction

A BIS repository contains elements of many types.
PhysicalElements are used for modeling physical objects in the real world.
RoleElements are used for modeling roles or functions that an object could have.
InformationContentElements are used for modeling pure information.
BIS defines a set of InformationContentElement subclasses to further classify and specialize behavior for different types of information.

## Key Information Element Classes

<!-- TODO - add class hierarchy diagram -->

### InformationContentElement

InformationContentElement is an abstract base class for modeling pure information entities
Only the core framework should directly subclass from InformationContentElement.
Domain and application developers should start with the most appropriate subclass of InformationContentElement.

### InformationRecordElement

InformationRecordElement is an abstract base class for modeling information records.
InformationRecordElement is the default choice if no other subclass of InformationContentElement makes sense.
For example, importing a spreadsheet may cause InformationRecordElements to be created.

An InformationRecordElement is typically contained by an InformationRecordModel.

### DefinitionElement

A DefinitionElement holds configuration-related information that is meant to be shared.

DefinitionElement subclasses include:

- Category
- SubCategory
- RenderMaterial
- PhysicalMaterial
- AnnotationTextStyle
- LineStyle
- Texture
- ModelSelector
- CategorySelector
- DisplayStyle
- ViewDefinition
- GeometryPart

A DefinitionElement is always contained by a DefinitionModel.
A DefinitionModel can be used to collect together related definitions.

Example usages:

- A DefinitionModel per "catalog" where each DefinitionModel is correlated to a catalog and contains a DefinitionElement per catalog entry.
- A user could create a DefinitionModel to collect together project standards (styles, categories, etc.)
- A developer could create a private DefinitionModel to hold application or domain definitions and configuration settings.

### InformationPartitionElement

InformationPartitionElement is an abstract base class for elements that indicate that there is a new modeling perspective within the overall repository information hierarchy.
An InformationPartitionElement is always parented to a Subject and broken down by a Model.
An InformationPartitionElement is always contained by the RepositoryModel.

See [Information Hierarchy](./information-hierarchy.md) for more details.

### InformationReferenceElement

InformationReferenceElement is an abstract base class for modeling entities whose main purpose is to reference something else.
For example, any sort of hyperlink or grouping type of information.

InformationReferenceElement subclasses include:

- GroupInformationElement
- LinkElement
- Subject

#### GroupInformationElement

GroupInformationElement is an abstract base class for modeling entities whose main purpose is to reference a group of related elements.
For example, a DgnV8 named group is mapped onto a subclass of GroupInformationElement.

#### LinkElement

LinkElement is an abstract base class for modeling hyperlinks.

LinkElement base classes include:

- UrlLink
- RepositoryLink
- EmbeddedFileLink

#### Subject

Subjects are Elements that are used to identify things that the repository is about.
Subjects are logical references to those external things.

See [Information Hierarchy](./information-hierarchy.md) for more details.

### Document

A Document is a collection of information that is intended to be understood together as a whole.

Document subclasses include:

- Drawing
- Sheet

## Typical Models for Specific Information Elements

The following tables lists the Model types that typically contains specific subclasses of InformationContentElements:

| Element Class               | Model Class |
|-----------------------------|-------------|
| InformationRecordElement    | InformationRecordModel |
| DefinitionElement           | DefinitionModel |
| InformationPartitionElement | RepositoryModel |
| InformationReferenceElement | LinkModel or other InformationModel |
| GroupInformationElement     | GroupInformationModel |
| Document                    | DocumentListModel |

<!-- TODO:  mention *any model* rules for LinkElement and InformationRecordElement? -->

> Next: [Categories](./categories.md)