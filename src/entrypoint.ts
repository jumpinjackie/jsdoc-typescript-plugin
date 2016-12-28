let fs: typeof nodeModules.fs = require("fs");
let os: typeof nodeModules.os = require("os");
let peg: typeof PEG = require("pegjs");
let env: any = require("jsdoc/env");
let logger:TsdPlugin.ILogger = require("jsdoc/util/logger");
let tsConf:TsdPlugin.IPluginConfig  = env.conf.typescript || {}; 

exports.handlers = {
    newDoclet(e: jsdoc.INewDocletEvent): void {
        if (tsConf.rewriteFunctionTypedefs === true) {
            TsdPlugin.FunctionTypedefRewriter.rewrite(e.doclet);
        }
    },
    processingComplete(e: jsdoc.IProcessingCompleteEvent): void {
        let proc = new TsdPlugin.TsdGenerator(tsConf);
        let sf = {
            createStream: (fileName) => fs.createWriteStream(fileName),
            readText: (fileName) => fs.readFileSync(fileName, "utf8"),
            endl: os.EOL
        };
        proc.process(e.doclets, sf, logger);
        //proc.dumpDoclets(e.doclets, sf);
    }
};
