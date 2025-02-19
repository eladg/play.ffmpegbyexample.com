import * as Const from "common/Const";
import * as ContentType from "common/util/ContentType";
import { FFmpegWorkerIn } from "common/type/FFmpegWorkerIn";
import { FFmpegWorkerOut } from "common/type/FFmpegWorkerOut";
import { TTYOutput } from "./TTYOutput";

const post = (message:FFmpegWorkerOut, options?:StructuredSerializeOptions) => self.postMessage(message, options);

self.onmessage = async event => {
	const {args, blobs, env} = event.data as FFmpegWorkerIn;

	// Worker is module so `importScripts(ffmpegUrl)` is not available...
	// but this little hack makes createFFmpeg available instead importScripts
	(<any>self).define = (_:any, c:any) => (<any>self).createFFmpeg = c();
	(<any>self).define.amd = true;
	await import(env.FFMPEG_MAIN_URL);
	delete (<any>self).define;

	const wasmMemory = new WebAssembly.Memory({initial:2048, maximum:65536, shared:true});
	const module = await createFFmpeg({
		stderr:(buffer, offset, length) => {
			if(!length) return;
			const message = buffer.slice(offset, offset + length).buffer;
			post({kind:"stderr", message}, {transfer:[message]});
		},
		stdout:(buffer, offset, length) => {
			if(!length) return;
			const message = buffer.slice(offset, offset + length).buffer;
			post({kind:"stdout", message}, {transfer:[message]});
		},
		tty:(stream, buffer, offset, length) => {
			const output = ttyOutputs[stream.path];
			if(!output)
				return false;
			if(length)
				output.push(buffer.slice(offset, offset + length).buffer);
			return true;
		},
		printErr:message=> {
			post({kind:"error", messageOrCode:message})
		},
		locateFile:url => {
			if(url.endsWith(".wasm")) return env.FFMPEG_WASM_URL;
			return url;},
		mainScriptUrlOrBlob:env.FFMPEG_MAIN_URL, wasmMemory});

	const FS = module.FS;

	// mount all blobs and symlink each to root
	const WORKERFS = "workerfs"
	FS.mkdir(WORKERFS);
	FS.mount(module.WORKERFS, {blobs}, WORKERFS);
	for(const filename of FS.readdir(`/${WORKERFS}`))
		if(filename !== "." && filename !== "..")
			FS.symlink(`/${WORKERFS}/${filename}`, `/${filename}`);

	// prepare tty outputs
	const ttyOutputs:Record<string, TTYOutput> = {};
	const ttyEntries = getTTYEntries(args);
	if(ttyEntries.length) {
		const {mode, rdev} = FS.stat("/dev/tty");
		FS.mkdir(Const.TTY_DIR);
		for(const {arg, filename} of ttyEntries) {
			FS.mknod(arg, mode, rdev);
			const type = ContentType.getMimeType(filename);
			ttyOutputs[`/${arg}`] = new TTYOutput(filename, type);
		}
	}

	// store the original content
	const dirContent = FS.readdir("/");

	module.onExit = code => {
		if(code !== 0)
			return post({kind:"error", messageOrCode:code});

		const files = [];
		for(const filename of FS.readdir("/"))
			if(!dirContent.includes(filename)) {
				// report all new files
				const content = FS.readFile(filename);
				const type = ContentType.getMimeType(filename);
				const options = type ? {type} : undefined;
				files.push(new File([<ArrayBuffer>content.buffer], filename, options));
			}
		for(const ttyOutput of Object.values(ttyOutputs)) {
			const file = ttyOutput.flush();
			if(file)
				files.push(file);
		}
		post({kind:"success", files});
	}
	module.callMain(args);
}

self.onunhandledrejection = event => {
	event.preventDefault();
	throw event.reason;
}

function getTTYEntries(args:ReadonlyArray<string>) {
	const result = [];
	const prefix = `${Const.TTY_DIR}/`;
	for(const arg of args) {
		if(arg.startsWith(prefix)) {
			const filename = arg.substring(prefix.length);
			if(filename)
				result.push({arg, filename});

		}
	}
	return result;
}