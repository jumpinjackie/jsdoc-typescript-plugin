//http://usejsdoc.org/tags-alias.html
//Using @alias for an object literal

// Documenting Alias3objectA with @alias

var Alias3objectA = (function() {

    /**
     * Documented as Alias3objectA
     * @alias Alias3objectA
     * @namespace
     */
    var x = {
        /**
         * Documented as Alias3objectA.myProperty
         * @member
         */
        myProperty: 'foo'
    };

    return x;
})();

// Documenting Alias3objectB with @lends

/**
 * Documented as Alias3objectB
 * @namespace
 */
var Alias3objectB = (function() {

    /** @lends Alias3objectB */
    var x = {
        /**
         * Documented as Alias3objectB.myProperty
         * @member
         */
        myProperty: 'bar'
    };

    return x;
})();
