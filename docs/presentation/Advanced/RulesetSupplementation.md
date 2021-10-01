# Ruleset Supplementation

Process of creating a single merged ruleset from multiple rulesets is called
ruleset supplementation.

The purpose of supplementation is to hand over some parts of ruleset creation to
others. One of the examples could be domains delivering supplemental rulesets
with customization rules for their data. Then applications' rulesets get supplemented
with those customization rules and final ruleset that's used has both -
application-provided rules and domain-provided customization rules.

## Supplementation algorithm

1. Find the primary ruleset
2. Find all supplemental rulesets with the same `id`. There can be multiple
supplemental rulesets with the same `id`, but then they should be unique by
`supplementationPurpose`. If that property also matches, the first supplemental
ruleset with matching `id` is used.
3. Clone primary ruleset and merge in all rules from supplemental rulesets.
