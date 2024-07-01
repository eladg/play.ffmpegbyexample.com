const childProcess = require("child_process");
const esbuild = require("esbuild");
const fs = require("fs");
const terser = require("terser");

const argv = process.argv;
const production = argv.includes("--production");
const quiet = argv.includes("--quiet")
const watch = argv.includes("--watch");
const appPath = "app";
const staticPath = `${appPath}/static`;
const distPath = "dist";

const c_red = text => `\x1b[31m${text}\x1b[0m`;
const c_green = text => `\x1b[32m${text}\x1b[0m`;
const formatSize = value => `${(value/1024/1024).toFixed(1)} MiB`;

function prepare() {
	if(!fs.existsSync(distPath))
		fs.mkdirSync(distPath, {});
	fs.cpSync(staticPath, distPath, {recursive:true});
}

async function run() {
	prepare();
	const log = quiet ? () => {} : message => console.log(message ?? "");
	const modules = ["main", "ffmpegWorker"];

	if(quiet)
		log(`compile ${modules.join(",")}`);

	const optionsList = modules.map(module => {
		const modulePath = `${appPath}/ts/${module}`;
		const filename = `${module}.js`;
		const outfile = `${distPath}/${filename}`;
		const tsConfigPath = `${modulePath}/tsconfig.json`;
		return {
			bundle: true,
			charset: "utf8",
			entryPoints: [`${modulePath}/Main.ts`],
			format: "iife", // iife produces smaller .js.br, esm produces smaller .js
			//minify: production,
			target: ["esnext"],
			outfile,
			plugins: [{
				name: "main",
				setup(build) {
					let start = 0;
					build.onStart(() => {
						start = performance.now();
					})
					build.onEnd(result => {
						let errors = result.errors.length + result.warnings.length;
						if(!errors)
							try {
								childProcess.execSync(`tsc -p ${tsConfigPath} --noEmit`, {stdio:"inherit"});
							} catch(error) {
								errors = "typescript";
							}
						
						const duration = (performance.now() - start) | 0;
						if(errors) {
							log(`compiled with ${c_red(errors + " errors")} in ${duration} ms`);
							if(!watch)
								throw `${errors} errors`;
							log();
							return;
						}

						const size = fs.statSync(outfile).size;
						log(`asset ${c_green(filename)} ${formatSize(size)} [emitted]`);
						log(`compiled ${c_green("successfully")} in ${duration} ms`);
						
						if(production) {
							const start = performance.now();
							const source = fs.readFileSync(outfile, {encoding:"utf8"});
							const {code:result} = terser.minify_sync(source);
							fs.writeFileSync(outfile, result);
							const duration = (performance.now() - start) | 0;
							if(!quiet)
								log(`minified to ${formatSize(result.length)} in ${duration} ms`);
						}
						log();
					})
				}
			}],
			tsconfig: tsConfigPath
		}
	})

	if(watch) {
		const contexts = [];
		for(const options of optionsList)
			contexts.push(await esbuild.context(options));
		const rebuild = async () => {
			try {
				prepare();
				for(const context of contexts)
					await context.rebuild();
			} catch(error) {}
		}
		await rebuild();
		// using custom watch b/c esbuild doesnt
		// https://github.com/evanw/esbuild/issues/3718
		fs.watch(appPath, {recursive:true}).addListener("change", rebuild);
	} else {
		for(const options of optionsList)
			await esbuild.build(options);
	}
}

run().catch(error => {
	console.log(error);
	process.exit(1);
});