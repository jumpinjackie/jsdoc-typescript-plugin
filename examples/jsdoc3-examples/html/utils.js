//http://usejsdoc.org/howto-commonjs-modules.html
//Document Multiple RequireJS Modules Defined in a Single File
//If you have multiple calls to define in a single file use the @exports tag to document each function that returns module code. Name the exported objects "exports" and JSDoc 3 will automatically document any of their members as members of their module.
//The getStyleProperty and isInHead methods are documented as members of the "html/utils" module. The Tag class is documented as a member of the "tag" module.
// one module
define('html/utils',
    /** 
     * Utility functions to ease working with DOM elements.
     * @exports html/utils
     */
    function() {
        var exports = {
            /** Get the value of a property on an element. */
            getStyleProperty: function(element, propertyName) { }
        };
        
        /** Determine if an element is in the document head. */
        exports.isInHead = function(element) { }
        
        return exports;
    }
);

// another module
define('tag',
    /** @exports tag */
    function() {
        var exports = {
            /** @class */
            Tag: function(tagName) { }
        };
        
        return exports;
    }
);

