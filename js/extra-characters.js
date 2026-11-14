// Travellers, Fabled and experimental characters (from the BotCStoryTeller data) used as a fallback for custom scripts.
const EXTRA_CHARACTERS = {
"scapegoat": {
"name": "Scapegoat",
"team": "traveller",
"ability": "If a player of your alignment is executed, you might be executed instead."
},
"gunslinger": {
"name": "Gunslinger",
"team": "traveller",
"ability": "Each day, after the 1st vote has been tallied, you may choose a player that voted: they die."
},
"beggar": {
"name": "Beggar",
"team": "traveller",
"ability": "You must use a dead player's vote token to vote. Dead players may choose not to give you their vote token. You are sober and healthy."
},
"bureaucrat": {
"name": "Bureaucrat",
"team": "traveller",
"ability": "Each night, choose a player (not yourself): their vote counts as 3 votes tomorrow."
},
"thief": {
"name": "Thief",
"team": "traveller",
"ability": "Each night, choose a player (not yourself): their vote counts as -1 vote tomorrow."
},
"butcher": {
"name": "Butcher",
"team": "traveller",
"ability": "Each day, after the 1st execution, you may nominate again."
},
"bonecollector": {
"name": "Bone Collector",
"team": "traveller",
"ability": "Once per game, at night, choose a dead player: they regain their ability until dusk."
},
"harlot": {
"name": "Harlot",
"team": "traveller",
"ability": "Each night, choose a living player: if they agree, you learn their character, but you might die."
},
"barista": {
"name": "Barista",
"team": "traveller",
"ability": "Each night, until dusk, 1) make a player sober, healthy, and their ability works, or 2) make a player drunk. They don't know which."
},
"deviant": {
"name": "Deviant",
"team": "traveller",
"ability": "If you were funny today, you cannot be exiled."
},
"apprentice": {
"name": "Apprentice",
"team": "traveller",
"ability": "On your 1st night, you gain a Townsfolk ability (if good) or a Minion ability (if evil)."
},
"matron": {
"name": "Matron",
"team": "traveller",
"ability": "Each day, you may choose up to 3 sets of 2 players to swap seats. Players must remain in a seat."
},
"voudon": {
"name": "Voudon",
"team": "traveller",
"ability": "Only you and the dead can vote. Dead players need not use their vote token to vote."
},
"judge": {
"name": "Judge",
"team": "traveller",
"ability": "Once per game, if another player nominated, you may choose to force the current execution to pass or fail."
},
"bishop": {
"name": "Bishop",
"team": "traveller",
"ability": "Only the Storyteller can nominate. At least 1 Minion must be nominated each day."
},
"cacklejack": {
"name": "Cacklejack",
"team": "traveller",
"ability": "If the Demon is executed, good wins \u2014 even if you are dead. Each day, if 3+ players nominate, you die."
},
"gangster": {
"name": "Gangster",
"team": "traveller",
"ability": "Once per day, with the Storyteller's permission, you may choose a player of your alignment to die: another player of your alignment dies instead."
},
"gnome": {
"name": "Gnome",
"team": "traveller",
"ability": "On your first night, you learn if the Demon and Minion(s) are neighbouring. If they are, you learn who the Demon is."
},
"acrobat": {
"name": "Acrobat",
"team": "townsfolk",
"ability": "Each night*, if either alive neighbour is drunk or poisoned, you might die."
},
"alchemist": {
"name": "Alchemist",
"team": "townsfolk",
"ability": "You have a not-in-play Minion ability."
},
"amnesiac": {
"name": "Amnesiac",
"team": "townsfolk",
"ability": "You do not know what your ability is. Each day, you may privately ask the Storyteller what it is. Once per game, you may guess it."
},
"atheist": {
"name": "Atheist",
"team": "townsfolk",
"ability": "The Storyteller can break the game rules, and is doing so. [No evil players. The Storyteller may be executed.] If all Atheists are dead, evil wins."
},
"balloonist": {
"name": "Balloonist",
"team": "townsfolk",
"ability": "Each night, you learn 1 player of each character type, until there are no more character types to learn. [+0 or +1 Outsider]"
},
"banshee": {
"name": "Banshee",
"team": "townsfolk",
"ability": "If the Demon kills you, all players learn this immediately. You may nominate twice per day and vote twice per nomination."
},
"bountyHunter": {
"name": "Bounty Hunter",
"team": "townsfolk",
"ability": "You start knowing 1 evil player. If the player you know dies, you learn another evil player tonight. [+1 Outsider]"
},
"cannibal": {
"name": "Cannibal",
"team": "townsfolk",
"ability": "You have the ability of the most recently executed player. If that player was evil, you are poisoned."
},
"choirboy": {
"name": "Choirboy",
"team": "townsfolk",
"ability": "If the Demon kills the King, you learn who the Demon is. [+ the King]"
},
"cultLeader": {
"name": "Cult Leader",
"team": "townsfolk",
"ability": "Each night, you become the alignment of an alive neighbour. If all good players join your cult, your team wins."
},
"engineer": {
"name": "Engineer",
"team": "townsfolk",
"ability": "Once per game, at night, choose which Minions or which Demon is in play."
},
"farmer": {
"name": "Farmer",
"team": "townsfolk",
"ability": "Once per game, if you are executed, another good player also becomes a Farmer tonight."
},
"fisherman": {
"name": "Fisherman",
"team": "townsfolk",
"ability": "Once per game, during the day, visit the Storyteller for some advice to help your team win."
},
"flood": {
"name": "Flood",
"team": "townsfolk",
"ability": "Once per game, at night, each Minion is drunk until dusk."
},
"general": {
"name": "General",
"team": "townsfolk",
"ability": "Each night, you learn which alignment the Storyteller believes is currently winning: good, evil, or neither."
},
"highPriestess": {
"name": "High Priestess",
"team": "townsfolk",
"ability": "Each night, learn which player the Storyteller believes you should talk to."
},
"huntsman": {
"name": "Huntsman",
"team": "townsfolk",
"ability": "Once per game, at night, choose a living player: the Damsel, if chosen, becomes a not-in-play Townsfolk. [+ the Damsel]"
},
"king": {
"name": "King",
"team": "townsfolk",
"ability": "Each night, if the dead outnumber the living, you learn 1 alive character. The Choirboy, if in play, knows you are the King."
},
"knight": {
"name": "Knight",
"team": "townsfolk",
"ability": "You start knowing 2 players that are not the Demon."
},
"lycanthrope": {
"name": "Lycanthrope",
"team": "townsfolk",
"ability": "Each night*, choose a player: if good, they die, but they are the only player that can die tonight."
},
"magician": {
"name": "Magician",
"team": "townsfolk",
"ability": "The Demon thinks you are a Minion. Minions think you are a Demon."
},
"nightwatchman": {
"name": "Nightwatchman",
"team": "townsfolk",
"ability": "Once per game, at night, choose a player: they learn who you are."
},
"noble": {
"name": "Noble",
"team": "townsfolk",
"ability": "You start knowing 3 players, exactly 1 of which is evil."
},
"organist": {
"name": "Organist",
"team": "townsfolk",
"ability": "If the Evil team wins by executing the King, good wins instead."
},
"pixie": {
"name": "Pixie",
"team": "townsfolk",
"ability": "You start knowing 1 in-play Townsfolk. If you were mad that you are this character, you gain their ability when they die."
},
"plagueDoctor": {
"name": "Plague Doctor",
"team": "townsfolk",
"ability": "If you die, the Storyteller gains a not-in-play Minion ability."
},
"poppyGrower": {
"name": "Poppy Grower",
"team": "townsfolk",
"ability": "Minions do not know each other or the Demon. If you die, they learn who each other are tonight."
},
"preacher": {
"name": "Preacher",
"team": "townsfolk",
"ability": "Each night, choose a player: a Minion, if chosen, loses their ability."
},
"steward": {
"name": "Steward",
"team": "townsfolk",
"ability": "You start knowing 1 player that is not evil."
},
"stormCatcher": {
"name": "Storm Catcher",
"team": "townsfolk",
"ability": "Once per game, name a player: if evil, they cannot use their ability tonight."
},
"damsel": {
"name": "Damsel",
"team": "outsider",
"ability": "All Minions know a Damsel is in play. Once per game, a Minion publicly guesses which player you are: if correct, evil wins."
},
"golem": {
"name": "Golem",
"team": "outsider",
"ability": "You may only nominate once per game. If you nominate the Demon, the Demon does not die."
},
"heretic": {
"name": "Heretic",
"team": "outsider",
"ability": "Whoever wins, loses. Whoever loses, wins."
},
"puzzlemaster": {
"name": "Puzzlemaster",
"team": "outsider",
"ability": "1 player is drunk, even if you die. If you guess (once) who it is while talking to the Storyteller, you win."
},
"snitch": {
"name": "Snitch",
"team": "outsider",
"ability": "Minions start knowing 3 not-in-play characters (in addition to what they already know)."
},
"boomdandy": {
"name": "Boomdandy",
"team": "minion",
"ability": "If you are executed, and 3 or fewer players are alive, all but the 3 players with the most votes die."
},
"cerenovus": {
"name": "Cerenovus",
"team": "minion",
"ability": "Each night, choose a player and a good character: they are 'mad' about being that character tomorrow, or they might die."
},
"fearmonger": {
"name": "Fearmonger",
"team": "minion",
"ability": "Each night, choose a player: if you have publicly claimed to be the Fearmonger and this player is nominated, the nomination fails."
},
"goblin": {
"name": "Goblin",
"team": "minion",
"ability": "If you publicly claim to be the Goblin and are then executed, evil wins."
},
"marionette": {
"name": "Marionette",
"team": "minion",
"ability": "You think you are a good character, but you are not. The Demon knows who you are. [You must be a neighbour of the Demon]"
},
"organGrinder": {
"name": "Organ Grinder",
"team": "minion",
"ability": "All players keep their eyes closed when voting and the vote tally is secret. If you are nominated, you must nominate before any execution occurs."
},
"psychopath": {
"name": "Psychopath",
"team": "minion",
"ability": "Each day, if you publicly announce that you are the Psychopath, you may choose a player to die. You start knowing the Demon."
},
"summoner": {
"name": "Summoner",
"team": "minion",
"ability": "On the 3rd night, choose a player: they become the Demon of your choice."
},
"widow": {
"name": "Widow",
"team": "minion",
"ability": "On your 1st night, look at the Grimoire and choose a player: they are poisoned. 1 good player knows a Widow is in play."
},
"kazali": {
"name": "Kazali",
"team": "demon",
"ability": "Each night*, choose a player: they die. [No Minions. Instead, choose up to the number of Minions that would be in play to convert good players to Minions during setup.]"
},
"lleech": {
"name": "Lleech",
"team": "demon",
"ability": "Each night*, choose a player: they die. You have a host. If your host dies, you die instead. [Choose a host at the start - they do not know.]"
},
"lilMonsta": {
"name": "Lil' Monsta",
"team": "demon",
"ability": "Each night, a Minion babysits you by choosing to kill. Minions know who you are. Evil wins when the babysitting Minion dies. [The babysitting Minion holds the Demon token.]"
},
"po": {
"name": "Po",
"team": "demon",
"ability": "Each night*, you may choose a player: they die. If your last choice was no-one, choose 3 players tonight."
},
"riot": {
"name": "Riot",
"team": "demon",
"ability": "Nominations cause immediate execution. All players may nominate immediately and multiple times. At the end of the final day, Riot nominates the last player alive."
},
"djinn": {
"name": "Djinn",
"team": "fabled",
"ability": "Use the Djinn's special rule. All players know what it is."
},
"spiritOfIvory": {
"name": "Spirit of Ivory",
"team": "fabled",
"ability": "There cannot be more than 1 extra evil player."
},
"hellsLibrarian": {
"name": "Hell's Librarian",
"team": "fabled",
"ability": "Something bad might happen to whoever talks when the Storyteller calls for silence."
},
"angel": {
"name": "Angel",
"team": "fabled",
"ability": "Something bad might happen to whoever is most responsible for the death of a new player."
},
"sentinel": {
"name": "Sentinel",
"team": "fabled",
"ability": "There might be 1 extra or 1 fewer Outsider in play."
},
"buddhist": {
"name": "Buddhist",
"team": "fabled",
"ability": "For the first 2 minutes of each day, veteran players may not speak."
},
"ferryman": {
"name": "Ferryman",
"team": "fabled",
"ability": "On the final day, 1 dead player may vote as if they were alive."
},
"toymaker": {
"name": "Toymaker",
"team": "fabled",
"ability": "The Demon may choose not to attack on the last night. Good wins if so."
},
"gardener": {
"name": "Gardener",
"team": "fabled",
"ability": "The Storyteller may place 1 or more players on a different starting character than the one they were assigned."
},
"duchess": {
"name": "Duchess",
"team": "fabled",
"ability": "Once per game, 3 players may each ask the Storyteller if they are evil. The Storyteller answers truthfully."
},
"revolutionary": {
"name": "Revolutionary",
"team": "fabled",
"ability": "2 neighbouring players are known to be the same alignment. Once per game, 1 of them may register falsely."
},
"stormCatcherFabled": {
"name": "Storm Catcher",
"team": "fabled",
"ability": "Name 1 character. If that character is in play, they are safe from the Demon. If they are not in play, a Minion learns which character you named."
}
};
