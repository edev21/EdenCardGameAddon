(function () {
    if (window.EdenCardGameDeckBuilderAddonLoaded) return;

    window.EdenCardGameDeckBuilderAddonLoaded = true;

    // Entry point: everything loads relative to addon.js's own URL.
    /** @type {HTMLScriptElement | null} */
    const currentScript = document.currentScript instanceof HTMLScriptElement
        ? document.currentScript
        : document.querySelector("script[src$='addon.js'], script[src*='addon.js?']");

    if (!currentScript) {
        console.error("Could not find addon.js location.");
        return;
    }

    const baseUrl = new URL("../", currentScript.src).href;

    let container = document.getElementById("eden-card-game-deck-builder");

    if (!container) {
        container = document.createElement("div");
        container.id = "eden-card-game-deck-builder";
        document.body.appendChild(container);
    }

    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = baseUrl + "css/deck-builder.css";
    document.head.appendChild(style);

    // Loads scripts in order, one at a time; later files depend on earlier ones. New script files go in the list below.
    /**
    * @param {string[]} files
    * @param {number} index
    */
    function EdenLoadScripts(files, index = 0) {
        if (index === files.length) {
            EdenShowOpenButton();
            EdenShowGameOpenButton();
            return;
        }

        const script = document.createElement("script");
        script.src = baseUrl + "js/" + files[index];
        script.onload = () => EdenLoadScripts(files, index + 1);
        script.onerror = () => console.error(`Card Game Addon failed to load ${files[index]}.`);
        document.head.appendChild(script);
    }

    EdenLoadScripts(["cards.js", "deck-storage.js", "card-renderer.js", "deck-builder.js", "eden-settings.js", "card-game-state.js", "card-game.js", "eden-room.js", "eden-online.js"]);
})();