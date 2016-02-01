// http://usejsdoc.org/tags-lends.html
//Documented as instance methods

/** @class */
var Lends3Person = makeClass(
    /** @lends Lends3Person.prototype */
    {
        initialize: function(name) {
            this.name = name;
        },
        say: function(message) {
            return this.name + " says: " + message;
        }
    }
);
