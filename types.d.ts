type prerequisite = 
    | "SelectOwnMember" 
    | "SelectOpponentMember" 
    | "SelectAnyMember"
    | "SelectOwnSlot"
;

interface EdenCard {
    id: number;
    name: string;
    type: string;
    class: string;
    enterFame?: number;
    leaveFame?: number;
    groups?: string[];
    effect?: string;
    hidden?: boolean;
    prerequisite?: prerequisite;
    canPlay?: (player: any) => boolean;
    onEnter?: (player: any) => void;
    onLeave?: (player: any) => void;
    onMemberLeave?: (player: any) => void;
    onMemberEnter?: (player: any) => void;
}

interface EdenCardClass {
    id: string;
    name: string;
    abilityName: string;
    abilityDescription: string;
    targetSlot?: boolean;
    effect: (player: any, boardIndex?: number) => void;
}

interface Window {
    EdenCardGameDeckBuilderAddonLoaded: boolean;
}