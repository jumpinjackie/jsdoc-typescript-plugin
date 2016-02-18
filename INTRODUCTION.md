# Introduction

The behavior of the jsdoc-typescript-plugin can be configured via a `typescript` configuration section in your JSDoc configuration file

For full configuration reference see [TBD]

# Customization features

In a perfect world, your meticulously written JSDoc should cleanly translate 1:1 to TypeScript.

In fact, should an invalid TypeScript definition be generated from your source by this plugin, it may reveal semantic and syntactic inconsistencies in your API documentation, so in a roundabout way this tool can also double as a validation tool for your JSDoc API documentation.

So with that being said, these customization features should be considered as a *last resort*, where possible you should try to fix the API documentation in the original source first before falling back to using any of these features.

## Type replacement

In the event that a reference to a type is emitted that actually has no definition due to spelling/typos, you can use the `typeReplacements` configuration property to specify a series of key/value pairs where the `key` is the type symbol to search for and the `value` is the type symbol to replace with.

For example consider the following code fragment

[TODO: Example bad code fragment]

Let's say you cannot fix this particular signature due to not having commit access to the original canonical source repository, you can define a type replacement like so:

[TODO: Configuration Example]

That will cause the emitted TypeScript signature for this function to be this:

[TODO: TS Function Example]

To this:

[TODO: TSFunction Example] 

## User-defined type injection

Your library may inadvertently make references to external third party types that that library uses. Or similarly, your API documentation may make references to function/callback types that may not have the appropriate `@callback` or `@typedef` annotations

If you generate a TypeScript definition from such a library, you will most likely get errors due to the plugin not being able to find a reference to this type to generate a type definition for it.

[TODO: Un-referenced callback type example]

In such cases you can use type injection to inject the missing types into the final TypeScript definition. There are two kinds of types you can inject:

 1. Type aliases
 2. Interfaces

If you do choose to use this feature, be sure to also add your user-defined type to the `ignoreTypes` list to ensure the plugin will skip over this type when processing to avoid accidental double-ups of emitted types.

## User-defined member overrides

Sometimes, the erroneous TypeScript fragment is not at the type level, but at the type member level. For example, introducing class inheritance may reveal semantic inconsitency in the generated output:

[TODO: TS class inheritance example]

In this case, you can avoid replacing the type entirely via the `memberReplacements` property and just replace the erroneous member with your own

## Custom header/footer

From the plugin's perspective, the anatomy of a TypeScript definition file that is generated is structured like so:

[TODO: ASCII diagram of d.ts structure]

The header and footer sections can contain whatever arbitrary content you choose, as long as the final merged definition is a syntactically valid TypeScript definition file.

You can can use this feature to provide fine-grained augmentations should the user-defined type injection prove unwieldy. Due to TypeScript supporting declaration merging, you do not have to worry about declaring the same module many times over.

Note that the plugin currently has no way to determine the type of module we are trying to generate a d.ts for, nor does it know exactly what types are exportable (a question this author poses to you is: Is there a way?)

You can use this feature to specify what parts of the generated TypeScript definition are to be exported onto the public API surface.

# Closure library annotations

If you use annotations provided by the Closure Library [TODO: Link], the plugin can light up support for extra features that are not available through standard JSDoc annotations

## Generics

## Function typedef rewriting