# Clocktower Companion

A private player's notebook for **Blood on the Clocktower**, built for phones and tablets at a live table. It keeps track of what is going on, helps you work out who is lying, and, if you are evil, helps you keep your cover story straight. Everything stays in your browser. Nothing is sent anywhere, and it works offline once it has loaded.

- **Town**: the circle of players in seating order. Tap a player to record their public claim, deaths, ghost votes, your read on them, notes, and a timeline of what they said and did. The circle only ever shows public claims, never your true role.
- **Info**: a log of what you learned and what others say they learned (Empath numbers, Washerwoman and Investigator pings, Fortune Teller checks, Undertaker reveals, Oracle, Flowergirl, Slayer shots and more), always with *who said it*. Quick prompts per character make logging fast.
- **Votes**: nominations, who voted, votes needed, executions, night deaths and ghost votes.
- **Suspects (liar-finder)**: checks every possible evil team and Demon against everything logged. Each player gets an evil % and a Demon %, the clues that moved it most, and table tips (duplicate claims, too many Outsiders, the Saint warning, the final three). Your private notes and planned bluffs never affect it.
- **Bluff Studio** (when you are evil): keeps your true role separate from what you tell the table. Record the Demon's three bluffs, get rated cover suggestions, plan story lines privately and mark them as told, and check your story against the game. Coaching tips say what to say, what to reveal, and what to watch for.
- **Guide**: every character on the script with ability text, tips for playing it and spotting it, and the rules for new players.
- **Undo** for every change, bounded and in memory only. **Save game to file / Load game file** for backups, and a warning if the browser cannot save.

Includes Trouble Brewing, Bad Moon Rising and Sects & Violets. A custom script can be imported from the official script tool's JSON. Ability text follows the [official wiki](https://wiki.bloodontheclocktower.com/). Character icons are original artwork from the BotCStoryTeller grimoire app. This is an unofficial fan tool. *Blood on the Clocktower* is a game by The Pandemonium Institute.

## Run it

It is a static site with no build step and no dependencies. Open `index.html`, or serve the folder with any static web server, or with Docker:

```bash
docker compose up -d        # http://localhost:8088/
```

## Install it on a phone

Browsers only allow installing a web app and working offline from an **HTTPS** address (plain `http://` to another device opens the page but cannot install it or cache it). Put the app behind any HTTPS front end you trust, such as a reverse proxy with a certificate or a private-network HTTPS tunnel, then on the phone:

1. Open the HTTPS address once while online and let it finish loading.
2. **iPhone or iPad (Safari):** Share, then *Add to Home Screen*. **Android (Chrome):** menu, then *Install app* (or *Add to Home screen*).
3. Open it from the home screen. Turn on airplane mode to check that it still opens.

Updates arrive by themselves the next time the app is opened with a signal. A slow connection is given about 2.5 seconds before the saved copy is used. Games are saved in the browser on that device; use *Save game to file* on the Setup tab for a copy you can move or keep.

## Tests

```bash
python3 tests/test_app.py                # whole suite; needs Python Playwright with Chromium
LAUNCH_ONLY=1 python3 tests/test_app.py  # only the launch checks (accessibility, offline, data safety, layouts, speed, a full scripted game)
```

The suite serves the repo on a local port, drives the app in headless Chromium (including phone and tablet sizes), and writes screenshots to `tests/screens/` (ignored by git). It uses Chromium's device emulation only: it does not replace trying the app on real iOS and Android devices.
