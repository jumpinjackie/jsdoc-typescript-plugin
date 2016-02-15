/// <reference path="../typings/tsd.d.ts" />
/// <reference path="externs.d.ts" />
/// <reference path="config.ts" />
/// <reference path="doclet.ts" />
/// <reference path="doclettypes.ts" />
/// <reference path="io.ts" />
/// <reference path="moduleutils.ts" />
/// <refernece path="events.ts" />
/// <reference path="tsdgenerator.ts" />
/// <reference path="tsoutput.ts" />
/// <reference path="functypedefrewriter.ts" />
var fs = require("fs");
var env = require("jsdoc/env");
var logger = require("jsdoc/util/logger");
var tsConf = env.conf.typescript || {};

exports.handlers = {
    newDoclet: (e: TsdPlugin.IJsDocNewDocletEvent) => {
        if (tsConf.rewriteFunctionTypedefs === true) {
            TsdPlugin.FunctionTypedefRewriter.rewrite(e.doclet);
        }
    },
    processingComplete: (e: TsdPlugin.IJsDocProcessingCompleteEvent) => {
        var proc = new TsdPlugin.TsdGenerator(tsConf);
        var sf = {
            createStream: (fileName) => fs.createWriteStream(fileName),
            readText: (fileName) => fs.readFileSync(fileName, "utf8")
        };
        proc.process(e.doclets, sf, logger);
        //proc.dumpDoclets(e.doclets, sf);
    }
};