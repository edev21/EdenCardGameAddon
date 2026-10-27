"use strict";

/*
Keywords: bold in card effects and ability descriptions. Matching is exact-case and whole-word; forms lists every
spelling (default [name]). Keywords with text also get an explanation block beside the big preview.
*/
/** @type {EdenKeyword[]} */
const EdenKeywords = [
    { name: "Arrival:", text: "Happens when this card is played into your club." },
    { name: "Exit:", text: "Happens when this card leaves your club, whether it's replaced or removed." },
    { name: "Adjacent", text: "The members in the slots directly to the left and right of this card." },
    { name: "Present", text: "On your side of the board, in your club." },
    { name: "Steal", text: "Take from your opponent." },
    { name: "Entry Fame" },
    { name: "Exit Fame" }
];

/** @type {EdenCardClass[]} */
const EdenCardClasses = [
    {
        id: "college",
        name: "College",
        abilityName: "First Bell",
        abilityDescription: "Summons a 1/1 College Freshwoman.",
        targetSlot: true,
        effect: function (ECPlayer, boardIndex) {
            EdenSummonCard(ECPlayer, "College Freshwoman", boardIndex);
        }
    },
    // {
    //     id: "criminals",
    //     name: "Criminals",
    //     abilityName: "Cat Burglar",
    //     abilityDescription: "Steal 1 Fame from your opponent.",
    //     effect: function (ECPlayer) {
    //     }
    // },
    {
        id: "porn",
        name: "Porn",
        abilityName: "Porn Convention",
        abilityDescription: "Random Actress in hand gain +2 Entry Fame.",
        effect: function (ECPlayer) {
            const actresses = ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Porn Actress"));
            if (actresses.length === 0) return;
            const target = actresses[Math.floor(EdenRandom() * actresses.length)];
            target.entryFameBonus += 2;
            EdenAddGameLog(`Porn Convention gave a random Actress in ${ECPlayer.name}'s hand +2 Entry Fame.`);
        }
    }
];


// Card fields and effect hooks: see EdenCard in types.d.ts. Saved decks store ids, so never reuse or renumber them.
/** @type {EdenCard[]} */
const EdenCardDatabase = [
    // {
    //     id: 1,
    //     name: "Accountant",
    //     class: "general",
    //     groups: ["Staff"],
    //     type: "Member",
    //     exitFame: 1
    // },
    // {
    //     id: 2,
    //     name: "Auctioneer",
    //     class: "general",
    //     groups: ["Staff"],
    //     type: "Member",
    //     entryFame: 3
    // },
    {
        id: 3,
        name: "Bouncer",
        class: "general",
        type: "Member",
        entryFame: 3,
        exitFame: 1,
        effect: "Arrival: Shift your members 1 slot to the right.",
        onEnter: function (ECPlayer) {
            EdenShiftBoardRight(ECPlayer);
            EdenAddGameLog(`Bouncer shifted ${ECPlayer.name}'s members to the right.`);
        }
    },
    {
        id: 4,
        name: "Cute Girl Next Door",
        class: "general",
        type: "Member",
        entryFame: 5
    },
    {
        id: 5,
        name: "Kinky Neighbor",
        class: "general",
        type: "Member",
        entryFame: 0,
        effect: "Random Adjacent member gain +1 Exit Fame at the end of your turns.",
        onTurnEnd: function (ECPlayer, self) {
            const boardIndex = ECPlayer.board.indexOf(self);
            const adjacent = EdenGetAdjacentMembers(ECPlayer, boardIndex);
            if (adjacent.length === 0) return;
            const target = ECPlayer.board[adjacent[Math.floor(EdenRandom() * adjacent.length)]];
            target.exitFameBonus += 1;
            EdenAddGameLog(`Kinky Neighbor gave ${EdenGetCard(target)?.name} +1 Exit Fame.`);
        }
    },
    {
        id: 6,
        name: "Ganguro Girl",
        class: "general",
        type: "Member",
        exitFame: 4,
        effect: "Arrival: Both players lose 4 Fame.",
        onEnter: function (ECPlayer) {
            EdenPlayerAddFame(EdenGameState.player, -4);
            EdenPlayerAddFame(EdenGameState.opponent, -4);
            EdenAddGameLog(`Both players lost 4 Fame from Ganguro Girl.`);
        }
    },
    {
        id: 7,
        name: "Country Gal",
        class: "general",
        type: "Member",
        entryFame: 3,
        exitFame: 2
    },
    {
        id: 8,
        name: "Gambler",
        class: "general",
        type: "Member",
        entryFame: 2,
        exitFame: 1,
        effect: "Exit: 50% chance to gain double its Exit Fame.",
        onLeave: function (ECPlayer, self) {
            // Exit Fame was already added; adding it again doubles it.
            if (EdenRandom() >= 0.5) return;
            const exitFame = EdenGetExitFame(self);
            EdenPlayerAddFame(ECPlayer, exitFame);
            EdenAddGameLog(`Gambler paid out! ${ECPlayer.name} gained ${exitFame} extra Fame.`);
        }
    },
    // {
    //     id: 9,
    //     name: "Insurance Agent",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    {
        id: 10,
        name: "Local Influencer",
        class: "general",
        type: "Member",
        exitFame: 1,
        effect: "Arrival: Draw 2 cards.",
        onEnter: function (ECPlayer) {
            EdenPlayerDrawCard(ECPlayer, 2);
        }
    },
    // {
    //     id: 11,
    //     name: "Party Animal",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    {
        id: 12,
        name: "Secretary",
        class: "general",
        type: "Member",
        entryFame: -2,
        effect: "Arrival: Double your next Arrival.",
        onEnter: function (ECPlayer) {
            ECPlayer.arrivalRepeats += 1;
            EdenAddGameLog(`Secretary will double ${ECPlayer.name}'s next Arrival.`);
        }
    },
    // {
    //     id: 13,
    //     name: "Stalker",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    // {
    //     id: 14,
    //     name: "Troublemaker",
    //     class: "general",
    //     type: "Member"
    // },
    {
        id: 15,
        name: "Waitress",
        class: "general",
        type: "Member",
        entryFame: 1,
        cardSelection: "SelectOwnMember",
        effect: "Arrival: Give a member in your club +3 Exit Fame.",
        onCardSelected: function (ECPlayer, self, target) {
            if (!target) return;
            target.exitFameBonus += 3;
            EdenAddGameLog(`Waitress gave ${EdenGetCard(target)?.name} +3 Exit Fame.`);
        }
    },
    // {
    //     id: 16,
    //     name: "Wannabe Princess",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    // {
    //     id: 17,
    //     name: "Attention Whore",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    // {
    //     id: 18,
    //     name: "Public Advertisment",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    // {
    //     id: 19,
    //     name: "Uptown Girl",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    {
        id: 20,
        name: "Collector",
        class: "general",
        type: "Member",
        entryFame: 0,
        effect: "Exit: +1 Fame per group in your Backstage.",
        onLeave: function (ECPlayer) {
            const groups = new Set(ECPlayer.restingRoom.flatMap(instance => EdenGetCard(instance)?.groups ?? []));
            if (groups.size === 0) return;
            EdenPlayerAddFame(ECPlayer, groups.size);
            EdenAddGameLog(`${ECPlayer.name} gained ${groups.size} Fame from Collector leaving.`);
        }
    },
    // {
    //     id: 21,
    //     name: "Larp Queen",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },
    // {
    //     id: 22,
    //     name: "Tourist",
    //     class: "general",
    //     type: "Member",
    //     entryFame: 0
    // },

    // 1000s College: Students gain on leaving, Teachers amplify that.
    {
        id: 1000,
        name: "Amanda",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: 1,
        exitFame: 4
    },
    {
        id: 1001,
        name: "Sarah",
        class: "college",
        groups: ["Student", "Submissive"],
        type: "Member",
        entryFame: 1,
        exitFame: 4,
        effect: "Arrival: +1 Fame if next to Amanda or Sophie",
        onEnter: function (ECPlayer, self) {
            if (!EdenCheckAdjacentCardPresence(ECPlayer, self, "Amanda") && !EdenCheckAdjacentCardPresence(ECPlayer, self, "Sophie")) return;
            EdenPlayerAddFame(ECPlayer, 1);
            EdenAddGameLog(`${ECPlayer.name} gained 1 Fame from Sarah.`);
        }
    },
    {
        id: 1002,
        name: "Sidney",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: -1,
        exitFame: 3,
        effect: "Exit: +2 Fame per Student Present.",
        onLeave: function (ECPlayer) {
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
        cardSelection: "SelectOwnMember",
        entryFame: 2,
        exitFame: 2,
        effect: "Select a member to remove from your club.",
        onCardSelected: function (ECPlayer, self, target, targetPlayer, boardIndex) {
            const removed = EdenRemoveMember(targetPlayer, boardIndex);
            if (removed) EdenAddGameLog(`Jennifer removed ${removed.name}.`);
        }
    },
    {
        id: 1004,
        name: "Teacher's Aide",
        class: "college",
        groups: ["Student", "Teacher"],
        type: "Member",
        entryFame: 1,
        exitFame: 1,
        effect: "Arrival: increase Adjacent students' Exit Fame by 2.",
        onEnter: function (ECPlayer, self) {
            const boardIndex = ECPlayer.board.indexOf(self);
            const students = EdenGetAdjacentMembers(ECPlayer, boardIndex).map(i => ECPlayer.board[i]).filter(instance => EdenCardHasGroup(instance, "Student"));
            for (const student of students) {
                student.exitFameBonus += 2;
                EdenAddGameLog(`Teacher's Aide gave ${EdenGetCard(student)?.name} +2 Exit Fame.`);
            }
        }
    },
    {
        id: 1005,
        name: "Julia",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        entryFame: 1,
        exitFame: 1,
        effect: "Arrival: all students in hand gain +1 Entry Fame.",
        onEnter: function (ECPlayer) {
            const students = ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Student"));
            for (const student of students) student.entryFameBonus += 1;
            if (students.length > 0) EdenAddGameLog(`Julia gave Student(s) in ${ECPlayer.name}'s hand +1 Entry Fame.`);
        }
    },
    {
        id: 1006,
        name: "Yuki",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        entryFame: 0,
        exitFame: 1,
        effect: "Arrival: increase all students Exit Fame by 2.",
        onEnter: function (ECPlayer) {
            const students = ECPlayer.board.filter(instance => EdenCardHasGroup(instance, "Student"));
            for (const student of students) student.exitFameBonus += 2;
            if (students.length > 0) EdenAddGameLog(`Yuki gave ${students.length} Student(s) in ${ECPlayer.name}'s club +2 Exit Fame.`);
        }
    },
    {
        id: 1007,
        name: "Mildred",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: 1,
        exitFame: 0,
        effect: "Select a student to double their Exit Fame and remove them.",
        cardSelection: "SelectOwnMember",
        canSelect: function (ECPlayer, self, target) {
            return EdenCardHasGroup(target, "Student");
        },
        onCardSelected: function (ECPlayer, self, target, targetPlayer, boardIndex) {
            if (!target) return;
            // Adding the current Exit Fame as a bonus doubles it; removing pays it out.
            target.exitFameBonus += EdenGetExitFame(target);
            const removed = EdenRemoveMember(targetPlayer, boardIndex);
            if (removed) EdenAddGameLog(`Mildred doubled ${removed.name}'s Exit Fame and removed her.`);
        }
    },
    {
        id: 1008,
        name: "Substitute Teacher",
        class: "college",
        groups: ["Teacher"],
        type: "Member",
        entryFame: 0,
        exitFame: 2,
        effect: "+5 Fame if swapping a teacher when she enters.",
        onEnter: function (ECPlayer, self, replaced) {
            if (!replaced?.groups?.includes("Teacher")) return;
            EdenPlayerAddFame(ECPlayer, 5);
            EdenAddGameLog(`${ECPlayer.name} gained 5 Fame from Substitute Teacher replacing ${replaced.name}.`);
        }
    },
    {
        id: 1009,
        name: "College Hidden Genius",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: 0,
        exitFame: 5
    },
    {
        id: 1010,
        name: "College Freshwoman",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: 1,
        exitFame: 1,
        hidden: true
    },
    {
        id: 1011,
        name: "College Nerd",
        class: "college",
        groups: ["Student"],
        type: "Member",
        entryFame: 1,
        exitFame: 1,
        effect: "increases her Exit Fame by 1 whenever a teacher enters.",
        onMemberEnter: function (ECPlayer, self, entered) {
            if (!EdenCardHasGroup(entered, "Teacher")) return;
            self.exitFameBonus += 1;
            EdenAddGameLog(`College Nerd gained +1 Exit Fame from ${EdenGetCard(entered)?.name} entering.`);
        }
    },
    {
        id: 1012,
        name: "Homeroom",
        class: "college",
        type: "Event",
        effect: "Increase all students' Exit Fame by 2.",
        onEnter: function (ECPlayer) {
            const students = ECPlayer.board.filter(instance => EdenCardHasGroup(instance, "Student"));
            for (const student of students) student.exitFameBonus += 2;
            EdenAddGameLog(`Homeroom gave ${students.length} Student(s) in ${ECPlayer.name}'s club +2 Exit Fame.`);
        }
    },
    {
        id: 1013,
        name: "College Bash",
        class: "college",
        type: "Event",
        effect: "+2 Fame per student Present, 1 more if sidney is Present.",
        onEnter: function (ECPlayer) {
            const perStudent = EdenCheckCardPresence(ECPlayer, "Sidney") ? 3 : 2;
            const fameGain = EdenCheckGroupCountPresence(ECPlayer, "Student") * perStudent;
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`${ECPlayer.name} gained ${fameGain} Fame from College Bash.`);
        }
    },
    // {
    //     id: 1014,
    //     name: "Student Custodian",
    //     class: "college",
    //     groups: ["Student", "Staff"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 5
    // }

    // 2000s Porn: big Arrivals and combos, boosting cards in hand, Videos return Actresses to hand.
    {
        id: 2000,
        name: "Porn Amateur",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 0,
        exitFame: 2,
        effect: "Arrival: Random member in hand gets +2 Entry Fame.",
        onEnter: function (ECPlayer) {
            const members = ECPlayer.hand.filter(instance => EdenGetCard(instance)?.type === "Member");
            if (members.length === 0) return;
            const target = members[Math.floor(EdenRandom() * members.length)];
            target.entryFameBonus += 2;
            EdenAddGameLog(`Porn Amateur gave a member in ${ECPlayer.name}'s hand +2 Entry Fame.`);
        }
    },
    {
        id: 2001,
        name: "Cam Girl",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 1,
        effect: "Arrival: +1 Fame per Video in your Backstage.",
        onEnter: function (ECPlayer) {
            const fameGain = ECPlayer.restingRoom.filter(instance => EdenCardHasGroup(instance, "Video")).length;
            if (fameGain === 0) return;
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`${ECPlayer.name} gained ${fameGain} Fame from Cam Girl.`);
        }
    },
    {
        id: 2002,
        name: "Debuter",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 0,
        exitFame: 1,
        effect: "Arrival: Draw a random Video.",
        onEnter: function (ECPlayer) {
            if (EdenDrawMatchingCard(ECPlayer, instance => EdenCardHasGroup(instance, "Video"))) EdenAddGameLog(`Debuter drew a Video for ${ECPlayer.name}.`);
        }
    },
    {
        id: 2003,
        name: "Guest Star",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 3,
        effect: "Arrival: Gain 1 Fame per Porn Staff present.",
        onEnter: function (ECPlayer) {
            const fameGain = EdenCheckGroupCountPresence(ECPlayer, "Porn Staff");
            if (fameGain === 0) return;
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`${ECPlayer.name} gained ${fameGain} Fame from Guest Star.`);
        }
    },
    {
        id: 2004,
        name: "Porn Lesbian",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 1,
        exitFame: 0,
        effect: "Arrival: Random Actress in hand gets +2 Entry Fame.",
        onEnter: function (ECPlayer) {
            const actresses = ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Porn Actress"));
            if (actresses.length === 0) return;
            const target = actresses[Math.floor(EdenRandom() * actresses.length)];
            target.entryFameBonus += 2;
            EdenAddGameLog(`Porn Lesbian gave an Actress in ${ECPlayer.name}'s hand +2 Entry Fame.`);
        }
    },
    {
        id: 2005,
        name: "Porn Veteran",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        entryFame: 1,
        effect: "Arrival: +3-5 Entry Fame.",
        onEnter: function (ECPlayer) {
            const fameGain = 3 + Math.floor(EdenRandom() * 3);
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`${ECPlayer.name} gained ${fameGain} extra Fame from Porn Veteran.`);
        }
    },
    {
        id: 2006,
        name: "Porn Star",
        class: "porn",
        groups: ["Porn Actress"],
        type: "Member",
        exitFame: 1,
        effect: "Arrival: Double her Entry Fame.",
        onEnter: function (ECPlayer, self) {
            // Entry Fame (with bonuses) was already added; adding it again doubles it.
            const fameGain = EdenGetEntryFame(self);
            EdenPlayerAddFame(ECPlayer, fameGain);
            EdenAddGameLog(`Porn Star doubled her Entry Fame: ${ECPlayer.name} gained ${fameGain} extra Fame.`);
        }
    },
    {
        id: 2007,
        name: "Porn Movie Director",
        class: "porn",
        groups: ["Porn Staff"],
        type: "Member",
        entryFame: 0,
        exitFame: 0,
        effect: "Arrival: All Actresses in hand get +1 Entry Fame.",
        onEnter: function (ECPlayer) {
            const actresses = ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Porn Actress"));
            for (const actress of actresses) actress.entryFameBonus += 1;
            if (actresses.length > 0) EdenAddGameLog(`Porn Movie Director gave ${actresses.length} Actress(es) in ${ECPlayer.name}'s hand +1 Entry Fame.`);
        }
    },
    {
        id: 2008,
        name: "Talent Agent",
        class: "porn",
        groups: ["Porn Staff"],
        type: "Member",
        entryFame: 0,
        exitFame: 3,
        effect: "Arrival: Draw a random Actress.",
        onEnter: function (ECPlayer) {
            if (EdenDrawMatchingCard(ECPlayer, instance => EdenCardHasGroup(instance, "Porn Actress"))) EdenAddGameLog(`Talent Agent drew an Actress for ${ECPlayer.name}.`);
        }
    },
    {
        id: 2009,
        name: "Porn Addict",
        class: "porn",
        type: "Member",
        entryFame: -1,
        exitFame: 0,
        effect: "Arrival: All Porn members in hand get +1 Entry Fame.",
        onEnter: function (ECPlayer) {
            const members = ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Porn Actress") || EdenCardHasGroup(instance, "Porn Staff"));
            for (const member of members) member.entryFameBonus += 1;
            if (members.length > 0) EdenAddGameLog(`Porn Addict gave ${members.length} Porn member(s) in ${ECPlayer.name}'s hand +1 Entry Fame.`);
        }
    },
    {
        id: 2010,
        name: "Vanilla Classic",
        class: "porn",
        groups: ["Video"],
        type: "Event",
        effect: "Return an Actress to your hand. Draw a card.",
        canPlay: ECPlayer => EdenCheckGroupCountPresence(ECPlayer, "Porn Actress") >= 1,
        cannotPlayText: "Needs an Actress in your club to return.",
        cardSelection: "SelectOwnMember",
        canSelect: function (ECPlayer, self, target) {
            return EdenCardHasGroup(target, "Porn Actress");
        },
        onCardSelected: function (ECPlayer, self, target, targetPlayer, boardIndex) {
            EdenReturnToHand(targetPlayer, boardIndex);
            EdenPlayerDrawCard(ECPlayer, 1);
        }
    },
    {
        id: 2011,
        name: "Fetish Flick",
        class: "porn",
        groups: ["Video"],
        type: "Event",
        effect: "Return 2 random Actresses to your hand. Gain 2 actions.",
        canPlay: ECPlayer => EdenCheckGroupCountPresence(ECPlayer, "Porn Actress") >= 2,
        cannotPlayText: "Needs 2 Actresses in your club to return.",
        onEnter: function (ECPlayer) {
            for (let i = 0; i < 2; i++) EdenReturnRandomMember(ECPlayer, instance => EdenCardHasGroup(instance, "Porn Actress"));
            EdenGameState.actionsRemaining += 2;
            EdenAddGameLog(`${ECPlayer.name} gained 2 actions from Fetish Flick.`);
        }
    },
    {
        id: 2012,
        name: "Gangbang Banger",
        class: "porn",
        groups: ["Video"],
        type: "Event",
        effect: "Play 3 random Actresses from your hand.",
        onEnter: function (ECPlayer) {
            // Each to a different random slot, replacing whoever is there.
            const actresses = EdenShuffleArray(ECPlayer.hand.filter(instance => EdenCardHasGroup(instance, "Porn Actress"))).slice(0, 3);
            const slots = EdenShuffleArray(ECPlayer.board.map((_, i) => i));
            actresses.forEach((actress, i) => {
                ECPlayer.hand.splice(ECPlayer.hand.indexOf(actress), 1);
                EdenAddGameLog(`Gangbang Banger played ${EdenGetCard(actress)?.name}.`);
                EdenPlaceCard(ECPlayer, actress, slots[i]);
            });
        }
    },
    {
        id: 2013,
        name: "Ball Buster",
        class: "porn",
        groups: ["Video"],
        type: "Event",
        effect: "Return a random Actress to your hand and select an opposing member to remove.",
        canPlay: ECPlayer => EdenCheckGroupCountPresence(ECPlayer, "Porn Actress") >= 1,
        cannotPlayText: "Needs an Actress in your club to return.",
        cardSelection: "SelectOpponentMember",
        onEnter: function (ECPlayer) {
            EdenReturnRandomMember(ECPlayer, instance => EdenCardHasGroup(instance, "Porn Actress"));
        },
        onCardSelected: function (ECPlayer, self, target, targetPlayer, boardIndex) {
            const removed = EdenRemoveMember(targetPlayer, boardIndex);
            if (removed) EdenAddGameLog(`Ball Buster removed ${removed.name}.`);
        }
    },
    {
        id: 2014,
        name: "Re-Run",
        class: "porn",
        groups: ["Video"],
        type: "Event",
        effect: "Play a Video from your Backstage.",
        canPlay: function (ECPlayer, self) {
            return ECPlayer.restingRoom.some(instance => this.canSelect?.(ECPlayer, self, instance));
        },
        cannotPlayText: "Needs a Video in your Backstage that it can play.",
        cardSelection: "SelectOwnBackstage",
        // A playable Video, but not another Re-Run.
        canSelect: function (ECPlayer, self, target) {
            return EdenCardHasGroup(target, "Video") && EdenGetCard(target)?.name !== "Re-Run" && EdenCanPlayCard(ECPlayer, target);
        },
        onCardSelected: function (ECPlayer, self, target) {
            EdenAddGameLog(`Re-Run played ${EdenGetCard(target)?.name} again.`);
            // The Video stays in the Backstage.
            EdenRunEvent(ECPlayer, target);
        }
    },

    // 3000s Criminals (not implemented yet): Steal effects.
    // {
    //     id: 3000,
    //     name: "Junkie",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3001,
    //     name: "Pusher",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3002,
    //     name: "Sticky Fingers",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: -1,
    //     exitFame: 4,
    //     effect: "+1 Fame when you steal."
    // },
    // {
    //     id: 3003,
    //     name: "Con Artist",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: -1,
    //     exitFame: 1,
    //     effect: "Arrival: Steal 1-3 Fame."
    // },
    // {
    //     id: 3004,
    //     name: "Earner",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3005,
    //     name: "Hustler",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3006,
    //     name: "Sewer Rat",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3007,
    //     name: "Gangster",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3008,
    //     name: "Jailbird",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3009,
    //     name: "Consigliere",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 0,
    //     exitFame: 0,
    //     effect: ""
    // },
    // {
    //     id: 3010,
    //     name: "Enforcer",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: 3,
    //     exitFame: 0,
    //     effect: "Arrival: Send 2 random Criminals from your deck to the Backstage."
    // },
    // {
    //     id: 3011,
    //     name: "Stepmother",
    //     class: "criminal",
    //     groups: ["Criminal"],
    //     type: "Member",
    //     entryFame: -3,
    //     effect: "Arrival: Steal 1 Fame per Criminal in your Backstage"
    // },
    // {
    //     id: 3012,
    //     name: "Riot",
    //     class: "criminal",
    //     type: "Event",
    //     effect: "Summon 3 random Criminals from your Backstage."
    // },
    // {
    //     id: 3013,
    //     name: "Sabotage",
    //     class: "criminal",
    //     type: "Event",
    //     effect: ""
    // },
    // {
    //     id: 3014,
    //     name: "Kidnapping",
    //     class: "criminal",
    //     type: "Event",
    //     effect: "Send a random Criminal from your deck to backstage. Remove opponent's Member."
    // },
];

function EdenGetCardById(cardId) {
    return EdenCardDatabase.find(card => card.id === cardId);
}

// Deck builder pool. Hidden cards are excluded (they only appear through effects).
function EdenGetCardsForClass(classId) {
    return EdenCardDatabase.filter(card => !card.hidden && (card.class === "general" || card.class === classId));
}
