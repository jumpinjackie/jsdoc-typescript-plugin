/**
 * @constructor
 */
function ClassWithOptionProperty() {
    /**
     * Name
     * @type {String}
     */
    this.name = "Foobar";
    /**
     * Foo
     * @type {Object}
     */
    this.foo = {
        /**
         * Bar of Foo
         * @memberof! ClassWithOptionProperty#
         * @type {string}
         * @property foo.bar
         */
        bar: "Whatever",
        /**
         * Foo of Foo
         * @memberof! ClassWithOptionProperty#
         * @type {number}
         * @property foo.foo
         */
        foo: 1234
    };
}