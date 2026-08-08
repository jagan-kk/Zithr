import asyncio
import logging
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php"
ARCHIVE_METADATA_URL = "https://archive.org/metadata/{identifier}"
TIMEOUT = httpx.Timeout(25.0, connect=10.0)
RETRIES = 2
AUDIO_EXTS = (".mp3", ".ogg", ".flac", ".m4a")

_client = httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True)


def _normalize(text: str) -> str:
    if isinstance(text, list):
        text = " ".join(str(t) for t in text)
    return " ".join(str(text).lower().replace("-", " ").split())


def _tokens(text: str) -> set:
    return set(_normalize(text).split())


def _score(title: str, artist: str, doc: dict) -> float:
    """Rough similarity between a track and an archive.org search doc."""
    title_tokens = _tokens(title)
    artist_tokens = _tokens(artist)
    doc_title = _tokens(doc.get("title", ""))
    doc_creator = _tokens(doc.get("creator", "") or doc.get("creator_s", ""))

    score = 0.0
    if artist_tokens and doc_creator:
        score += 1.5 * len(artist_tokens & doc_creator) / max(len(artist_tokens), 1)
    if title_tokens and doc_title:
        score += 0.8 * len(title_tokens & doc_title) / max(len(title_tokens), 1)
    return score


async def _search(title: str, artist: str) -> list:
    async def query(q: str) -> list:
        r = await _client.get(
            ARCHIVE_SEARCH_URL,
            params={
                "q": q,
                "fl[]": "identifier,title,creator,creator_s,downloads",
                "rows": "8",
                "output": "json",
            },
            timeout=httpx.Timeout(8.0, connect=8.0),
        )
        r.raise_for_status()
        return r.json().get("response", {}).get("docs", [])

    docs = []
    if artist:
        docs = await query(f'creator:("{artist}") AND title:("{title}")')
        if not docs:
            docs = await query(f'creator:("{artist}")')
    elif title:
        docs = await query(f'title:("{title}")')
    return docs


async def _pick_audio_file(identifier: str) -> str | None:
    r = await _client.get(
        ARCHIVE_METADATA_URL.format(identifier=identifier),
        timeout=httpx.Timeout(10.0, connect=8.0),
    )
    r.raise_for_status()
    files = r.json().get("files", [])

    candidates = []
    for f in files:
        name = f.get("name", "")
        low = name.lower()
        if not low.endswith(AUDIO_EXTS):
            continue
        fmt = (f.get("format") or "").lower()
        if "metadata" in fmt or "text" in fmt:
            continue
        try:
            size = int(f.get("size") or 0)
        except (TypeError, ValueError):
            size = 0
        candidates.append((size, name))

    if not candidates:
        return None

    mp3s = [c for c in candidates if c[1].lower().endswith(".mp3")]
    pool = mp3s if mp3s else candidates
    pool.sort(key=lambda c: c[0], reverse=True)

    safe = "'(),&"
    for _, name in pool[:3]:
        url = f"https://archive.org/download/{identifier}/{quote(name, safe=safe)}"
        if await _validate_audio(url):
            return url
    return None


async def _validate_audio(url: str) -> bool:
    """Quick range request to confirm the file actually streams."""
    try:
        cm = _client.stream(
            "GET",
            url,
            headers={"Range": "bytes=0-1023"},
            timeout=httpx.Timeout(15.0, connect=8.0),
        )
        r = await cm.__aenter__()
        ok = False
        try:
            if r.status_code in (200, 206):
                async for chunk in r.aiter_bytes():
                    ok = len(chunk) > 0
                    break
        finally:
            try:
                await cm.__aexit__(None, None, None)
            except Exception:
                pass
        return ok
    except Exception:
        return False


def _format_size(bytes_: int) -> str:
    return f"{bytes_ / 1048576:.1f} MB" if bytes_ else ""


async def resolve(title: str, artist: str) -> dict | None:
    """Resolve a track to a real Internet Archive audio URL, or None."""
    for attempt in range(RETRIES + 1):
        try:
            docs = await _search(title, artist)
            if not docs:
                return None
            ranked = sorted(docs, key=lambda d: _score(title, artist, d), reverse=True)
            for best in ranked[:3]:
                if _score(title, artist, best) <= 0:
                    continue
                identifier = best["identifier"]
                url = await _pick_audio_file(identifier)
                if not url:
                    continue
                length = ""
                meta_length = best.get("length")
                if meta_length:
                    try:
                        length = f"{int(meta_length // 60)}:{int(meta_length % 60):02d}"
                    except (TypeError, ValueError):
                        length = ""
                return {
                    "audio_url": url,
                    "resolved_source": "Internet Archive",
                    "file_size": "",
                    "duration": length,
                    "status": "cached",
                }
            return None
        except Exception as exc:
            logger.warning("archive resolve failed for %s - %s: %s", title, artist, exc)
            if attempt < RETRIES:
                await asyncio.sleep(0.5 * (attempt + 1))
    return None
