//http://usejsdoc.org/tags-alias.html
//Using @alias for static members of a namespace

/** @namespace */
var Alias2Apple = {};

(function(ns) {
    /**
     * @namespace
     * @alias Alias2Apple.Core
     */
    var core = {};

    /** Documented as Alias2Apple.Core.seed */
    core.seed = function() {};

    ns.Core = core;
})(Alias2Apple);
