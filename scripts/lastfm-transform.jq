def nonempty_string:
  type == "string" and length > 0;

(.recenttracks.track? // [])
| if type == "array" then . else [] end
| first(.[] | select((."@attr".nowplaying? // "false") != "true")) as $track
| ($track.url | sub("^http://"; "https://")) as $url
| select(
    ($track.name | nonempty_string)
    and ($track.artist["#text"] | nonempty_string)
    and ($url | test("^https://www\\.last\\.fm/"))
  )
| {
    track: $track.name,
    artist: $track.artist["#text"],
    url: $url
  }
