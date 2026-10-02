/* ================= meta game (pure, no rendering): combos, daily puzzle, streaks, sharing ================= */

/* Combo: jars sealed in a row with no wasted move between them. A tile from a stack into a numbered jar keeps the
   chain going, because that is the only kind of move a par game is made of. Anything else (a jar-to-jar move, the
   spare jar, an undo, a split) ends it. The first seal is its own reward; from the second on, a word rises from the
   jar, and the words climb with the chain. */
export const COMBO_WORDS = ['', '', 'Sweet!', 'Tasty!', 'Yummy!', 'Delicious!', 'Sugar rush!'];
export const comboWord = n => n < 2 ? '' : COMBO_WORDS[Math.min(n, COMBO_WORDS.length - 1)];
/* the chain after one move; `clean` = stack to numbered jar, `seals` = the move sealed that jar */
export const comboStep = (chain, { clean, seals }) => !clean ? 0 : seals ? chain + 1 : chain;
