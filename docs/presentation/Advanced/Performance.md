# Performance Tips

The performance of the library heavily depends on how the presentation rules
are set up. The same result can usually be achieved in multiple ways, but
some of them are faster, and some are slower. Please try to follow the below
tips for better performance.

## Writing Presentation Rule Sets

- Define `RequiredSchemas` property for both rule sets and individual rules. 
That helps the library to filter-out uninteresting schemas
which may contain a lot of information and thus improves performance.
- Make rule specifications as specific as possible. Most specifications require
just part of information (e.g. the related class) and the library can find out
the rest (e.g. the relationship). However, that required additional resources.
- Avoid `IsRecursive=True` in content specifications, if possible. It has a huge
performance penalty and should only be used where absolutely necessary.

## ECExpressions in Rule Conditions

- The rules engine is able to optimize some [ECExpressions](./ECExpressions.md)
to improve their performance. Try using only the below symbols, if possible:
  - IsOfClass
  - IsInstanceNode
  - IsClassGroupingNode
  - IsPropertyGroupingNode
  - ClassName
  - InstanceId
- Avoid using [ECInstance symbols](./ECExpressions.md#ecinstance) where possible.
