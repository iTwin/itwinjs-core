---
publish: false
---
# NextVersion

## Presentation

### Associating content items with given input

Sometimes there's a need to associate content items with given input. For example, when requesting child elements' content based on given parent keys, we may want to know which child element content item is related to which
given parent key. That information has been made available through [Item.inputKeys]($presentation-common) attribute. Because getting this information may be somewhat expensive and is needed only occasionally, it's only set
when content is requested with [ContentFlags.IncludeInputKeys]($presentation-common) flag.
