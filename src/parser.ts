module TsdPlugin { 
    export module Generics {
        let grammer = fs.readFileSync("./src/generics.pegjs", 'utf8');
        
        type IType = IArrayType | IUnionType | ISimpleType | IGenericType;

        interface IArrayType {
            kind: "array";
            type: IType;
        }

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
                    case "array":
                        return this.stringArray(type);
                    case "generic":
                        return this.stringGeneric(type);
                    case "simple":
                        return this.stringSimple(type);
                    case "union":
                        return this.stringUnion(type);
                }
                console.error("Invalid Type:", type);
            }

            private stringSimple(tn: INamedType): string {
                return tn.name;
            }

            private stringUnion(tn: IUnionType): string {
                return tn.types.map(v => this.typeString(v)).join("|");
            }

            private stringArray(tn: IArrayType): string {
                let innerTypeString = this.typeString(tn.type);
                if (tn.type.kind === "union") {
                    return "(" + innerTypeString + ")[]";
                } else {
                    return innerTypeString + "[]";
                }
            }

            private stringGeneric(tn: IGenericType): string {
                let innerTypeString = tn.types.map(v => this.typeString(v)).join(",");
                return tn.name + "<" + innerTypeString + ">";
            }

            private remapType(tn: IType) {
                let {replacer} = this;
                if (!replacer || !tn) return;

                switch(tn.kind) {
                    case "array":
                        this.remapArray(tn);
                        break;
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
                tn.types.forEach(value => this.remapType(value));
            }

            private remapArray(tn: IArrayType) {
                this.remapType(tn.type);
            }

            private remapGeneric(tn: IGenericType) {
                this.remapSimple(tn);
                tn.types.forEach(value => this.remapType(value));
            }
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

