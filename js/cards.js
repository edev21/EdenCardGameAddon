"use strict";

const EdenCardClasses = [
    {
        id: "entertainer",
        name: "Entertainer"
    },
    {
        id: "rogue",
        name: "Rogue"
    },
    {
        id: "merchant",
        name: "Merchant"
    },
    {
        id: "guardian",
        name: "Guardian"
    }
];


/** @type {EdenCard[]} */
const EdenCardDatabase = [
    {
        id: 1,
        name: "Amanda",
        class: "general",
        groups: ["Student"],
        type: "Member",
        enterFame: 3,
        leaveFame: 1,
        effect: "something"
    },
    {
        id: 2,
        name: "Sarah",
        class: "entertainer",
        groups: ["Student", "Submissive"],
        type: "Member",
        enterFame: 8,
        effect: "Enter: Gain 8 Fame."
    },
    {
        id: 3,
        name: "Manager",
        class: "entertainer",
        type: "member",
        enterFame: 2,
        effect: "Adjacent Members cost 1 less."
    },
    {
        id: 4,
        name: "Spy",
        class: "rogue",
        type: "member",
        enterFame: 4,
        effect: "Enter: Steal 4 Fame."
    },
    {
        id: 5,
        name: "Merchant",
        class: "merchant",
        type: "member",
        enterFame: 5,
        effect: "Enter: Gain 2 Money."
    },
    {
        id: 6,
        name: "Bodyguard",
        class: "guardian",
        type: "member",
        enterFame: 4,
        effect: "Protect an adjacent Member."
    },
    {
        id: 7,
        name: "Quick Fame",
        class: "general",
        type: "action",
        enterFame: 0,
        effect: "Gain 5 Fame."
    },
    {
        id: 8,
        name: "Small Sponsor",
        class: "general",
        type: "action",
        enterFame: 0
    }
];

function EdenGetCardById(cardId) {
    return EdenCardDatabase.find(card => card.id === cardId);
}

function EdenGetCardsForClass(classId) {
    return EdenCardDatabase.filter(card => card.class === "general" || card.class === classId);
}
