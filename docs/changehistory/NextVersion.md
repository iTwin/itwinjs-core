---
publish: false
---
# NextVersion

Table of contents:

- [Deprecations](#deprecations)
- [Presentation](#presentation)

## Deprecations

### @itwin/core-bentley

The AuthStatus enum has been removed. This enum has fallen out of use since the authorization refactor in 3.0.0, and is no longer a member of [BentleyError]($core-bentley).

### @itwin/core-mobile

IOSApp, IOSAppOpts, and AndroidApp have been removed in favor of [MobileApp]($core-mobile) and [MobileAppOpts]($core-mobile). Developers were previously discouraged from making direct use of [MobileApp]($core-mobile), which was a base class of the two platform specific mobile apps. This distinction has been removed, as the implementation of the two apps was the same. IOSAppOpts, now [MobileAppOpts]($core-mobile), is an extension of [NativeAppOpts]($core-frontend) with the added condition that an [AuthorizationClient]($core-common) is never provided.

IOSHost, IOSHostOpts, AndroidHost, and AndroidHostOpts have been removed in favor of [MobileHost]($core-mobile) for the same reasons described above.

## Presentation

### Relationship properties

Properties that are defined on [ECRelationshipClass](../bis/ec/ec-relationship-class.md) can now be included in content using newly added [`RelatedPropertiesSpecification.relationshipProperties`](../presentation/content/RelatedPropertiesSpecification.md#attribute-relationshipproperties) attribute.

When relationship properties are shown, or [`RelatedPropertiesSpecification.forceCreateRelationshipProperties`](../presentation/content/RelatedPropertiesSpecification.md#attribute-forcecreaterelationshipcategory) attribute is set to `true`, all information coming from that relationship, including related instance properties, will be organized within a category named after the relationship class.
