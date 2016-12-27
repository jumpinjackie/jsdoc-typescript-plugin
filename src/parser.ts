module TsdPlugin { 
    export module Generics {
        let grammer = fs.readFileSync("./src/generics.pegjs", 'utf8');
        
        type IType = IUnionType | ISimpleType | IGenericType;

        interface INamedType {
            name: string;
        }

        export interface IUnionType {
            kind: "union";
            types: IType[];
        }

        export interface ISimpleType {
            kind: "simple";
            name: string;
        }

        export interface IGenericType {
            kind: "generic";
            name: string;
            types: IType[];
        }

        class GenericsResult {
            public constructor(private type: IType, private replacer?: (typeName) => string) {
                this.remapType(type);
            };

            public toString(): string {
                let {type} = this;
                if (!type) return null;

                return this.typeString(type);
            }

            private typeString(type: IType): string {
                switch(type.kind) {
                    case "generic":
                        return this.stringGeneric(type);
                    case "simple":
                        return this.stringSimple(type);
                    case "union":
                        return this.stringUnion(type);
                }
            }

            private stringSimple(tn: INamedType): string {
                return tn.name;
            }

            private stringUnion(tn: IUnionType): string {
                return tn.types.map(v => this.typeString(v)).join("|")
            }

            private stringGeneric(tn: IGenericType): string {
                let innerTypeString = tn.types.map(v => this.typeString(v)).join(","); 
                if (isArray(tn)) {                        
                    if (tn.types[0].kind === "union") {
                        return "(" + innerTypeString + ")[]"
                    } else {
                        return innerTypeString + "[]"
                    }
                } else {
                    return tn.name + "<" + innerTypeString + ">";
                }
            }

            private remapType(tn: IType) {
                let {replacer} = this;
                if (!replacer || !tn) return;

                switch(tn.kind) {
                    case "generic":
                        this.remapGeneric(tn);
                        break;
                    case "simple":
                        this.remapSimple(tn);
                        break;
                    case "union":
                        this.remapUnion(tn);
                        break;
                }
            }

            private remapSimple(tn: INamedType) {
                tn.name = this.replacer(tn.name);
            }

            private remapUnion(tn: IUnionType) {
                tn.types.forEach(value => this.remapType(value))
            }

            private remapGeneric(tn: IGenericType) {
                this.remapSimple(tn);
                tn.types.forEach(value => this.remapType(value))
            }
        }

        export function isArray(type: IType): boolean {
            return type.kind === "generic" && type.name.toLowerCase() === "array";
        }

        export function parse(input: string, replacer?: (typeName: string) => string): string {
            try {
                return new GenericsResult(_parse(input), replacer).toString();            
            } catch(e) {
                return null;
            }        
        }

        const _parse: (input: string, options?:PEG.ParserOptions) => IType = peg.generate(grammer).parse;
    }
}

