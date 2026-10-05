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
        name: "Merchant",
        abilityName: "Master Class",
        abilityDescription: "+2 Fame.",
        effect: function(ECPlayer) {
            EdenPlayerAddFame(ECPlayer, 2);
        }
    },
    {
        id: "guardian",
        name: "Guardian",
        abilityName: "Master Class",
        abilityDescription: "+2 Fame.",
        effect: function(ECPlayer) {
            EdenPlayerAddFame(ECPlayer, 2);
        }
    }
];


/** @type {EdenCard[]} */
const EdenCardDatabase = [
    {
        id: 1,
        name: "Accountant",
        class: "general",
        groups: ["Staff"],
        type: "Member",
        enterFame: 1,
        effect: "Enters: Draw a card.",
        onEnter: function(ECPlayer) {
            EdenPlayerDrawCard(ECPlayer, 1);
        }
    },
    // {
    //     id: 2,
    //     name: "Auctioneer",
    //     class: "general",
    //     groups: ["Staff"],
    //     type: "Member",
    //     enterFame: 3
    // },
    {
        id: 3,
        name: "Bouncer",
        class: "general",
        type: "Member",
        enterFame: 3,
        effect: "Remove a Member from your club.",
        onEnter: function(ECPlayer) {
            // todo
        }
    },
    {
        id: 4,
        name: "Cute Girl Next Door",
        class: "general",
        type: "Member",
        enterFame: 3
    },
    {
        id: 5,
        name: "Kinky Neighbor",
        class: "general",
        type: "Member",
        enterFame: 2
    },
    {
        id: 6,
        name: "Ganguro Girl",
        class: "general",
        type: "Member",
        enterFame: 3
    },
    {
        id: 7,
        name: "Country Gal",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 8,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 9,
        name: "Insurance Agent",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 10,
        name: "Local Influencer",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 11,
        name: "Party Animal",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 12,
        name: "Secretary",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 13,
        name: "Stalker",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 14,
        name: "Troublemaker",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 15,
        name: "Waitress",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 16,
        name: "Wannabe Princess",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 17,
        name: "Attention Whore",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 18,
        name: "Public Advertisment",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 19,
        name: "Uptown Girl",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 20,
        name: "Collector",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 21,
        name: "Larp Queen",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 22,
        name: "Tourist",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 23,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 24,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 25,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 26,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 27,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 28,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 29,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 30,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 31,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 32,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 33,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 34,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 35,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 36,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 37,
        name: "Gambler",
        class: "general",
        type: "Member",
        enterFame: 0
    },
    {
        id: 38,
        name: "Gambler",
        class: "general",
        type: "Member",
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
        leaveFame: 3,
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
        leaveFame: 3,
        effect: "+2 Fame if Amanda is present.",
        onEnter: function(ECPlayer) {
            if (EdenCheckCardPresence(ECPlayer, "Amanda")) EdenPlayerAddFame(ECPlayer, 2);
            EdenAddGameLog(`${ECPlayer.name} gained 2 Fame from Sarah and Amanda.`);
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
        prerequisite: "SelectOwnMember",
        enterFame: 2,
        leaveFame: 2,
        effect: "Enters: Remove a member from your club.",
        onEnter: function(ECPlayer) {

        }
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
    {
        id: 1011,
        name: "Homeroom",
        class: "college",
        type: "Event",
        effect: "+3 Fame per Student present.",
        onEnter: function(ECPlayer) {
            EdenPlayerAddFame(ECPlayer, EdenCheckGroupCountPresence(ECPlayer, "Student") * 3);
        }
    },
];

function EdenGetCardById(cardId) {
    return EdenCardDatabase.find(card => card.id === cardId);
}

// Hidden cards can't be added to decks; they only appear through effects.
function EdenGetCardsForClass(classId) {
    return EdenCardDatabase.filter(card => !card.hidden && (card.class === "general" || card.class === classId));
}
