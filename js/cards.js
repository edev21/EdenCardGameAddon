"use strict";

/** @type {EdenCardClass[]} */
const EdenCardClasses = [
    {
        id: "college",
        name: "College",
        abilityName: "First Bell",
        abilityDescription: "Summons a 1/1 College Freshwoman.",
        targetSlot: true,
        effect: function(ECPlayer, boardIndex) {
            EdenSummonCard(ECPlayer, "College Freshwoman", boardIndex);
        }
    },
    {
        id: "shibari",
        name: "Shibari",
        abilityName: "Master Class",
        abilityDescription: "+2 Fame.",
        effect: function(ECPlayer) {
            EdenPlayerAddFame(ECPlayer, 2);
        }
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
        name: "aaaa",
        class: "general",
        groups: ["Student"],
        type: "Member",
        enterFame: 3,
        leaveFame: 1,
        effect: "something"
    },
    {
        id: 2,
        name: "bbbb",
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
    },

    // 1000 college
    {
        id: 1000,
        name: "Amanda",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4,
        onEnter: function(ECPlayer) {
            if (EdenCheckCardPresence(ECPlayer, "Sarah")) EdenPlayerAddFame(ECPlayer, 3);
            EdenAddGameLog(`${ECPlayer.name} gained 3 Fame from Sarah and Amanda.`);
        }
    },
    {
        id: 1001,
        name: "Sarah",
        class: "college",
        groups: ["Student", "Submissive"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4,
        effect: "+3 Fame if Amanda is present.",
        onEnter: function(ECPlayer) {
            if (EdenCheckCardPresence(ECPlayer, "Amanda")) EdenPlayerAddFame(ECPlayer, 3);
            EdenAddGameLog(`${ECPlayer.name} gained 3 Fame from Sarah and Amanda.`);
        }
    },
    {
        id: 1002,
        name: "Sidney",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: -1,
        leaveFame: 5,
        effect: "Leaves: +2 Fame per Student present.",
        onLeave: function(ECPlayer) {
            const fameGain = EdenCheckGroupCountPresence(ECPlayer, "Student") * 2;
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`${ECPlayer.name} gained ${fameGain} Fame from Sidney leaving.`);
        }
    },
    {
        id: 1003,
        name: "Jennifer",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: 3,
        leaveFame: 3,
    },
    {
        id: 1004,
        name: "Teacher's Aide",
        class: "college",
        groups: ["Student", "Teacher"],
        type: "Member",
        enterFame: 3,
        leaveFame: 3
    },
    {
        id: 1005,
        name: "Julia",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4
    },
    {
        id: 1006,
        name: "Yuki",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4
    },
    {
        id: 1007,
        name: "Mildred",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: 2,
        leaveFame: 1,
        effect: "+1 Fame when a Student leaves.",
        onMemberLeave: function(ECPlayer) {
            EdenPlayerAddFame(ECPlayer, 1);
            EdenAddGameLog(`${ECPlayer.name} gained 1 Fame from Mildred.`);
        }
    },
    {
        id: 1008,
        name: "Substitute Teacher",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4
    },
    {
        id: 1009,
        name: "Hidden Genius",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: 1,
        leaveFame: 4
    },
    {
        id: 1010,
        name: "College Freshwoman",
        class: "college",
        groups: ["Student"],
        type: "Member",
        enterFame: 1,
        leaveFame: 1,
        hidden: true
    },
];

function EdenGetCardById(cardId) {
    return EdenCardDatabase.find(card => card.id === cardId);
}

// Hidden cards can't be added to decks; they only appear through effects.
function EdenGetCardsForClass(classId) {
    return EdenCardDatabase.filter(card => !card.hidden && (card.class === "general" || card.class === classId));
}
