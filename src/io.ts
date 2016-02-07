module TsdPlugin {
    export class IndentedOutputStream {
        private indentLevel: number;
        private output: any;
        constructor(output: any /* fs.WriteStream */) {
            this.indentLevel = 0;
            this.output;
        }
        indent(): void {
            this.indentLevel++;
        }
        unindent(): void {
            this.indentLevel--;
        }
        private indentedText(): string {
            var pattern = " ";
            var count = this.indentLevel * 4;
            if (count < 1) return '';
            var result = '';
            while (count > 1) {
                if (count & 1) result += pattern;
                count >>= 1, pattern += pattern;
            }
            return result + pattern;
        }
        writeln(str: string) {
            this.output.write(`${this.indentedText()}${str}`);
        }
        close(callback: () => void) {
            this.output.on("finish", callback);
            this.output.end();
        }
    }
}