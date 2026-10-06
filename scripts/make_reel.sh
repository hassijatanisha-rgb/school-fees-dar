#!/usr/bin/env bash
# Turn a 1280x800 demo recording into a 1080x1920 vertical reel with text.
# Usage: scripts/make_reel.sh <demo.webm> <out.mp4> <hook line 1> <hook line 2> <subline> <cta line 1> <cta line 2>
set -euo pipefail
demo=$1 out=$2
shift 2
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
i=0
for line in "$@"; do printf '%s' "$line" > "$tmp/$i.txt"; i=$((i + 1)); done
bold=/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf
reg=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
center="x=(w-tw)/2"
ffmpeg -y -v error -f lavfi -i "color=c=0x0f172a:s=1080x1920:r=30" -i "$demo" -filter_complex "
[1:v]scale=1040:-2,setsar=1[v];
[0:v][v]overlay=(W-w)/2:620:shortest=1,
drawtext=fontfile=$bold:textfile=$tmp/0.txt:fontsize=78:fontcolor=white:$center:y=250,
drawtext=fontfile=$bold:textfile=$tmp/1.txt:fontsize=78:fontcolor=white:$center:y=345,
drawtext=fontfile=$reg:textfile=$tmp/2.txt:fontsize=44:fontcolor=0x5eead4:$center:y=480,
drawtext=fontfile=$bold:textfile=$tmp/3.txt:fontsize=50:fontcolor=white:$center:y=1400:enable='gte(t,2)',
drawtext=fontfile=$bold:textfile=$tmp/4.txt:fontsize=50:fontcolor=0x5eead4:$center:y=1475:enable='gte(t,2)'
" -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 -movflags +faststart -an "$out"
