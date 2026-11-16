# Tank Duel

A top-down 1v1 tank battle game that runs in the browser, written in plain JavaScript with no libraries, images or sound files. Everything (terrain, tanks, effects, sound and music) is generated in code.

## Features

- **4 modes:** 2 players on one keyboard, vs CPU (Easy / Medium / Hard), online 1v1, and a 16-mission campaign
- **12 tanks** with their own stats and specials: L33, Scout, Striker, Hydra, Brawler, Sapper, Phoenix, Tiger, Howitzer, Viper, Maus, Lancer
- **5 abilities** that charge in 10 seconds: Airstrike, EMP Blast, Overdrive, Field Repair, Iron Dome
- **3 maps:** Grasslands, Desert Outpost, Winter Town, with destructible crates and sandbags
- Power-ups, mines, ricocheting shells, a shrinking danger zone, free-aim turrets and an aim line
- Campaign with night missions, a minefield, boss fights, star ratings, unlockable tanks and paint jobs
- Controller support, menu music, fullscreen

## How to run

You need [Node.js](https://nodejs.org) installed.

```
node server.js
```

Then open **http://localhost:3000** in your browser.

Local, vs CPU and campaign modes also work by opening the page from any static web host. Online mode needs `server.js`, which serves the game and relays online matches (no npm packages required).

## Online play

1. The host runs `node server.js` and opens `http://localhost:3000`.
2. The host picks **Online**, clicks **Host game** and shares the 4-letter code.
3. The other player opens the host's network address (printed in the server window, for example `http://192.168.1.23:3000`), picks **Online**, types the code and clicks **Join**.
4. The host presses **Start match**.

Both players need to be on the same network, unless the host forwards port 3000 or uses a tunnel tool.

## Controls

| Action  | Blue player | Orange player | Controller   |
|---------|-------------|---------------|--------------|
| Drive   | W / S       | ↑ / ↓         | Left stick   |
| Turn    | A / D       | ← / →         | Left stick   |
| Turret (free aim) | Q / E | , / .   | Right stick  |
| Fire    | Space       | Enter         | A / RT       |
| Mine    | F           | Right Shift   | B / LB       |
| Ability | G           | Right Ctrl    | Y            |

`Esc` pauses, `M` toggles sound, double-click the game for fullscreen.

## Project structure

```
index.html       page, menu and styles
server.js        static file server + WebSocket relay for online matches
js/maps.js       map layouts and terrain generation
js/gfx.js        tank classes, sprites, particles and effects
js/audio.js      synthesised sound effects and menu music
js/ai.js         CPU opponent
js/net.js        online client
js/campaign.js   campaign missions and progress
js/game.js       game rules, input, HUD, menu and main loop
```
