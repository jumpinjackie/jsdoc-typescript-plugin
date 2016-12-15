
module TsdPlugin {
    /**
     * A helper class to rewrite @typedef based function annotations into the @callback form
     */
    export class FunctionTypedefRewriter {
        public static getDocletKind(doclet: Readonly<jsdoc.IDoclet>): string {
            //Not a function or constructor eh?
            if (doclet.kind != DocletKind.Function && doclet.kind != DocletKind.Class) {
                if (doclet.params && doclet.params.length > 0) {
                    return DocletKind.Function; //LIAR
                }
                if (doclet.returns && doclet.returns.length > 0) {
                    return DocletKind.Function; //LIAR
                }
            }
            return doclet.kind;
        }

        private static isFunctionTypedef(doclet: Readonly<jsdoc.IDoclet>): boolean {
            return doclet.kind == DocletKind.Typedef &&
                   doclet.type != null &&
                   doclet.type.names != null &&
                   doclet.type.names.length == 1 &&
                   doclet.type.names.indexOf("function") >= 0 &&
                   doclet.comment.indexOf("@callback") < 0;
        }

        static cleanArg(str: string): string {
            let clean = str;
            
            if (clean.indexOf("function") < 0)
                clean = clean.replace("(", "").replace(")", "");
            
            if (clean.indexOf("!") == 0)
                clean = clean.substr(1);
            
            return clean;
        }

        static isContextualParameter(str: string): boolean {
            return str.indexOf(":") >= 0;
        }

        public static rewrite(doclet: jsdoc.IDoclet): void {

            if (FunctionTypedefRewriter.isFunctionTypedef(doclet)) {
                // The meat that makes this possible is the @typedef annotation in the comments
                // Use regex to test for common patterns
                
                // Clean the comment of newlines and *, so it doesn't trip the regex

                let comment = doclet.comment.split("\n *").join("");
                
                // A function that returns a value
                let matches = comment.match(/@typedef \{function\((.*?)\)\s*:\s*(.*?)\}/);
                if (matches && matches.length == 3) {
                    let argPart = matches[1];
                    let retPart = matches[2];
                    let args = argPart.split(",")
                                      .filter(a => !FunctionTypedefRewriter.isContextualParameter(a))
                                      .map(a => FunctionTypedefRewriter.cleanArg(a).trim())
                                      .filter(a => a != null && a != "");
                    let params = [];
                    //NOTE: As the typedef does not carry parameter name information, we have to fall back
                    //to the not very useful argN parameter name format. Also there will be no parameter information
                    let argNo = 0;
                    for (let arg of args) {
                        let typeNames = arg.split("|").map(a => FunctionTypedefRewriter.cleanArg(a).trim());
                        let param: any = {
                            type: {
                                names: typeNames
                            },
                            name: `arg${argNo}`
                        };
                        if (typeNames.length == 1) {
                            //Check for optional parameter formats
                            if (typeNames[0].indexOf("?") == 0) { //1st optional variant: ?typename
                                typeNames[0] = typeNames[0].substr(1);
                                param.optional = true;
                            } else if (typeNames[0].indexOf("=") == typeNames[0].length - 1) { //2nd optional variant: typename=
                                typeNames[0] = typeNames[0].substr(0, typeNames[0].length - 1);
                                param.optional = true;
                            }
                        } else {
                            let anyOptional = typeNames.filter(tn => tn.indexOf("?") >= 0 || tn.indexOf("=") == tn.length - 1);
                            if (anyOptional.length > 0) {
                                //Clean the type names
                                param.type.names = typeNames.map(tn => {
                                    if (tn.indexOf("?") == 0) {
                                        return tn.substr(1);
                                    } else if (tn.indexOf("=") == tn.length - 1) {
                                        return tn.substr(0, tn.length - 1);
                                    } else {
                                        return tn;
                                    }
                                });
                                param.optional = true;
                            }
                        }
                        params.push(param);
                        argNo++;
                    }
                    doclet.params = params;
                    doclet.returns = [
                        {
                            type: {
                                names: retPart.split("|").map(a => FunctionTypedefRewriter.cleanArg(a).trim())
                            }
                        }
                    ]
                    console.log(`Rewrote doclet for (${doclet.longname}) with extra callback metadata`);
                    //Inject the @callback annotation into the comments (as the main processor checks for the presence)
                    //of this annotation
                    doclet.comment = doclet.comment.replace("/**", `/**\n * @callback ${doclet.longname}\n *`);
                    return;
                }
                // No return types
                matches = comment.match(/@typedef \{function\((.*?)\)\}/);
                if (matches && matches.length == 2) {
                    let argPart = matches[1];
                    let args = argPart.split(",")
                                      .filter(a => !FunctionTypedefRewriter.isContextualParameter(a))
                                      .map(a => FunctionTypedefRewriter.cleanArg(a).trim())
                                      .filter(a => a != null && a != "");
                    let params = [];
                    //NOTE: As the typedef does not carry parameter name information, we have to fall back
                    //to the not very useful argN parameter name format. Also there will be no parameter information
                    let argNo = 0;
                    for (let arg of args) {
                        let typeNames = arg.split("|").map(a => FunctionTypedefRewriter.cleanArg(a).trim());
                        let param: any = {
                            type: {
                                names: typeNames
                            },
                            name: `arg${argNo}`
                        };
                        if (typeNames.length == 1) {
                            //Check for optional parameter formats
                            if (typeNames[0].indexOf("?") == 0) { //1st variant: ?typename
                                typeNames[0] = typeNames[0].substr(1);
                                param.optional = true;
                            } else if (typeNames[0].indexOf("=") == typeNames[0].length - 1) { //2nd variant: typename=
                                typeNames[0] = typeNames[0].substr(0, typeNames[0].length - 1);
                                param.optional = true;
                            }
                        }
                        params.push(param);
                        argNo++;
                    }
                    doclet.params = params;
                    console.log(`Rewrote doclet for (${doclet.longname}) with extra callback metadata`);
                    //Inject the @callback annotation into the comments (as the main processor checks for the presence)
                    //of this annotation
                    doclet.comment = doclet.comment.replace("/**", `/**\n * @callback ${doclet.longname}\n *`);
                    return;
                }
                
                console.log(`Skipped rewriting ${doclet.longname} as it does not match any known function type patterns`);
            }
        }
    }
}
