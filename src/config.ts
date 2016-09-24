module TsdPlugin {
    /**
     * Alias for a dictionary keyed on strings
     */
    export type Dictionary<TValue> = { [key: string]: TValue; };

    /**
     * Allows a user to inject additional TS code elements at the global or module levels. Code element injection allows one to "plug the holes"
     * in a generated typescript definition if unknown/unresolved types appear in the typescript definition.
     * 
     * Code element injection should only be the last resort. The first port of call should be to fix the API visibility of the affected types
     * in the original documented source.
     */
    export interface IUserOverride<TConf> {

        /**
         * Overrides for the global namespace. Keys are the actual type 
         * names for which the configuration applies to 
         */
        global: Dictionary<TConf>;

        /**
         * Overrides for specific modules. 1st level keys are module names.
         * 2nd level keys are the actual type names for which the configuration
         * applies to
         */
        module: Dictionary<Dictionary<TConf>>;
    }
    
    export interface IMemberDeclaration {

        /**
         * Documentation to attach to the declaration
         */
        description?: string;

        /**
         * The actual declaration
         */
        declaration: string;
    }
    
    export type PrimitiveType = "string" | "number";
    
    export interface IEnumConfiguration {

        /**
         * The list of identifiers in their original JSDoc format to process as class-like enums. Such 
         * enums are basically classes with static constant members. Any references to this enum class 
         * will be replaced with its underlying integral type (generally number|string)
         */
        classes: Dictionary<PrimitiveType>;

        /**
         * The list of identifiers to process as native enums.
         */
        //native: string[];
    }

    /**
     * Defines the root plugin configuration section of the JSDoc configuration
     */
    export interface IPluginConfig {

        /**
         * The name of the TypeScript definition file
         */
        rootModuleName: string;

        /**
         * The directory where the TypeScript definition file will be saved to
         */
        outDir: string;

        /**
         * A list of key/value pairs indicating JSDoc types and their TypeScript replacements
         */
        typeReplacements: Dictionary<string>;

        /**
         * Default constructor description to generate for each emited class constructor when
         * description does not exist. Include the %TYPENAME% special token to have it be replaced
         * with the name of the emitted class
         */
        defaultCtorDesc: string;

        /**
         * If set to true, emitted types that have no documentation will have TODO boilerplate
         * documentation in their place, as a friendly reminder to the library author to probably
         * document this particular API
         */
        fillUndocumentedDoclets: boolean;

        /**
         * If set to true, raw JSDoc doclets are emitted (in comments) along with each emitted type
         * for debugging purposes.
         */
        outputDocletDefs: boolean;

        /**
         * User-defined type aliases
         */
        aliases: IUserOverride<string>;

        /**
         * User-defined interface definitions
         */
        interfaces: IUserOverride<string[]>;

        /**
         * An annotation that if found in a parsed doclet, will consider said doclet to be
         * part of the public API, and any resulting emitted type to be made public as well
         * 
         * Otherwise, a doclet is considered public if its access is not private
         */
        publicAnnotation: string;

        /**
         * For methods where the return type is not specified, the configured value will be
         * used instead. By default, methods without a return type will default to 'any'
         */
        defaultReturnType: string;

        /**
         * If you have provided custom interfaces and type aliases, the types may double
         * up in the TSD file if public doclets for types of the same name are encountered.
         * 
         * You can avoid double-ups by specifying types to ignore in this list. Such doclets
         * will be ignored, giving precedence to your user-defined aliases and interfaces.
         */
        ignoreTypes: string[];

        /**
         * A list of types to always make public. Add types here if you are manually defining types in a
         * custom header or footer and those types reference types that may not be public when the 
         * source is processed by the plugin
         */
        makePublic: string[];

        /**
         * Path to custom header content file to add to the top of the generated TypeScript definition file
         */
        headerFile: string;

        /**
         * Path to custom footer content file to add to the bottom of the generated TypeScript definition file
         */
        footerFile: string;

        /**
         * Member overrides to replace any generated members. Key is the JsDoc longname (ie. qualifiedClassName#memberName)
         * Value is the replacement for it
         */
        memberReplacements: Dictionary<IMemberDeclaration>;

        /**
         * Indicates if top-level elements (ie: doclets without parents) should be declared. Default is false, set to true 
         * if you wrap the emitted types around a custom top-level module through the custom header/footer feature 
         */
        declareTopLevelElements: boolean;

        /**
         * A list of modules to ignore (without the module: prefix), any member under this module will be ignored
         */
        ignoreModules: string[];

        /**
         * Indicates if doclets with undocumented = true should be skipped or not. Default is false.
         */
        skipUndocumentedDoclets: boolean;

        /**
         * Sets the initial indentation level. Each level starts indentation by one "tab" (4 spaces)
         */
        initialIndentation: number;

        /**
         * Any module on this list, for any types found under it, will be added to the global namespace instead
         */
        globalModuleAliases?: string[];

        /**
         * Controls whether to use TS 1.8 string union types for any string enums
         */
        useUnionTypeForStringEnum?: boolean;

        /**
         * Used to instruct the plugin to configure the given types as enums regardless of what the processed doclet may suggest it is
         */
        processAsEnums?: IEnumConfiguration;
    }
}
