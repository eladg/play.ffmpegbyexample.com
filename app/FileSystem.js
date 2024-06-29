export class FileSystem {
    terminal;
    map = {};

    constructor(terminal) {
        this.terminal = terminal;
    }

    get list() {
        return Object.values(this.map).sort((a, b) => a.name.localeCompare(b.name));
    }

    get(filename) {
        const result = this.map[filename];
        if(!result)
            throw `File ${filename} does not exist.`;
        return result;
    }

    add(files) {
        for(const file of files)
            this.map[file.name] = file;
    }

    run() {
        for(const file of this.list) {
            const line = `${file.size}`.padStart(9) + ` ${file.name}`;
            this.terminal.stdout(line);
        }
    }
}