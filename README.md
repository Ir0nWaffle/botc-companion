# Clocktower Companion

A player's notebook for **Blood on the Clocktower**, made for new players. It keeps track of what's going on and helps you work out who is lying.

- **Town**: the circle of players in seating order. Record each player's claimed character, deaths, ghost votes, your read on them, and notes.
- **Info log**: record what you learned and what others say they learned (Empath numbers, Washerwoman/Investigator pings, Fortune Teller checks, Undertaker reveals, Seamstress, Clockmaker, Oracle, Flowergirl, Town Crier, Slayer shots…), always with *who said it*.
- **Votes**: log nominations and who voted, see how many votes are needed, and track ghost votes.
- **Who's lying?**: checks every possible evil team (and Demon) against everything you logged. Evil players may say anything, and good players are *usually* right (they might be drunk or poisoned). Each player gets an evil % and a Demon %, with the clues that moved it most, plus tips such as duplicate claims, too many Outsiders, the Saint warning and the final-3 warning.
- **Evil?** The same tab becomes a bluff helper that lists unclaimed good characters.
- **Guide**: every character on the script with ability text and beginner tips ("if you are it" and "if someone claims it"), plus the rules for new players.

Includes Trouble Brewing, Bad Moon Rising and Sects & Violets. Custom scripts can be imported from the official script tool's JSON. Everything is stored in your browser only, and the app works offline once loaded.

Ability text follows the [official wiki](https://wiki.bloodontheclocktower.com/). Character icons are original artwork from the BotCStoryTeller grimoire app. This is an unofficial fan tool. *Blood on the Clocktower* is a game by The Pandemonium Institute.

## Run it

It's a static site with no build step. Open `index.html`, or serve it with Docker:

```bash
docker compose up -d        # http://<server>:8088/
```

## Tests

```bash
python3 tests/test_app.py   # needs Python Playwright + Chromium
```
