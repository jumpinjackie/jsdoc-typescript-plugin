module TsdPlugin {
    /**
     * Module helper utility
     */
    export class ModuleUtils {
        /**
         * Gets whether this module name is an AMD one
         */
        public static isAMD(name: string): boolean {
            return name.indexOf("/") >= 0;
        }

        public static cleanModuleName(moduleName: string): string {
            let modName: string = moduleName;
            if (modName.indexOf("module:") == 0) {
                modName = modName.substring(7);
            }
            if (modName.indexOf("~") >= 0) {
                modName = modName.substring(modName.indexOf("~") + 1);
            }
            return modName;
        }

        /**
         * Writes the TS module tree out to the specified output stream
         */
        public static outputTsd(
            module:      Readonly<ITSModule>,
            stream:      IndentedOutputStream,
            conf:        Readonly<IPluginConfig>,
            logger:      ILogger,
            publicTypes: Map<string, IOutputtable>,
            isTopLevel:  boolean = true
        ): void {
            for (let type of module.types) {
                //console.log(`Outputting type: ${type.getFullName()}`);
                type.output(stream, conf, logger, publicTypes);
            }
            let childModules = module.children;
            if (isTopLevel && conf.globalModuleAliases.length > 0) {
                //For any modules declared as global aliases, output them
                //without the module declaration
                for (const modName of conf.globalModuleAliases) {
                    if (childModules.has(modName)) {
                        const mod = childModules.get(modName);
                        ModuleUtils.outputTsd(mod, stream, conf, logger, publicTypes, false);
                    }
                }
            }
            childModules.forEach((child, moduleName) => {
                //Skip over any modules declared as global aliases
                if (isTopLevel) {
                    const matches = conf.globalModuleAliases.filter(gm => gm === moduleName);
                    if (matches.length > 0) {
                        return;
                    }
                }
                //Root modules have to be declared
                let decl = ((child.isRoot === true && conf.declareTopLevelElements) ? "declare " : "");
                //Write module decl

                //Strip module: prefix if found
                let modName: string = ModuleUtils.cleanModuleName(moduleName);
                if (ModuleUtils.isAMD(modName)) {
                    stream.writeln(`${decl}module "${modName}" {`)
                } else {
                    stream.writeln(`${decl}module ${modName} {`);
                }
                stream.indent();
                ModuleUtils.outputTsd(child, stream, conf, logger, publicTypes, false);
                stream.unindent();
                stream.writeln("}");
            });
        }
    }
}
