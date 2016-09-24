module TsdPlugin {

    /**
     * Constants for different kinds of doclets
     */
    export class DocletKind {

        /**
         * Doclet for a function
         */
        static Function = "function";

        /**
         * Doclet for a typedef
         */
        static Typedef = "typedef";

        /**
         * Doclet for a class
         */
        static Class = "class";

        /**
         * Doclet for a member
         */
        static Member = "member";

        /**
         * Doclet for a property
         */
        static Value = "value";

        /**
         * Doclet for a module
         */
        static Module = "module";

        /**
         * Doclet for a constant
         */
        static Constant = "constant";
    }
}
