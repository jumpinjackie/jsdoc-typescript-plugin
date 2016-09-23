module TsdPlugin {

    /**
     * Constants for different kinds of doclets
     */
    export class DocletKind {

        /**
         * Doclet for a function
         */
        public static get Function(): string { return "function"; }

        /**
         * Doclet for a typedef
         */
        public static get Typedef(): string { return "typedef"; }

        /**
         * Doclet for a class
         */
        public static get Class(): string { return "class"; }

        /**
         * Doclet for a member
         */
        public static get Member(): string { return "member"; }

        /**
         * Doclet for a property
         */
        public static get Value(): string { return "value"; }

        /**
         * Doclet for a module
         */
        public static get Module(): string { return "module"; }

        /**
         * Doclet for a constant
         */
        public static get Constant(): string { return "constant"; }
    }
}
