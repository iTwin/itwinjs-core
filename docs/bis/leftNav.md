## Base Infrastructure Schemas (BIS)

### Guide

<div id="guide-list">

#### Introduction
- [Overview](./guide/intro/overview.md)
- [Federated Digital Twins](./guide/intro/federated-digital-twins.md)
- [Modeling with BIS](./guide/intro/modeling-with-bis.md)
- [Organization of BIS](./guide/intro/bis-organization.md)
- [Fabric of the Universe](./guide/intro/fabric-of-the-universe.md)

#### Fundamentals
- [Element Fundamentals](./guide/fundamentals/element-fundamentals.md)
- [Codes](./guide/fundamentals/codes.md)
- [ElementAspect Fundamentals](./guide/fundamentals/elementaspect-fundamentals.md)
- [Mixins](./guide/fundamentals/mixins.md)
- [Model Fundamentals](./guide/fundamentals/model-fundamentals.md)
- [Relationship Fundamentals](./guide/fundamentals/relationship-fundamentals.md)
- [Schemas (“Domains”)](./guide/fundamentals/schemas-domains.md)
- [Classifying Elements](./guide/fundamentals/data-classification.md)
- [Type Definitions](./guide/fundamentals/type-definitions.md)
- [Categories](./guide/fundamentals/categories.md)

#### Data Organization
- [Information Hierarchy](./guide/data-organization/information-hierarchy.md)
- [Modeling Perspectives](./guide/data-organization/modeling-perspectives.md)
- [Top of the World](./guide/data-organization/top-of-the-world.md)
- [Single Responsible-Party Principle](./guide/data-organization/srpp.md)
- [Organizing Models and Elements](./guide/data-organization/organizing-models-and-elements.md)
- [Spatial Composition](./guide/data-organization/spatial-composition.md)
- [Modeling Systems](./guide/data-organization/modeling-systems.md)
- [Organizing Definition Elements](./guide/data-organization/organizing-definition-elements.md)

#### Physical Modeling Perspective
- [3D Guidance](./guide/physical-perspective/3d-guidance.md)
- [PhysicalModel Hierarchy](./guide/physical-perspective/physical-hierarchy-organization.md)
- [Physical Models and Elements](./guide/physical-perspective/physical-models-and-elements.md)
- [Physical Materials](./guide/physical-perspective/physical-materials.md)
- [Quantity Takeoffs: Guidelines](./guide/physical-perspective/qto-guidelines.md)

#### Other Modeling Perspectives
- [Functional Models and Elements](./guide/other-perspectives/functional-models-and-elements.md)
- [Analysis Models and Elements](./guide/other-perspectives/analysis-models-and-elements.md)
- [Information Models and Elements](./guide/other-perspectives/information-models-and-elements.md)

#### Schema Evolution
- [Schema Customization](./guide/schema-evolution/schema-customization.md)
- [Data Evolution Across Time](./guide/schema-evolution/data-evolution-across-time.md)
- [Schema Versioning](./guide/schema-evolution/schema-versioning-and-generations.md)
- [Schema Production Status](./guide/schema-evolution/schema-production-status.md)
- [Schema Design Guidelines](./guide/schema-evolution/schema-design-guidelines.md)

#### BIS Naming Guidelines

- [Rules and Recommendations](./guide/naming-guidelines/rules-and-recommendations.md)
- [Special Terms](./guide/naming-guidelines/special-terms.md)
- [Summary of Exceptions](./guide/naming-guidelines/summary-of-exceptions.md)
- [Abbreviations and Acronyms](./guide/naming-guidelines/standard-abbreviations-and-acronyms.md)
- [Relationship “Strengths”](./guide/naming-guidelines/standard-relationship-strengths-names.md)

#### Other topics
- [BIS Schema Units](./guide/other-topics/units.md)
- [BIS Schema KindOfQuantities](./guide/other-topics/kindOfQuantities.md)
- [BIS Schema Validation](./guide/other-topics/bis-schema-validation.md)

#### References
- [BIS Glossary](./guide/references/glossary.md)
- [Class-diagram Conventions](./guide/references/class-diagram-conventions.md)
- [Instance-diagram Conventions](./guide/references/instance-diagram-conventions.md)

</div>

&nbsp;

### Domain Schemas
- [Overview](./domains/index.md)
- [Core domains](./domains/core-domains.md)
- [Common domains](./domains/common-domains.md)
- [Discipline-Physical domains](./domains/discipline-physical-domains.md)
- [Discipline-Other domains](./domains/discipline-other-domains.md)

&nbsp;

### Engineering Content (EC)

- [Overview](./ec/index.md)
- [ECSchema](./ec/ec-schema.md)
- [ECClass](./ec/ec-class.md)
- [ECEntityClass](./ec/ec-entity-class.md)
- [ECMixinClass](./ec/ec-mixin-class.md)
- [ECStructClass](./ec/ec-struct-class.md)
- [ECCustomAttributeClass](./ec/ec-custom-attribute-class.md)
- [ECRelationshipClass](./ec/ec-relationship-class.md)
- [ECProperty](./ec/ec-property.md)
- [ECCustomAttributes](./ec/ec-custom-attributes.md)
- [ECEnumeration](./ec/ec-enumeration.md)
- [KindOfQuantity](./ec/kindofQuantity.md)
- [PropertyCategory](./ec/property-category.md)
- [PrimitiveTypes](./ec/primitive-types.md)
- [CustomAttribute Container Types](./ec/customattribute-container-types.md)
- [Unit](./ec/ec-unit.md)
- [Constant](./ec/ec-constant.md)
- [Phenomenon](./ec/ec-phenomenon.md)
- [UnitSystem](./ec/ec-unitsystem.md)
- [Format](./ec/ec-format.md)
- [ECName](./ec/ec-name.md)
- [Changes Between ECObjects 2 and 3](./ec/differences-between-ec2-and-ec3.md)

<script>
$("#guide").append(function () {
return "<i class='icon icon-chevron-up collapse-arrow is-expanded' id='guide-carat'></i>"
}).on('click', '.collapse-arrow', function (event) {
var target = $(event.target);
if (target.is("i")) {
$('#guide-list').slideToggle()
}
});
</script>
<style>
.h-bis-naming-guidelines {
font-size: 15px;
}
</style>