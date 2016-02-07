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

    /**
     * Defines the root plugin configuration section of the JSDoc configuration
     */
    export interface ITypeScriptPluginConfiguration {
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
        typeReplacements: { [key: string]: string; };
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
        ignoreTypes: Dictionary<string>;
    }
}