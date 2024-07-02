export type FFmpegWorkerOut = {
	readonly kind:"onExit";
	readonly success:boolean;
	readonly files:ReadonlyArray<File>;
} | {
	readonly kind:"stderr";
	readonly message:ArrayBuffer;
} | {
	readonly kind:"stdout";
	readonly message:ArrayBuffer;
}