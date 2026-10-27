/*
The Eden Card Club room inside the host game (Bondage Club).
- A main hall button (drawn via bcModSdk hooks on MainHallDraw/MainHallClick) walks to the room.
- The room is a normal screen ("Room", "EdenCardClub") modeled on ClubCardLounge: background, player, dealer NPC, buttons.
- The dealer's dialog opens the card game or the deck builder.
Room text and dialog normally come from server CSV files; the addon puts them in CommonCSVCache instead (checked before any fetch).
Outside the host game (index.html) this file does nothing; the floating Open buttons are used instead.
*/

const EdenRoomName = "EdenCardClub";
const EdenRoomDealerName = "NPC_EdenCardClub_Dealer";

// bcModSdk ships with the game, so both exist whenever the addon runs inside it.
const EdenInHostGame = typeof bcModSdk !== "undefined" && typeof MainHallDraw === "function";

// The addon's only bcModSdk registration, shared with eden-online.js (a mod can only register once).
const EdenModApi = EdenInHostGame ? bcModSdk.registerMod({ name: "EdenCardGame", fullName: "Eden Card Game", version: "1.0.0" }) : null;

// Free main hall slot, right above the game's Club Card button (1525, 385).
const EdenMainHallButton = { x: 1525, y: 265, w: 90, h: 90 };
// Loaded as an Image here: passing a URL to the game's draw functions makes it use a CORS request, which can fail.
const EdenMainHallLogo = new Image();
EdenMainHallLogo.addEventListener("error", () => console.warn(`Eden Card Game: could not load the main hall logo from ${EdenMainHallLogo.src}`));
EdenMainHallLogo.src = `${EdenAddonAssets}edenLogo.png`;

// Screen globals; the game finds them by name: `${screen}Background`, `${screen}Load`, `${screen}Run`, `${screen}Click`.
var EdenCardClubBackground = "ClubCardLounge";
/** @type {any} */
var EdenCardClubDealer = null;

async function EdenCardClubLoad() {
    if (EdenCardClubDealer == null) {
        EdenCardClubDealer = CharacterLoadNPC(EdenRoomDealerName);
        EdenCardClubDealer.AllowItem = false;
    }
}

function EdenCardClubRun() {
    DrawCharacter(Player, 500, 0, 1);
    DrawCharacter(EdenCardClubDealer, 1000, 0, 1);
    DrawButton(1885, 25, 90, 90, "", "White", "Icons/Exit.png", TextGet("Exit"));
    DrawButton(1885, 140, 90, 90, "", "White", "Icons/Character.png", TextGet("Profile"));
    // Logo drawn on top, shrunk to icon size (see the MainHallDraw hook).
    DrawButton(1885, 255, 90, 90, "", "White", "", TextGet("Build"));
    DrawImageResize(EdenMainHallLogo, 1887, 257, 86, 86);
}

function EdenCardClubClick() {
    if (MouseIn(500, 0, 500, 1000)) CharacterSetCurrent(Player);
    if (MouseIn(1000, 0, 500, 1000)) CharacterSetCurrent(EdenCardClubDealer);
    if (MouseIn(1885, 25, 90, 90)) CommonSetScreen("Room", "MainHall");
    if (MouseIn(1885, 140, 90, 90)) InformationSheetLoadCharacter(Player);
    if (MouseIn(1885, 255, 90, 90)) EdenOpenCardGameDeckBuilder();
}

// Dialog functions get the room name prefixed: "PlayGame()" runs EdenCardClubPlayGame.
function EdenCardClubPlayGame() {
    DialogLeave();
    EdenOpenCardGame();
}

function EdenCardClubBuildDecks() {
    DialogLeave();
    EdenOpenCardGameDeckBuilder();
}

// Room text and dealer dialog, in the game's CSV columns. Dialog: Stage, NextStage, Option, Result, Function.
function EdenRegisterRoomText() {
    CommonCSVCache[`Screens/Room/${EdenRoomName}/Text_${EdenRoomName}.csv`] = [
        ["Exit", "Return to the Club"],
        ["Profile", "Your Profile"],
        ["Build", "Build your decks"]
    ];

    CommonCSVCache[ScreenFileGetDialog(EdenRoomDealerName, "Room", EdenRoomName)] = [
        ["PlayerGagged", "", "", "(She looks at you and smiles.)  Come back when you can talk, then we'll play.", ""],
        ["0", "", "", "Welcome to the Eden Card Club.  Care for a game?", ""],
        ["0", "", "Who are you?", "I'm DialogCharacterName.  I run the card tables here.", "DialogRemove()"],
        ["0", "", "Let's play a game.", "", "PlayGame()"],
        ["0", "", "I want to edit my decks.", "", "BuildDecks()"],
        ["0", "", "I need to go.  (Leave her.)", "", "DialogLeave()"]
    ];
}

function EdenCanWalkFromMainHall() {
    return Player.CanWalk() && (!Player.IsRestrained() || !Player.GameplaySettings.OfflineLockedRestrained);
}

function EdenRegisterMainHallButton() {
    EdenModApi.hookFunction("MainHallDraw", 0, (args, next) => {
        next(args);
        const b = EdenMainHallButton;
        if (!EdenCanWalkFromMainHall()) return;
        // DrawButton draws images at full size and the logo is bigger than the 86x86 icons, so it's drawn on top, shrunk.
        DrawButton(b.x, b.y, b.w, b.h, "", "White", "", "Eden Card Club");
        DrawImageResize(EdenMainHallLogo, b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    });

    EdenModApi.hookFunction("MainHallClick", 0, (args, next) => {
        const b = EdenMainHallButton;
        // Checked first, so no vanilla button reacts to the same click.
        if (EdenCanWalkFromMainHall() && MouseIn(b.x, b.y, b.w, b.h)) {
            MainHallWalk(EdenRoomName);
            return;
        }
        next(args);
    });
}

if (EdenInHostGame) {
    EdenRegisterRoomText();
    EdenRegisterMainHallButton();
    // The dealer replaces the floating Open buttons inside the game (see deck-builder.css).
    document.documentElement.classList.add("eden-in-host-game");
}
