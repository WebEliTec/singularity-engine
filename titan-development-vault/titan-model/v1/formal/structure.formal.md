# Structure

## Concepts

World, EntityClass, Trait, AttributeOwner, Version, AttributeSetVersion, CompositionSchemeVersion, Attribute, CompositionDirective
LifeCycleStage ≡ {draft, committed}
DataType ≡ {text, richtext, email, url, tel, boolean, integer, float, date, time, datetimeLocal, json, unixTimestamp}

## Taxonomy

EntityClass ⊑ AttributeOwner
Trait ⊑ AttributeOwner
AttributeSetVersion ⊑ Version
CompositionSchemeVersion ⊑ Version

## Properties

EntityClass           ⊑ =1 id.ID ⊓ =1 singular.String ⊓ =1 plural.String ⊓ ≤1 description.String ⊓ ≤1 profileImgUrl.String
Trait                 ⊑ =1 id.ID ⊓ =1 label.String ⊓ ≤1 description.String
Version               ⊑ =1 version.Integer ⊓ =1 lifeCycleStage.LifeCycleStage
Attribute             ⊑ =1 id.ID ⊓ =1 label.String ⊓ =1 dataType.DataType ⊓ =1 isRequired.Boolean ⊓ ≤1 description.String
CompositionDirective  ⊑ =1 subClassId.ID ⊓ ≤1 traitId.ID ⊓ =1 description.String ⊓ ≤1 cardinalityRules.String

## Relations

hasEntityClass              : World [1] → [0..N] EntityClass
hasTrait                    : EntityClass [1] → [0..N] Trait
hasAttributeSetVersion      : AttributeOwner [1] → [0..N] AttributeSetVersion
hasCompositionSchemeVersion : EntityClass [1] → [0..N] CompositionSchemeVersion
hasAttribute                : AttributeSetVersion [1] → [0..N] Attribute
hasCompositionDirective     : CompositionSchemeVersion [1] → [0..N] CompositionDirective
