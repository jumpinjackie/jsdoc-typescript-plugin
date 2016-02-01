//http://usejsdoc.org/about-namepaths.html
//Namepaths of objects with special characters in the name.
/** @namespace */
var namepath3chat = {
    /**
     * Refer to this by {@link namepath3."#channel"}.
     * @namespace
     */
    "#channel": {
        /**
         * Refer to this by {@link namepath3."#channel".open}.
         * @type {boolean}
         * @defaultvalue
         */
        open: true,
        /**
         * Internal quotes have to be escaped by backslash. This is
         * {@link namepath3."#channel"."say-\"hello\""}.
         */
        'say-"hello"': function (msg) {}
    }
};

/**
 * Now we define an event in our {@link namepath3."#channel"} namespace.
 * @event namepath3."#channel"."op:announce-motd"
 */
