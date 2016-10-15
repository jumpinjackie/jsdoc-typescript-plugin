var fs = require("fs");
var os = require("os");
var env = require("jsdoc/env");
var logger = require("jsdoc/util/logger");

// "Patch" the Observable and ModelResponse docs to declare the required template placeholder
exports.handlers = {
    beforeParse: function(e) {
        if (e.filename.indexOf("Observable.js") >= 0) {
            e.source = e.source.replace("@constructor Observable", "@constructor Observable\n * @template T");
        } else if (e.filename.indexOf("ModelResponse.js") >= 0) {
            e.source = e.source
                        .replace("@constructor ModelResponse", "@constructor ModelResponse\n * @template T")
                        .replace("@augments Observable", "@augments Observable.<T>")
        }
    }
};