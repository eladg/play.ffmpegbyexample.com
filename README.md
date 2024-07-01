# app-ffmpeg

## TODO

- abort process
- handle ffmpeg errors
- style stderr vs stdout
- complete with tab
- `about`, `man`, `saveas`

## Test

```sh
ffmpeg -filter_complex "smptehdbars=size=320x240:rate=30000/1001;sine=frequency=440:sample_rate=48000:beep_factor=2" -c:v libx264 -pix_fmt:v yuv420p -profile:v high -c:a aac -ac 2 -t 5 out.mp4 -movflags +faststart
```
