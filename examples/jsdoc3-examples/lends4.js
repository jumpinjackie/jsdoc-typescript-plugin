// http://usejsdoc.org/tags-lends.html
//Documented with a constructor

var Lends4Person = makeClass(
    /** @lends Lends4Person.prototype */
    {
        /** @constructs */
        initialize: function(name) {
            this.name = name;
        },
        say: function(message) {
            return this.name + " says: " + message;
        }
    }
);

