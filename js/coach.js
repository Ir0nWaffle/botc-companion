// Bluff coaching text. Pure data, written to be read in seconds at a live table.
// Every line follows the ability wording in js/data.js ("*" after "Each night" means not the first night).
//   pitch  = why or when this is a good bluff      say    = lines you could say out loud
//   reveal = when to claim it, and why             prep   = what to have ready before you are asked
//   risk   = how this bluff gets caught
// Drunk and Lunatic are left out on purpose: nobody is told they are one, so nobody can claim it.

const BLUFF_COACH = {
  // ── Trouble Brewing ──
  washerwoman: {
    pitch: "One piece of Night 1 info and nothing nightly, so there is very little to keep straight.",
    say: ["I'm the Washerwoman. I was shown [name] and [name], and one of them is the [Townsfolk role].", "Only one of those two is that role. I can't say which."],
    reveal: "Early is fine. It is one-time info, and sharing it early makes it look like you have nothing to hide.",
    prep: "Two player names and one Townsfolk role, decided now and written down so you repeat the same pair.",
    risk: "A real Washerwoman with different names, or the real owner of the role you named, contradicts you."
  },
  librarian: {
    pitch: "Night 1 only. Saying \"zero Outsiders\" needs no names at all, so there is nothing to slip on.",
    say: ["I'm the Librarian. I learned there are no Outsiders in play.", "I'm the Librarian. One of [name] and [name] is the [Outsider role]."],
    reveal: "Early is fine. Your info is one-time, and the table will want it while it is counting Outsiders.",
    prep: "Decide now: \"zero\", or two names plus one Outsider role. Write it down and keep it identical.",
    risk: "Any Outsider claim contradicts \"zero\". Naming an Outsider role clashes with whoever really holds it."
  },
  investigator: {
    pitch: "One Night 1 ping that points at two players, which lets you steer suspicion without a nightly story.",
    say: ["I'm the Investigator. One of [name] and [name] is the [Minion role].", "I only know it is one of those two, not which."],
    reveal: "Early works, since it is one-time info. Waiting until someone doubts you makes it look invented.",
    prep: "Two player names and one Minion role from this script, written down before anyone asks.",
    risk: "A real Investigator with different names contradicts you, and the two players you name will push back hard."
  },
  chef: {
    pitch: "A single Night 1 number, and a small number is easy to say and hard to disprove.",
    say: ["I'm the Chef. My number is [0, 1 or 2]: that many pairs of evil players sit next to each other."],
    reveal: "Early is fine. One number is cheap to share, and holding it back looks suspicious.",
    prep: "One number and a quick look at the seating, so you know which neighbours it would point at.",
    risk: "A real Chef with another number contradicts you. A high number claims evil players sit side by side, and players will test that."
  },
  empath: {
    pitch: "Strong when you sit between players the table trusts, because a 0 clears them and costs you little.",
    say: ["I'm the Empath. Last night I got a [0, 1 or 2] from my two neighbours."],
    reveal: "Early is fine. Your info gets stale each night, so share it while it is fresh.",
    prep: "A number for every night so far, matched to who your alive neighbours were then. Neighbours change as people die.",
    risk: "Your neighbours know their own alignment. A 1 or 2 accuses someone beside you, and they will answer."
  },
  fortuneteller: {
    pitch: "Good if you can name two players each night and give believable yes/no answers that fit the table.",
    say: ["I'm the Fortune Teller. Last night I picked [name] and [name]: no Demon there.", "I got a yes on [name] and [name]. One could be the Demon, or the red herring."],
    reveal: "Early is fine, but hold a yes result until you know whom you want suspected.",
    prep: "Two names and a yes or no for every night so far. Remember your ability has a red herring, a good player who registers as a Demon.",
    risk: "Each night's picks must stay consistent. A yes on someone the table trusts means you called them the Demon or the red herring."
  },
  undertaker: {
    pitch: "Easy to fake. You only speak about whoever was executed, and the table already saw who that was.",
    say: ["I'm the Undertaker. Last night I learned the executed player was the [role].", "No execution yesterday, so I learned nothing."],
    reveal: "Share after an execution, since that is when your info is useful. Nothing to say on Night 1.",
    prep: "A role for each execution, and none for Night 1 or a day without an execution. Know what the executed player claimed.",
    risk: "If the role you name differs from what that player claimed, you are calling them a liar, and a real Undertaker can contradict you."
  },
  monk: {
    pitch: "Simple story: one name per night from Night 2. The protection is invisible when nobody is attacked.",
    say: ["I'm the Monk. Last night I protected [name]."],
    reveal: "Hold back at first. Claim when the table needs to know who is safe, or when it starts asking who you are.",
    prep: "One protected player for each night from Night 2 on, never yourself. Nothing to report on Night 1.",
    risk: "If someone you claim to have protected dies to the Demon that night, you are caught, unless you blame poison or drunkenness."
  },
  ravenkeeper: {
    pitch: "A living Ravenkeeper has no info yet, so there is nothing to invent while you are alive.",
    say: ["I'm the Ravenkeeper. I only learn something if I die at night, so I have nothing yet."],
    reveal: "Fine to claim early because you have no info to give. Expect to be asked to prove it only after you die.",
    prep: "If you die at night, you will need a player you \"looked at\" and the character you saw. Choose them in advance.",
    risk: "Nothing tests you while you live. After a night death, the player you named can contradict the character you give."
  },
  virgin: {
    pitch: "Scares the table off nominating you, since a Townsfolk nominator is executed the first time.",
    say: ["I'm the Virgin. The first time I'm nominated, if the nominator is a Townsfolk, they are executed on the spot.", "Go ahead and nominate me if you are sure you are not a Townsfolk."],
    reveal: "Hold back until you are pressed or threatened. Claiming early invites a test you may fail.",
    prep: "Nothing nightly. Know that it triggers only on the first nomination of you, and only if the nominator is a Townsfolk.",
    risk: "If a Townsfolk nominates you first and nobody is executed, you are caught. A real Virgin could be drunk or poisoned, but that is a weak excuse."
  },
  slayer: {
    pitch: "No nightly story, and the table cannot easily call your bluff before you act.",
    say: ["I'm the Slayer. I have one shot, and I'm saving it.", "I'm the Slayer. I choose [name]."],
    reveal: "Hold back. Claim when you want to threaten someone, or the town needs a Slayer. Your shot is public and used only once.",
    prep: "A target in mind and a calm line for when nothing happens. A real Slayer also sees nothing if the target is not the Demon.",
    risk: "A second shot exposes you. A fake shot never kills anyone, which looks the same as a real Slayer missing a non-Demon."
  },
  soldier: {
    pitch: "No info to invent. The claim is only that the Demon cannot kill you.",
    say: ["I'm the Soldier. The Demon can't kill me, so don't waste time guarding me."],
    reveal: "Share it when the table talks about who the Demon might target, or when you are pressed. Nothing to gain from rushing.",
    prep: "Nothing nightly. Just be ready to repeat the claim the same way every time.",
    risk: "If the Demon kills you at night, the claim is false, unless you say you were drunk or poisoned. Executions can still kill you."
  },
  mayor: {
    pitch: "Good players are slow to execute a claimed Mayor, and it gives you a reason to push for no execution late.",
    say: ["I'm the Mayor. If it comes down to three of us, we skip the execution and win."],
    reveal: "Hold back until you are threatened or the count gets low. An early claim may draw a night kill.",
    prep: "Nothing nightly. Know the condition: exactly 3 players alive and no execution that day.",
    risk: "If the day ends at 3 alive with no execution and the game does not end, you were not the Mayor, unless drunk or poisoned."
  },
  butler: {
    pitch: "An Outsider claim that explains why you hold back your vote, and that is easy to honour in public.",
    say: ["I'm the Butler. Each night I pick a master, and I can only vote when my master votes too."],
    reveal: "Claim early. Good Outsiders usually say so quickly, and a late Outsider claim looks like a bluff.",
    prep: "A master for every night, and your votes must match: vote only when that master votes that day.",
    risk: "Votes are public. A vote cast while your named master is not voting exposes you, and it adds to the Outsider count the table checks."
  },
  recluse: {
    pitch: "No info to invent, and it gives you a ready answer if someone calls you evil.",
    say: ["I'm the Recluse. I might register as evil, even a Minion or Demon, so don't trust a check on me too much."],
    reveal: "Claim early. A good Outsider says it quickly, and it explains odd results before they cause trouble.",
    prep: "Nothing nightly. Be ready to say who has checked or accused you, and what they said.",
    risk: "It counts as an Outsider claim. A second Recluse claim, or a full Outsider count, contradicts you."
  },
  saint: {
    pitch: "Deters execution: if a real Saint is executed, the good team loses for good.",
    say: ["I'm the Saint. If you execute me, my team loses.", "Careful: executing me would lose the game for the town."],
    reveal: "Say it when you are nominated or near the block, so it works as a shield without painting you early.",
    prep: "Nothing nightly. Be ready to say it flatly: it is a statement of risk, not a plea.",
    risk: "If you are executed and the game goes on, you are exposed (unless you say you were drunk or poisoned)."
  },

  // ── Bad Moon Rising ──
  grandmother: {
    pitch: "One Night 1 fact. The claim is just a good player and their character, plus a built-in warning about their death.",
    say: ["I'm the Grandmother. My grandchild is [name], and they are the [role].", "If the Demon kills [name], I die too."],
    reveal: "Early is fine, since it helps the town protect your grandchild. Keep the pick plausible first.",
    prep: "One good player and their real character, which should fit what they claim. Not an evil teammate.",
    risk: "If the Demon kills your named grandchild and you do not die, you are exposed. The grandchild can also deny the character."
  },
  sailor: {
    pitch: "Your story is one name per night, and the claim \"I can't die\" is hard to test early.",
    say: ["I'm the Sailor. Last night I picked [name]. Either they or I were drunk until dusk, and I can't die."],
    reveal: "Fine to claim early. It shows the town you are hard to kill, but give your nightly pick when asked.",
    prep: "One alive player for every night, starting on Night 1. Keep the list written down.",
    risk: "Any death of yours breaks the claim, unless you say you were drunk. A named player may say they were fine."
  },
  chambermaid: {
    pitch: "Each night you give a small number about two players. The table can only test it by asking those players.",
    say: ["I'm the Chambermaid. Last night I checked [name] and [name], and [0, 1 or 2] of them woke due to their ability."],
    reveal: "Early works. It lets the table learn who has a night ability, which is useful and hard to disprove.",
    prep: "Two names (not yourself) and a number from 0 to 2 for every night, starting Night 1.",
    risk: "A 1 or 2 says that player has a night ability. If their claimed role does not wake at night, they will say so."
  },
  exorcist: {
    pitch: "From Night 2 you only name one player a night. The Demon's side of the effect is invisible to the table.",
    say: ["I'm the Exorcist. Last night I chose [name]."],
    reveal: "Hold back at first. Claim when the table starts asking who is guarding what.",
    prep: "A different player each night from Night 2 on, and nothing on Night 1. Keep the list written down.",
    risk: "Repeating a name two nights in a row breaks the rule. The table only has your word for the rest."
  },
  innkeeper: {
    pitch: "Naming two protected players each night is an easy story that the table cannot check directly.",
    say: ["I'm the Innkeeper. Last night I covered [name] and [name]. They can't die tonight."],
    reveal: "Fine to claim after the first night. It also gives the town a reason to expect no deaths among your picks.",
    prep: "Two names for each night from Night 2 on. Nothing on Night 1.",
    risk: "If either named player dies that night, you are exposed. Also one of your two is drunk until dusk, so a named player might report odd info."
  },
  gambler: {
    pitch: "A dangerous claim: a wrong guess kills you, so only claim guesses you can back up.",
    say: ["I'm the Gambler. Last night I picked [name] and guessed [role]. I'm still here, so I was right."],
    reveal: "Hold back until you have a guess you can safely support, or you are pressed.",
    prep: "From Night 2, one player and a guessed character each night, matching what that player says they are.",
    risk: "A living Gambler guessed right every time. A target who denies your guess exposes you."
  },
  gossip: {
    pitch: "No Night 1 info, and your story is a day statement that may be followed by a night death.",
    say: ["I'm the Gossip. Today my statement is: [statement]. If it is true, someone dies tonight."],
    reveal: "Wait until you can pair a statement with a night death, or you are pressed to prove yourself.",
    prep: "A public statement for each day you claim to use it. Know which one you say is true.",
    risk: "Statements are public. A true-sounding statement followed by a quiet night weakens the claim."
  },
  courtier: {
    pitch: "A one-time ability. One night and one named character is all the story you need.",
    say: ["I'm the Courtier. On Night [N] I chose the [character]. They are drunk for 3 nights and 3 days."],
    reveal: "Hold back until you want a role's info doubted. It is a public accusation of their drunkenness.",
    prep: "One night, one character, and what you expect that role's info to look like for 3 nights and 3 days.",
    risk: "A second use exposes you. A named claimant's info is unreliable by your own claim."
  },
  professor: {
    pitch: "A one-time, Night 2 or later ability. Claim a failed try and it is hard to disprove.",
    say: ["I'm the Professor. On Night [N] I chose [dead player]. They were not a Townsfolk, so nothing happened."],
    reveal: "Hold back until there is a dead player worth reviving, or you are pressed.",
    prep: "One night, one dead player, and a result: they came back, or nothing happened.",
    risk: "A named player who was a Townsfolk must visibly return. A second use exposes you."
  },
  minstrel: {
    pitch: "Nothing to report until a Minion is executed, so there is little to invent.",
    say: ["I'm the Minstrel. If a Minion is executed, everyone else is drunk until dusk the next day."],
    reveal: "Hold back. Claim after a Minion is executed, or when the table is deciding whether to trust someone's info.",
    prep: "Nothing nightly. Know the trigger: a Minion dying by execution, and everyone else drunk until dusk tomorrow.",
    risk: "After a Minion is executed, everyone else's info is unreliable by your claim. If the table sees normal info, you may be doubted."
  },
  tealady: {
    pitch: "No info to invent. The claim is that your two alive neighbours are safe if both are good.",
    say: ["I'm the Tea Lady. If both of my alive neighbours are good, they can't die."],
    reveal: "Claim when the table is talking about who might be next. It makes your neighbours look protected.",
    prep: "Know your two alive neighbours and who they say they are.",
    risk: "If a neighbour dies at night, either you lied or a neighbour is evil. Be ready to accuse them."
  },
  pacifist: {
    pitch: "No info to invent. It only matters when a good player is executed.",
    say: ["I'm the Pacifist. When a good player is executed, they might not die."],
    reveal: "Hold back until an execution happens. Claiming it afterwards can explain a survivor.",
    prep: "Nothing nightly. Be ready to say that you do not know whether it works on any given execution.",
    risk: "Nothing proves it, so doubters keep asking. A second claimant or a plain execution leaves you unproven."
  },
  fool: {
    pitch: "No info to invent. The claim is that your first death will not stick.",
    say: ["I'm the Fool. The first time I die, I don't."],
    reveal: "Hold back until you are nominated or being targeted. It is the moment the claim saves you.",
    prep: "Nothing nightly. Be ready to repeat the same line whenever someone talks about executing you.",
    risk: "If your first death goes through, you are exposed. You can only prove it by dying."
  },
  tinker: {
    pitch: "No info to invent. The claim is that you might die at any time, which makes your own death unremarkable.",
    say: ["I'm the Tinker. I might die at any time, for no reason."],
    reveal: "Claim early. A good Outsider says it fast, and it gives the table a reason to expect odd deaths.",
    prep: "Nothing nightly. Keep the line short and the same each time.",
    risk: "It counts as an Outsider claim. A second Tinker or a full Outsider count contradicts you."
  },
  moonchild: {
    pitch: "Nothing to report until you die. The claim is one public choice at that moment.",
    say: ["I'm the Moonchild. When I learn I have died, I publicly choose one alive player."],
    reveal: "Claim early or when pressed. Be ready to name someone if you die.",
    prep: "If you die, a living player to name. If they survive the night, the table may read them as evil.",
    risk: "If the player you name is trusted and survives the night, the table will suspect them or you."
  },
  goon: {
    pitch: "You make no nightly choices. The claim is that players who pick you get drunk.",
    say: ["I'm the Goon. The first player who picks me with their ability is drunk until dusk, and I become their alignment."],
    reveal: "Hold back. Claim when someone says they picked you, or when you are pressed.",
    prep: "Know that the first player to choose you each night is drunk until dusk, and you take their alignment.",
    risk: "Others can only confirm it if they say they picked you. Without that, nothing backs the claim."
  },

  // ── Sects & Violets ──
  clockmaker: {
    pitch: "One number on Night 1 and no nightly story.",
    say: ["I'm the Clockmaker. My number is [N]: the Demon is that many steps from the nearest Minion."],
    reveal: "Early is fine. It is one-time info, and the table can use it right away.",
    prep: "One number, and a look at the seating so you know what it would mean. A 1 means a Minion sits next to the Demon.",
    risk: "A real Clockmaker with another number contradicts you. A small number says evil players sit close."
  },
  dreamer: {
    pitch: "A pair of characters each night, one good and one evil, so you can describe a target without being exact.",
    say: ["I'm the Dreamer. I picked [name] and was shown [good role] and [evil role]. One of them is correct."],
    reveal: "Early is fine, but wait for a pick whose result fits your story before you share.",
    prep: "A target and a pair of roles for every night, one good and one evil. One role should match what the target claims.",
    risk: "If neither role matches the target's claim, you have called them a liar, and they will say so."
  },
  snakecharmer: {
    pitch: "Your story is just \"I chose [name] and nothing changed\". A miss changes nothing for you.",
    say: ["I'm the Snake Charmer. Last night I chose [name], and nothing happened."],
    reveal: "Hold back until the table needs a Demon check, or you are pressed.",
    prep: "One alive player for each night. Never say you chose the real Demon.",
    risk: "If your pick were the Demon, you would have swapped characters with them, so you could not be a Snake Charmer now."
  },
  mathematician: {
    pitch: "A number each night, and a 0 is hard to disprove.",
    say: ["I'm the Mathematician. Last night I got a [0, 1 or 2]: that many abilities worked abnormally."],
    reveal: "Early is fine. A small number is cheap to share.",
    prep: "A number for every night, starting Night 1. Keep a record so you repeat the same number.",
    risk: "A number above 0 says someone's ability misfired, and players will look for who."
  },
  flowergirl: {
    pitch: "A yes or no each night from Night 2, checked only against votes everyone saw.",
    say: ["I'm the Flowergirl. Last night I learned a Demon [did / did not] vote today."],
    reveal: "Share it after a vote, since that is when it is useful.",
    prep: "A yes or no for each night from Night 2, and the vote list for the day you are talking about.",
    risk: "Votes are public. A yes says a Demon was among the voters, and the table will check who voted."
  },
  towncrier: {
    pitch: "A yes or no each night from Night 2, checked only against nominations everyone saw.",
    say: ["I'm the Town Crier. Last night I learned a Minion [did / did not] nominate today."],
    reveal: "Share it after a day with nominations, since that is when it is useful.",
    prep: "A yes or no for each night from Night 2, and the nomination list for the day you are talking about.",
    risk: "Nominations are public. A yes says a Minion nominated, and the table will check who did."
  },
  oracle: {
    pitch: "A number each night from Night 2, and the table cannot see who the dead really were.",
    say: ["I'm the Oracle. Last night I learned [N] of the dead players are evil."],
    reveal: "Share it once a few players have died, so the number carries some weight.",
    prep: "A number for each night from Night 2. It cannot be higher than the number of dead players.",
    risk: "A number above the death count is impossible. The number usually only goes up as more evil players die."
  },
  savant: {
    pitch: "Two statements a day, and only one is true. That gives you cover for a wrong one.",
    say: ["I'm the Savant. I was told two things: [statement] and [statement]. One is true and one is false."],
    reveal: "Share it when the table needs something to chew on. Nothing to prove right away.",
    prep: "For each day you use it, one statement that could be true and one that is false but plausible.",
    risk: "If the table can prove both statements false, you are caught. Make sure one holds up."
  },
  seamstress: {
    pitch: "A one-time ability. One night, two players, and a same-or-different answer.",
    say: ["I'm the Seamstress. On Night [N] I checked [name] and [name]: they are [the same / different] alignments."],
    reveal: "Hold back until the result is useful. Name the night and the pair when you do.",
    prep: "One night, two players (not yourself), and a result. Write it down so you do not change it.",
    risk: "A second use exposes you. The pair you name will be checked when anyone is revealed."
  },
  philosopher: {
    pitch: "A one-time ability that lets you borrow a good character's power, which can cover odd info.",
    say: ["I'm the Philosopher. On Night [N] I took the [role]'s ability."],
    reveal: "Hold back until you want that role's info to count. Be ready to act as that role afterwards.",
    prep: "One night, one good character, and that role's info for every night after.",
    risk: "You must now give that role's info, and the real one, if in play, is drunk by your own claim."
  },
  artist: {
    pitch: "A one-time daytime question, and the answer is just yes or no.",
    say: ["I'm the Artist. I asked the Storyteller if [question], and the answer was [yes / no]."],
    reveal: "Hold back until the answer is useful. Say which day you asked.",
    prep: "One day, one yes or no question, and the answer. Write it down so you do not change it.",
    risk: "A second question exposes you. An answer about a player will be tested when roles are revealed."
  },
  juggler: {
    pitch: "A public Day 1 action, so your story is fixed from the start. Only claim it if you can really say you did it.",
    say: ["I'm the Juggler. On Day 1 I guessed [name] is the [role], and so on. That night I learned [N] were correct."],
    reveal: "Claim only if you can say you guessed on Day 1. The table saw that day and will remember it.",
    prep: "Up to 5 public guesses made on your first day, and a number from 0 to 5 learned that night.",
    risk: "It only works on your first day. Claiming it afterwards means you must have guessed in public then."
  },
  sage: {
    pitch: "No info while you live, so there is nothing to invent until a Demon kills you.",
    say: ["I'm the Sage. If the Demon kills me, I learn it is one of two players."],
    reveal: "Fine to claim early. Nothing for the table to ask you while you live.",
    prep: "If you die at night, two players to name as your Demon pair. An execution gives a Sage nothing.",
    risk: "After a night death you must name two suspects at once, and the table will test that pair."
  },
  mutant: {
    pitch: "A weak bluff. Use it only if the table expects an Outsider and nothing else fits.",
    say: ["I'm the Mutant. I have no info to give."],
    reveal: "Only when pressed. An Outsider claim draws attention, and a real Mutant would be slow to say this one.",
    prep: "Nothing nightly. Keep the line short and calm.",
    risk: "A real Mutant avoids admitting it, because that can get them executed, so openly claiming it looks fake."
  },
  sweetheart: {
    pitch: "Nothing to report while alive, so there is no nightly story to keep straight.",
    say: ["I'm the Sweetheart. When I die, one player is drunk from then on."],
    reveal: "Claim early. A good Outsider says so fast, and it gives the table a reason to expect trouble later.",
    prep: "Nothing nightly. Keep the line short and the same each time.",
    risk: "After you die, the table may look for one player whose info goes wrong. You have no say over who."
  },
  barber: {
    pitch: "Nothing to report while alive, and the swap after your death is the Demon's choice, not yours.",
    say: ["I'm the Barber. If I die, the Demon may swap two players' characters."],
    reveal: "Claim early. A good Outsider says so fast, and it explains odd role changes later.",
    prep: "Nothing nightly. Know that it only matters if you died today or tonight.",
    risk: "A quiet death proves nothing for or against you, since the swap is the Demon's choice."
  },
  klutz: {
    pitch: "Nothing to report while alive. The claim is one public choice when you die.",
    say: ["I'm the Klutz. When I learn I died, I publicly choose one alive player. If they are evil, my team loses."],
    reveal: "Claim early. A good Outsider says so fast, and the table can plan around it.",
    prep: "If you die, a player to name. Pick someone you are confident is good.",
    risk: "If you die and name an evil player, a real Klutz would lose the game. A game that goes on exposes you."
  }
};

// Used for any Townsfolk or Outsider with no entry above, such as a character on a custom script.
// It never claims to know that character's specifics. The `shape` lines follow the wording of its ability.
const TEAM_COACH = {
  townsfolk: {
    pitch: "A Townsfolk claim fits when you can tell its story in a sentence or two and write each night's details down.",
    say: "I'm the [role]. Here is what I learned: [your info].",
    reveal: "Share your info when it helps the town, and when you are asked. Waiting too long makes it look made up.",
    risk: "A second player claiming the same character means one of you is lying. Any detail you cannot back up gets tested.",
    shape: {
      first: "Decide your one piece of Night 1 info now and write it down.",
      nightly: "You will need a line for every night, so write each one down as you make it.",
      notFirst: "Nothing from Night 1. From Night 2 you will need a line for each night.",
      once: "You get one use. Pick when it happened and say it only once.",
      death: "Nothing to report while you live. Be ready for what happens when you die.",
      passive: "Nothing nightly to invent. Be ready to explain what the ability does and why it has not shown up."
    }
  },
  outsider: {
    pitch: "An Outsider claim can look honest because good Outsiders usually say so early. The table counts Outsiders, though.",
    say: "I'm the [role]. My ability is: [say what it does, in your own words].",
    reveal: "Claim early. Good Outsiders usually admit it quickly, and a late Outsider claim looks like a bluff.",
    risk: "It counts toward the Outsider total the table checks. A second claimant, or a full count, exposes you.",
    shape: {
      first: "Decide your one piece of Night 1 info now and write it down.",
      nightly: "You will need a line for every night, so write each one down as you make it.",
      notFirst: "Nothing from Night 1. From Night 2 you will need a line for each night.",
      once: "You get one use. Pick when it happened and say it only once.",
      death: "Nothing to report while you live. Be ready for what happens when you die.",
      passive: "Nothing nightly to invent. Be ready to explain what the ability does and why it has not shown up."
    }
  }
};

// How being THIS evil character should change the way you bluff. Follows each ability's text.
const EVIL_ROLE_COACH = {
  // Trouble Brewing
  poisoner: ["Your poison makes one player's ability unreliable tonight and tomorrow. A cover whose story clashes with that player's info is easier to explain, but do not count on it."],
  spy: ["You see the Grimoire each night, so you know which characters are really in play. Pick a cover whose real owner is not in play.", "You might register as good even to checks, which can help a cover story."],
  scarletwoman: ["If the Demon dies while 5 or more players are alive, you become the Demon. Stay alive and keep your cover calm.", "Below 5 alive that backup is gone."],
  baron: ["There are 2 extra Outsiders in play because of you. An Outsider cover fits the count better than usual, but the table still counts them."],
  imp: ["You choose each night's death from Night 2 on, so choose deaths that fit your cover story. If you kill yourself, a Minion becomes the Imp."],
  // Bad Moon Rising
  godfather: ["You learn which Outsiders are in play, so you can avoid claiming one a real player holds. The setup may be 1 more or 1 fewer Outsider.", "If an Outsider died today, you get a kill tonight."],
  devilsadvocate: ["The player you protect survives tomorrow's execution. A good-looking player who survives a vote may be your doing, and the table will notice a failed execution."],
  assassin: ["You have one kill that works even through protection, from Night 2 on. Keep it for a protected player, and keep a cover that does not need that player alive."],
  mastermind: ["If your Demon is executed, the game goes on one more day, and whoever is executed then loses for their team. Your cover matters most after that execution."],
  zombuul: ["You only kill after a day with no deaths. Your first death does not end you, so an early execution costs your team less."],
  pukka: ["Your kills land a night behind your poison: the player you poison dies the next night. Plan your cover around the deaths arriving late."],
  shabaloth: ["You kill two players a night from Night 2 on, so the table will expect a pattern in the deaths. A player you killed might be regurgitated and return."],
  po: ["You may skip a kill, and if you do, your next night kills three. A quiet night followed by a big one is a pattern your cover must absorb."],
  // Sects & Violets
  eviltwin: ["You and a good player know each other. The good twin knows who you are, so keep your bluff consistent with that.", "If the good twin is executed, evil wins."],
  witch: ["A player you pick dies if they nominate tomorrow, so a death right after a nomination is your doing.", "With 3 players left you lose this ability."],
  cerenovus: ["The player you choose is \"mad\" they are the good character you name. Avoid naming your own cover character, which would create a double claim."],
  pithag: ["You can turn a player into a character that is not in play. Do not make your own cover character real by accident."],
  fanggu: ["There is 1 extra Outsider in play because of you, so an Outsider cover fits the count.", "The first Outsider you kill becomes the Fang Gu and you die instead."],
  vigormortis: ["There is 1 fewer Outsider in play because of you, so an Outsider cover fits the count worse.", "A Minion you kill keeps its ability and poisons a Townsfolk neighbour."],
  nodashii: ["Your two Townsfolk neighbours are poisoned. The table may notice that the odd info comes from the players sitting beside you."],
  vortox: ["Townsfolk info is false while you live. A day with no execution is an evil win, so do not look like you are pushing to skip it."]
};

// General principles for the collapsed "Bluffing basics" section.
const BLUFF_BASICS = [
  { title: "Keep it small", text: "Pick a role you can explain in one breath. Fewer moving parts means fewer chances to slip." },
  { title: "Write it down first", text: "Plan each night's info before anyone asks, and say the same thing every time." },
  { title: "Use what is public", text: "Build your story on events the table already saw, like who died or who voted, so it fits." },
  { title: "Avoid a double claim", text: "If someone already claimed your role, one of you is a liar. Pick another unless you have a plan." },
  { title: "Be calm, not chatty", text: "Give details when asked. Over-explaining sounds rehearsed, and a vague answer sounds worse than a prepared one." },
  { title: "Keep a record", text: "Mark lines as told in your story, so you never contradict yourself on Day 3." },
  { title: "Know when to stop", text: "If you are good, plan when you will say your real role. Good players must be believed in the end." }
];
