# Rules and Recommendations

The following rules and recommendations [rec.] should be honored when devising BIS names. This include Domain, Schema, Namespace, Class and Properties names as well as aliases.

*NOTE: The items below are not ordered by importance but rather around related concepts.*

## General

_BIS naming convention is deliberately more restrictive than EC naming: All BIS names are valid EC names but not all EC names are valid BIS names._

|   | Description | Note |
|---|-------------|------|
| Rule | Only use alphanumeric characters | |
| Rule | Do not use an underbars in names | Don't use underbars even if it aids readability: Use `OrderLineItem` not `Order_LineItem`|
| Rule | Names may not start with a number | E.g. `3dGeometry` is not allowed |
| Rule |  Names may not differ only by case | E.g. If there's already a name called `Pricelist` then you may not define a new one called `PriceList` |
| Rule | Use PascalCase names | PascalCase means words are concatenated with the first letter of each word capitalized. E.g. `OrderLineItem` |
| Rule | Use United States Spelling | E.g. `Organization` not `Organisation` |
| Rec. | Use the most widely accepted and descriptive name possible | Consult the current thesaurus before creating new words. |
| Rec. | Use a single word that describes the entity | E.g. `Person` rather than `HumanBeing` |
| Rule | Don't add superfluous terms | Don't use two nouns if one can equally express its meaning.<br><br>E.g. `Vehicle` rather than `TransportationVehicle`.<br><br>For relationships we can often infer the type of target from the name of the source. So, use `PhysicalElementIsOfType` rather than `PhysicalElementIsOfPhysicalType` (because the element cannot be of any type other than Physical!)|
| Rec. | Do not add any unnecessary prefixes or suffixes to an entity | Especially terms like `Object`, `Instance`, `Entity`, and `Property`.<br><br>E.g. Use `Note` not `NoteEntity` (for a class name) or `NoteProperty` (for a property name). |
| Rec. | Words should be less than 30 characters | |
| Rec. | Use abbreviations and acronyms with care | Use abbreviations and acronyms only where they are common and completely unambiguous. If the abbreviation/acronym is not well known, don't use it!<br><br>Try to limit the use to those that appear in the list of [abbreviations and acronyms](#abbreviations-and-acronyms) and don't use those listed in the "don't use" section.<br><br>Two letter acronyms have both letters capitalized, provided that each letter represents a different word.<br><br>E.g. `UI` ("User Interface") and `IO` ("Input/Output") because both words are capitalized, but `Db` because "Database" is _one compound word._<br><br>Three or more letter acronyms have only the first letter in capital case.<br><br>E.g. `Html` or `Guid`<br><br>Abbreviations of a single word have only the first letter in capital case.<br><br>E.g. `Id` ("Identification") |
| Rec. | Use numbers with care | Avoid names such as `One21` and `Door2Door`<br><br>A well-known exception is for terms `1d`, `2d`, and `3d` (dimensions). These may be used to form new terms provided they don't break the rule stating that [Names may not start with a number](#names-may-not-start-with-a-number).<br><br>E.g.Acceptable names are `Spatial1d`, `Model2d` |
| Rec. | Use special words with care. | Specifically, make sure that the semantic meaning of the special term is well understood._<br><br>E.g.`List`, `Item`, `Set`, etc...<br><br>_See [list of special terms](#list-of-special-terms)_<br><br>If it isn't an `Aspect`, don't put `Aspect` in the name. |
| Rule | Do not use New, Old, Tmp, or Temp | What seems "new" when you do it will become "old" when you make the next change. |
| Rec. | Avoid the use of 'Base' in class names | E.g. use `RasterModel` instead of `RasterBaseModel` |
| Rec. | Avoid using the organization's name | If prefixes are needed, give preference to the domain rather than the organization.<br><br>E.g. Use `TransportElement` rather than `ExorElement` |
| Rec. | Avoid using product names | E.g. Avoid prefixes like `eB`, `OpenPlant`, `STAAD`, `Dgn`, `ConnectedProject` |
| Rec. | Avoid domain names in the term | E.g. `PlanningElement`, `ConceptualElement`, `PlantElement`, `PlantArea`, and `Area` |
| Rec. | Avoid using version numbers or generation names |E.g. `V8iFile` |
| Rec. | Favor instances over definitions | I.e. if you need to distinguish between an Entity Definition and an Entity Instance and there are no suitable words that can distinguish them, suffix the definition rather than the instance: user will work with instance more often than definitions_<br><br>E.g. Use `AttributeDefinition` for the definition and `Attribute` for the value.<br><br>**Note:** The ECProperty is an example where this recommendation is not being followed. There are no plans to change that - Sorry. |

## ECSchema / BIS Domain Names

|   | Description | Note |
|---|-------------|------|
| Rule | All EcSchema/BIS Domain Names must be registered with BIS workgroup to avoid conflicts.<br>This includes the aliases. |E.g. `BisCore` (schema name) and `bis`<br><br>See [list of BIS Schemas](../../domains/index.md) |
| Rule | BIS Schema aliases must be in lowercase | |
| Rule | BIS Schema aliases must be less than 7 characters long | |

## Class

|   | Description | Note |
|---|-------------|------|
| Rule | Use singular form | E.g. `File` not `Files`|
| Rule | When combining terms, arrange them in increasing order of significance|E.g. `CableCar`, `AnalogWaterMeter`<br><br>**Exceptions:** `2d` and `3d` because names can't start with numerals |
| Rec. | Names of direct or indirect specializations of `bis:ElementAspect` should end with `Aspect`.|
| Rec. | Do not use prepositions such as `Of`, `With`, `On`, `An`, `In`, `From`, etc... | |

## Property (including “Navigation” Properties)

|   | Description | Note |
|---|-------------|------|
| Rule | Use the plural form of the name when the attribute is a collection, otherwise use the singular form. | `Document.AddedBy` (a document can be added by a single person) but can have many notes, so `Document.Notes` |
| Rec. | Try to create attributes with the same name as their underlying type | `Document.Lock` is of type `Lock`<br><br>**Exception:** When the entity has more than on attribute of that type, or when it aids in readability: `Document.AddedBy` instead of `Document.Person` |
| Rec. | Don't include the primitive datatype (int, string) with the name | **Exception:** Dates. Since `Date` is both a data type and a more meaningful noun, something like `DateAdded` would be acceptable but `NoteBlob` would not be. |
| Rule | Don't include the attribute owner name in the attribute name | E.g. `Document.Id` not `Document.DocumentId` and `Person.Name` not `Person.PersonName` |
| Rule | Prefix Boolean names with `Is`, `Has`, `Can`, `May` | E.g. `IsUnderChange`, `HasOtherRevision`, `MayChange` |
| Rule | When the field represents a bit mask, use the plural form of the word|E.g. `StateHints`, `HasFlags` |
| Rule | For `NavigationProperties`, prefer to use the name of the related `ECClass` as the property name | If further qualification is needed, consider prefixing words from the role label. |

## Relationship

Relationship naming rules are difficult because of competing concerns.
It is important for relationship class names to be clear and unambiguous so that the purpose and constraints of the relationship can be understood.
However, it is also important to be cognizant of the number of characters in the relationship class name since that is what a developer or power user will have to type in when using ECSQL.
Names that are too long are frustrating, but vague names are also frustrating.
The rules and recommendations below try to balance these concerns:

|   | Description | Note |
|---|-------------|------|
| Rule | **Use Source-Verb-Target** | E.g. `ElementOwnsUniqueAspects`, `OrganizationSellsProducts`<br><br>In most cases, the "source/target" will simply be the name of the object. In those cases, the addition of an adjective can be helpful: `Child` in `ElementOwnsChildElements` |
| Rule | **Fully specify the source constraint**<br>In general, use the full class name of the source constraint for the *source* portion of the relationship name. In some cases, the suffix of the source constraint class name can be dropped if it doesn't help with understanding the purpose of the relationship. | E.g. "`PhysicalElement`IsOfType", "`PhysicalSystem`ServicesElements" |
| Rule | **Try to use a specific action-oriented verb**<br>Verbs like *aggregates*, *holds*, *groups*, *represents*, *services* are more action-oriented while verbs like *has* or *relates to* are more passive and don't identify the purpose of the relationship. | E.g. "DrawingGraphic`Represents`Element", "PhysicalElement`Services`Elements" |
| Rule | **Use verbs that are consistent with relationship strength** | - `Owns`, `Contains`, or `Aggregates` implies *embedding*<br>- `Represents` or `Groups` implies *referencing*<br><br>See list of [relationship strengths](./standard-relationship-strengths-names.md) |
| Rule | **Shorten the target portion if possible**<br>Use the *role* within the relationship or a shortened form of the target constraint class. | E.g. "PhysicalElementIsOf`Type`"<br><br>In this case, fully specifying the target constraint of `PhysicalType` would make the relationship class name longer without adding much clarity since the source constraint gives a strong hint as to the target constraint. |
| Rule | **The relationship name should indicate the multiplicity**<br>The source is always singular and the target indicates multiplicity. | E.g. `ElementOwnsChildElements` (1:N), `ElementHasLinks` (N:N), `PhysicalElementIsOfType` (N:1) |
| Rule | **Don't use conjunctions**<br>  Do not use a singular noun or verb, even if it clearly defines a relationship. Always use noun-verb-noun | E.g. Don't use `Marriage` or `ManAndWoman`; use `PersonIsMarriedToPerson` |

## Enumeration

|   | Description | Note |
|---|-------------|------|
| Rec. | In general, use descriptive names with no postfix. | E.g. `SurfaceVariation`, `CoordinateSystem` or `ExternalSourceAttachmentRole`. |
