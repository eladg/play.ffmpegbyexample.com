# app-ffmpeg

## TODO

- `about`, `man`
	- example concat video, generate from nothing, resize video, split audio and video, get image frames
- mount small files as buffers
- ffmpeg `Conversion failed!` means file already exists on FS
- manifests.json, apple-touch-icon.png, og_image2.jpg
- embed as iframe
- analytics
- report crbug worker returning many blobs crashes on terminate()

## Test

```sh
ffmpeg -filter_complex "smptehdbars=size=320x240:rate=30000/1001;sine=frequency=440:sample_rate=48000:beep_factor=2" -c:v libx264 -pix_fmt:v yuv420p -profile:v high -c:a aac -ac 2 -t 5 out.mp4 -movflags +faststart

ffmpeg -f concat -i concat.txt -c copy output.mp4
```
