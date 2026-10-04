interface EdenCard {
    id: number;
    name: string;
    type: string;
    class: string;
    enterFame?: number;
    leaveFame?: number;
    groups?: string[];
    effect?: string;
    canPlay?: (player: any) => boolean;
    onEnter?: (player: any) => void;
    onLeave?: (player: any) => void;
    onMemberLeave?: (player: any) => void;
    onMemberEnter?: (player: any) => void;
}

interface Window {
    EdenCardGameDeckBuilderAddonLoaded: boolean;
}