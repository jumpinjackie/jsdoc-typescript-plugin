var fs = require("fs");
var os = require("os");
var env = require("jsdoc/env");
var logger = require("jsdoc/util/logger");
var tsConf = env.conf.typescript || {};

exports.handlers = {
    newDoclet(e: TsdPlugin.IJsDocNewDocletEvent): void {
        if (tsConf.rewriteFunctionTypedefs === true) {
            TsdPlugin.FunctionTypedefRewriter.rewrite(e.doclet);
        }
    },
    processingComplete(e: TsdPlugin.IJsDocProcessingCompleteEvent): void {
        var proc = new TsdPlugin.TsdGenerator(tsConf);
        var sf = {
            createStream: (fileName) => fs.createWriteStream(fileName),
            readText: (fileName) => fs.readFileSync(fileName, "utf8"),
            endl: os.EOL
        };
        proc.process(e.doclets, sf, logger);
        //proc.dumpDoclets(e.doclets, sf);
    }
};
