#!/usr/bin/env python3
"""Convert exported Kirby content (posts, notes, races) into Hugo page bundles.

ARCHIVED RECORD of the one-time Kirby->Hugo migration. The source tree it read
(_import/kirby-content) was deleted after the migration, so this will not run as-is.
To re-run: re-pull the Kirby content export, place it at _import/kirby-content, and
move this file back to _import/ (paths below are relative to that folder).

Re-runnable: wipes and regenerates content/posts and content/races on each run.
Source: _import/kirby-content/{posts,notes,races}
Output: content/{posts,races}/YYYYMMDD_<slug>/index.md  (+ copied media)
"""
import re
import shutil
import sys
from pathlib import Path

IMPORT = Path(__file__).resolve().parent
SRC = IMPORT / "kirby-content"
ROOT = IMPORT.parent
CONTENT = ROOT / "content"

MEDIA_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".mp4", ".mov", ".m4v"}
CONTENT_FILES = {"note.txt", "post.txt", "race.txt", "photo.txt", "default.txt"}

warnings = []


def parse_kirby(text):
    """Parse a Kirby .txt into {field(lowercase): value}. Fields split on a line of ----."""
    fields = {}
    for block in re.split(r"(?m)^----\s*$", text):
        block = block.strip("\n")
        if not block.strip():
            continue
        m = re.match(r"^([A-Za-z0-9_-]+):[ \t]*(.*)$", block, re.S)
        if not m:
            continue
        fields[m.group(1).strip().lower()] = m.group(2).strip()
    return fields


def uuid_to_filename(folder):
    """Map Kirby file uuid -> real filename, from the *.txt sidecars in a page folder."""
    mapping = {}
    for txt in folder.glob("*.txt"):
        if txt.name in CONTENT_FILES or txt.name.startswith("._"):
            continue
        real = txt.name[:-4]  # strip trailing .txt -> e.g. cover.jpg
        u = parse_kirby(txt.read_text(encoding="utf-8", errors="replace")).get("uuid")
        if u:
            mapping[u] = real
    return mapping


def convert_kirbytags(body):
    """Rewrite the whitelisted KirbyTags to Markdown/Hugo shortcodes. Leave prose alone."""

    def image(m):
        inner = m.group(1)
        parts = re.split(r"\s+(?=(?:alt|caption|link|title|width|class):)", inner, maxsplit=1)
        file = parts[0].strip()
        alt = ""
        if len(parts) > 1:
            a = re.search(r"(?:alt|caption):\s*(.+?)\s*$", parts[1])
            if a:
                alt = a.group(1).strip()
        return f"![{alt}]({file})"

    def video(m):
        url = m.group(1).strip()
        yt = re.search(r"(?:youtu\.be/|youtube\.com/watch\?v=|v=)([\w-]+)", url)
        if yt:
            return "{{< youtube " + yt.group(1) + " >}}"
        return f"[{url}]({url})"

    def link(m):
        inner = m.group(1)
        parts = re.split(r"\s+text:\s*", inner, maxsplit=1)
        url = parts[0].strip()
        text = parts[1].strip() if len(parts) > 1 else url
        return f"[{text}]({url})"

    def email(m):
        inner = m.group(1)
        parts = re.split(r"\s+text:\s*", inner, maxsplit=1)
        addr = parts[0].strip()
        text = parts[1].strip() if len(parts) > 1 else addr
        return f"[{text}](mailto:{addr})"

    def filetag(m):
        f = m.group(1).strip().split()[0]
        return f"[{f}]({f})"

    body = re.sub(r"\(image:\s*(.+?)\)", image, body)
    body = re.sub(r"\(video:\s*(.+?)\)", video, body)
    body = re.sub(r"\(link:\s*(.+?)\)", link, body)
    body = re.sub(r"\(email:\s*(.+?)\)", email, body)
    body = re.sub(r"\(file:\s*(.+?)\)", filetag, body)
    return body


def iso_date(v):
    v = (v or "").strip()
    if not v:
        return None
    return v.replace(" ", "T", 1) if " " in v else v


def split_tags(v):
    return [t.strip() for t in (v or "").split(",") if t.strip()]


def yq(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def yaml_list(items):
    return "[" + ", ".join(yq(i) for i in items) + "]"


def slug_of(folder):
    return re.sub(r"^\d+_", "", folder.name)


def date_prefix(datestr):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", datestr or "")
    return m.group(1) + m.group(2) + m.group(3) if m else ""


def bundle_name(slug, datestr):
    """Folder name = YYYYMMDD_slug so listings sort chronologically. URL still comes from slug."""
    p = date_prefix(datestr)
    return f"{p}_{slug}" if p else slug


def copy_media(folder, dest):
    copied = []
    for f in sorted(folder.iterdir()):
        if f.is_file() and not f.name.startswith("._") and f.suffix.lower() in MEDIA_EXT:
            shutil.copy2(f, dest / f.name)
            copied.append(f.name)
    return copied


def write_bundle(dest_dir, front_lines, body):
    dest_dir.mkdir(parents=True, exist_ok=True)
    fm = "---\n" + "\n".join(front_lines) + "\n---\n"
    text = fm + "\n" + convert_kirbytags(body).strip() + "\n"
    (dest_dir / "index.md").write_text(text, encoding="utf-8")


def iter_pages(section, content_name):
    base = SRC / section
    for folder in sorted(base.iterdir()):
        if not folder.is_dir() or folder.name.startswith("._"):
            continue
        cf = folder / content_name
        if not cf.exists():
            warnings.append(f"{section}/{folder.name}: missing {content_name}")
            continue
        yield folder, parse_kirby(cf.read_text(encoding="utf-8", errors="replace"))


def migrate_posts():
    n = 0
    for folder, f in iter_pages("posts", "post.txt"):
        slug = slug_of(folder)
        dest = CONTENT / "posts" / bundle_name(slug, f.get("date"))
        dest.mkdir(parents=True, exist_ok=True)
        copy_media(folder, dest)

        lines = [f"title: {yq(f.get('title', ''))}", f"slug: {yq(slug)}"]
        d = iso_date(f.get("date"))
        if d:
            lines.append(f"date: {d}")
        lm = iso_date(f.get("updated"))
        if lm:
            lines.append(f"lastmod: {lm}")
        if f.get("excerpt"):
            lines.append(f"description: {yq(f['excerpt'])}")
        tags = split_tags(f.get("tags"))
        if tags:
            lines.append(f"tags: {yaml_list(tags)}")
        cover = f.get("cover", "")
        cm = re.search(r"file://(\w+)", cover)
        if cm:
            fn = uuid_to_filename(folder).get(cm.group(1))
            if fn and (dest / fn).exists():
                lines.append(f"cover: {yq(fn)}")
            else:
                warnings.append(f"posts/{slug}: cover uuid {cm.group(1)} unresolved")
        lines += ["archived: false", "draft: false", "favorite: false"]
        write_bundle(dest, lines, f.get("body", ""))
        n += 1
    return n


def migrate_notes():
    n = 0
    for folder, f in iter_pages("notes", "note.txt"):
        slug = slug_of(folder)
        dest = CONTENT / "posts" / bundle_name(slug, f.get("date"))
        dest.mkdir(parents=True, exist_ok=True)
        copy_media(folder, dest)

        lines = ['title: ""', f"slug: {yq(slug)}"]
        d = iso_date(f.get("date"))
        if d:
            lines.append(f"date: {d}")
        tags = split_tags(f.get("tags"))
        if "note" not in tags:
            tags.append("note")
        lines.append(f"tags: {yaml_list(tags)}")
        media = [f[k] for k in ("media-1", "media-2", "media-3", "media-4") if f.get(k)]
        if media:
            lines.append(f"media: {yaml_list(media)}")
        lines += ["archived: true", "draft: false", "favorite: false"]
        write_bundle(dest, lines, f.get("body", ""))
        n += 1
    return n


def migrate_races():
    n = 0
    for folder, f in iter_pages("races", "race.txt"):
        slug = slug_of(folder)
        dest = CONTENT / "races" / bundle_name(slug, f.get("date"))
        dest.mkdir(parents=True, exist_ok=True)
        copy_media(folder, dest)

        lines = [f"title: {yq(f.get('title', ''))}", f"slug: {yq(slug)}"]
        d = iso_date(f.get("date"))
        if d:
            lines.append(f"date: {d}")
        tags = split_tags(f.get("tags"))
        if tags:
            lines.append(f"tags: {yaml_list(tags)}")
        if f.get("distance"):
            lines.append(f"distance: {f['distance'].strip()}")
        for key in ("time", "pace", "location"):
            if f.get(key):
                lines.append(f"{key}: {yq(f[key])}")
        lines.append("draft: false")
        write_bundle(dest, lines, f.get("body", ""))
        n += 1
    return n


def main():
    for section in ("posts", "races"):
        d = CONTENT / section
        if d.exists():
            shutil.rmtree(d)
    posts = migrate_posts()
    notes = migrate_notes()
    races = migrate_races()
    print(f"posts (real): {posts}")
    print(f"notes -> posts: {notes}")
    print(f"races: {races}")
    print(f"total in content/posts: {posts + notes}")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings[:40]:
            print("  - " + w)
        if len(warnings) > 40:
            print(f"  ... and {len(warnings) - 40} more")


if __name__ == "__main__":
    main()
