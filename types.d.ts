type cardSelection = 
    | "SelectOwnMember" 
    | "SelectOpponentMember" 
    | "SelectAnyMember"
    | "SelectOwnSlot"
    | "SelectOwnBackstage"
;

interface EdenCard {
    id: number;
    name: string;
    type: string;
    class: string;
    entryFame?: number;
    exitFame?: number;
    groups?: string[];
    effect?: string;
    hidden?: boolean;
    cardSelection?: cardSelection;
    // "self" in canPlay and the effects below is the copy of this card that triggered the effect.
    canPlay?: (player: any, self: EdenCardInstance) => boolean;
    // Shown in the hand card's tooltip while canPlay is false.
    cannotPlayText?: string;
    // replaced is the definition of the member this card replaced, or null.
    onEnter?: (player: any, self: EdenCardInstance, replaced: EdenCard | null) => void;
    onLeave?: (player: any, self: EdenCardInstance) => void;
    onMemberLeave?: (player: any) => void;
    // Runs while this card is on the board and another member enters the same board.
    onMemberEnter?: (player: any, self: EdenCardInstance, entered: EdenCardInstance) => void;
    // Runs at the end of its owner's turns while the card is on the board.
    onTurnEnd?: (player: any, self: EdenCardInstance) => void;
    // target is null when SelectOwnSlot picks an empty slot. targetPlayer owns the selected slot.
    // With SelectOwnBackstage, target is the picked card in the backstage and boardIndex is undefined.
    onCardSelected?: (player: any, self: EdenCardInstance, target: EdenCardInstance | null, targetPlayer: any, boardIndex: number) => void;
    // Optional extra filter for cardSelection targets. target is null for an empty slot.
    canSelect?: (player: any, self: EdenCardInstance, target: EdenCardInstance | null) => boolean;
}

/*
One copy of a card during a game (in a deck, hand, board or backstage).
Effects change a copy's bonuses; the EdenCard definition it points to (id) is shared and never changes.
*/
interface EdenCardInstance {
    uid: number;
    id: number;
    entryFameBonus: number;
    exitFameBonus: number;
}

interface EdenKeyword {
    name: string;
    // Every exact spelling to highlight (e.g. plurals). Defaults to [name].
    forms?: string[];
    // The explanation shown next to the big preview. No text = highlighted only.
    text?: string;
}

interface EdenCardClass {
    id: string;
    name: string;
    abilityName: string;
    abilityDescription: string;
    targetSlot?: boolean;
    effect: (player: any, boardIndex?: number) => void;
}

// The host game's globals used by the addon (they only exist when running inside the game).
declare const Player: any;
declare const bcModSdk: any;
declare const CommonCSVCache: Record<string, string[][]>;
declare function MainHallDraw(): void;
declare function MainHallWalk(roomName: string): void;
declare function CommonSetScreen(module: string, screen: string): Promise<void>;
declare function CharacterLoadNPC(characterId: string): any;
declare function CharacterSetCurrent(character: any): void;
declare function InformationSheetLoadCharacter(character: any): void;
declare function DialogLeave(): void;
declare function ScreenFileGetDialog(npcType: string, module: string, screen: string): string;
declare function DrawCharacter(character: any, x: number, y: number, zoom: number): void;
declare function DrawButton(x: number, y: number, w: number, h: number, label: string, color: string, image?: string, hoveringText?: string): void;
declare function MouseIn(x: number, y: number, w: number, h: number): boolean;
declare function DrawImageResize(source: string | HTMLImageElement, x: number, y: number, width: number, height: number): boolean;
declare function TextGet(textTag: string): string;
declare const ChatRoomCharacter: any[];
declare const ChatRoomData: any;
declare let ChatRoomMenuButtons: string[];
declare function ServerSend(message: string, data: any): void;
declare function ChatRoomSendLocal(content: string, timeout?: number): void;
declare function ChatRoomRegisterMessageHandler(handler: { Description?: string; Priority: number; Callback: (data: any, sender: any, msg: string, metadata?: any) => boolean | object | void }): void;
declare function ChatRoomCharacterIsAdmin(character: any): boolean;
declare function ChatRoomPlayerIsAdmin(): boolean;
declare function CharacterNickname(character: any): string;
declare function BackgroundsGenerateList(tags: string[]): string[];
declare const BackgroundsClubCardsTagList: string[];
declare var ClubCardBuilderCardBackCount: number;
declare function BackgroundSelectionMake(tags: string[], name: string, callback: (selection: string, setBackground: boolean) => void): void;
declare let CurrentModule: string;
declare let CurrentScreen: string;

interface Window {
    EdenCardGameDeckBuilderAddonLoaded: boolean;
}