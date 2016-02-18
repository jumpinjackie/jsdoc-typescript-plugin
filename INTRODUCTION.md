# Introduction

The behavior of the jsdoc-typescript-plugin can be configured via a `typescript` configuration section in your JSDoc configuration file

For full configuration reference see [TBD]

# Customization features

In a perfect world, your meticulously written JSDoc should cleanly translate to TypeScript.

In fact, should an invalid TypeScript definition be generated from your source by this plugin, it may reveal semantic and syntactic inconsistencies in your API documentation, so in a roundabout way this tool can also double as a validation tool for your JSDoc API documentation.

So with that being said, these customization features should be considered as a *last resort*, where possible you should try to fix the API documentation in the original source first before falling back to using any of these features.

## Type replacement

In the event that a reference to a type is emitted that actually has no definition due to spelling/typos, you can use the `typeReplacements` configuration property to specify a series of key/value pairs where the `key` is the type symbol to search for and the `value` is the type symbol to replace with.

For example consider the following code fragment

    declare class Foo {
        /**
         * Returns the HTML image element for this instance
         */
        getSource(): Image; // <====== Error: Cannot find name 'Image'
    }

Let's say that the type `Image` could not be found by the plugin (because what you really meant was `HTMLImageElement`). Let's also say you cannot fix this particular signature due to not having commit 
access to the original canonical source repository to make this documentation/code fix. In such cases you can define a type replacement like so:

    "typescript": {
        "typeReplacements": {
            "Image": "HTMLImageElement"
        }
    }

That will cause the emitted TypeScript signature for this function to become this:

    declare class Foo {
        /**
         * Returns the HTML image element for this instance
         */
        getSource(): HTMLImageElement;
    }

## User-defined type injection

Your library may inadvertently make references to external third party types that that library uses. Or similarly, your API documentation may make references to function/callback types that may not have the appropriate `@callback` or `@typedef` annotations

If you generate a TypeScript definition from such a library, you will most likely get errors due to the plugin not being able to find a reference to this type to generate a type definition for it.

    declare class Foo {
        process(cb: CallbackFunc): void; // <====== Error: Cannot find name 'CallbackFunc'
    }

In such cases you can use type injection to inject the missing types into the final TypeScript definition. There are two kinds of types you can inject:

 1. Type aliases
 2. Interfaces

To fix the above example, you could add `CallbackFunc` as a user-defined type alias

    "typescript": {
        "aliases": {
            "global": {
                "CallbackFunc": "(args: string) => void"
            }
        }
    }

Which will instruct the plugin to emit this declaration to resolve the unknown type:

    declare type CallbackFunc = (args: string) => void;

## User-defined type injection as a replacement mechanism

If we take the above example again, but this time the `CallbackFunc` type exists, but is actually not defined to something we're expecting `(args: string) => void`

In this case, we add the same user-defined type alias as before, but also you have to make sure to also add your user-defined 
type to the `ignore` list to ensure the plugin will skip over this type (giving your user-injected type precedence) when 
processing to avoid accidental double-ups of emitted types.

    "typescript": {
        "ignore": [
            "CallbackFunc"
        ]
    }

## User-defined member overrides

Sometimes, the erroneous TypeScript fragment is not at the type level, but at the type member level. 

For example, introducing class inheritance may reveal semantic inconsitencies in the generated output:

    ...
    
    declare class Foo {
        getSource(): FooSource;
    }
    declare class Bar extends Foo {
        getSource(): BarSource; // <====== Example error:
    }                           // Class 'Bar' incorrectly extends base class 
                                // 'Foo'. Types of property 'getSource' are 
                                // incompatible.


In this case, you can avoid replacing the type entirely via the `memberReplacements` property and just replace the erroneous member with your own

    "typescript": {
        "memberReplacements": {
            "Bar#getSource": {
                "description": "Return the associated source (NOTE: TypeScript currently prevents us from returning the intended type of BarSource, you will have to manually cast the returned value to this type)",
                "declaration": "getSource(): any;"
            }
        }
    }

This will "patch" the `getSource` method of `Bar` to be like this

    declare class Bar extends Foo {
        /**
         * Return the associated source (NOTE: TypeScript currently prevents us from returning the intended type of BarSource, you will have to manually cast the returned value to this type)
         */
        getSource(): any; 
    } 

## Custom header/footer

From the plugin's perspective, the anatomy of a TypeScript definition file that is generated is structured like so:

    mymodule.d.ts
    |-------------------------------------------|
    | Custom header content (if specified)      |
    |-------------------------------------------|
    | Auto-generated TypeScript Definition body |
    |-------------------------------------------|
    | Custom footer content (if specified)      |
    |-------------------------------------------| 

The header and footer sections can contain whatever arbitrary content you choose, as long as the final merged definition is a syntactically valid TypeScript definition file.

You can can use this feature to provide fine-grained augmentations should the user-defined type injection prove unwieldy. Due to TypeScript supporting declaration merging, you do not have to worry about declaring the same module many times over.

Note that the plugin currently has no way to determine the type of module we are trying to generate a d.ts for, nor does it know exactly what types are exportable (a question this author poses to you is: Is there a way?)

You can use this feature to specify what parts of the generated TypeScript definition are to be exported onto the public API surface.

# Closure library annotations

If you use annotations provided by the [Closure Compiler](https://developers.google.com/closure/compiler/), the plugin can light up support for extra features that are not available through standard JSDoc annotations

## Generics

If `@template` is found, the plugin will do the following:

 * If applied to a class, it will append the placeholder as part of the class name
 * If applied to a class member function, it will append the placeholder as part of the method signature

For example, the following JS fragment:

    /**
     * @constructor
     * @classdesc 
     * A generic class
     * @template T
     */
    Foo = function() { };
    
    /**
     * @description Another generic method
     * @template TArg
     * @param {T} arg The class generic type
     * @param {TArg} arg2 An argument of a generic type
     * @return {string} A string value
     */
    Foo.prototype.setBar = function(arg, arg2) { };

Will emit the following TypeScript:

    /**
     * A generic class
     */
    declare class Foo<T> {
        /**
         * Another generic method
         * @param arg  (Required) The class generic type
         * @param arg2  (Required) An argument of a generic type
         */
        setBar<TArg>(arg: T, arg2: TArg): string;
    }

## Function typedef rewriting

Function types are normally defined using `@callback`. Such function types will properly translate to their TypeScript counterparts:

    //JavaScript
    /**
     * This callback is displayed as part of the Requester class.
     * @callback CallbackFunc
     * @param {number} responseCode
     * @param {string} responseMessage
     * @return {boolean}
     */

    //TypeScript
    /**
     * This callback is displayed as part of the Requester class.
     */
    declare type CallbackFunc = (responseCode: number, responseMessage: string) => boolean;

However, the use of `@callback` is not recognised by the Closure compiler, which expects such function types to be annotated with `@typedef` like so:

    /**
     * A function that takes a string and returns a number
     * @typedef {function(string): number}
     */
    var FooFunction;

By default, such typedefs will be aliased to plain `Function`

    /**
     * A function that takes a string and returns a number
     */
    declare type FooFunction = Function;

Setting the `rewriteFunctionTypedefs` property to `true` will activate function typedef rewriting, which will add an extra processor in the 
JSDoc pipeline to rewrite function typedef doclets into a callback form, that allows the plugin to emit function typedefs like this:

    /**
     * A function that takes a string and returns a number
     */
    declare type FooFunction = (arg0: string) => number;

Notice the `arg0` name. Because function typedefs do not carry argument descriptions we use a generic `arg0..n` naming format for any arguments encountered. So
where possible, `@callback` is strongly preferred over `@typedef` for documenting function types.