//http://usejsdoc.org/howto-commonjs-modules.html
//Document a Module as a Constructor
//The following examples illustrate patterns for documenting modules that are constructors.
//Use the @alias tag simplify documenting a constructor-module in RequireJS.
/** 
 * A module representing a jacket.
 * @module jacket
 */
define('jacket', function () {
    /**
     * @constructor
     * @alias module:jacket
     */
    var exports = function() {
    }
    
    /** Open and close your Jacket. */
    exports.prototype.zip = function() {
    }
          
    return exports;
});
