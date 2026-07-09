export interface QuizQuestion {
  id: number;
  type: "mcq" | "truefalse" | "shortanswer";
  question: string;
  options: string[];
  answer: number;
  correctWord: string;
  isFalseStatement?: boolean;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","are","was","were","be","been","being","have","has",
  "had","do","does","did","will","would","could","should","may","might",
  "shall","can","that","this","these","those","it","its","as","if","so",
  "not","no","nor","both","either","neither","each","every","any","all",
  "some","such","than","then","when","where","which","who","whom","whose",
  "what","how","there","here","also","just","only","more","most","very",
  "too","about","after","before","into","through","during","above","below",
  "between","out","off","over","under","again","further","other","they",
  "we","you","he","she","i","me","him","her","us","them","their","our",
  "your","my","his","let","get","got","said","says","one","two","three",
  "four","five","many","much","well","use","used","using","make","made",
  "need","new","way","good","first","last","long","great","little","own",
  "right","big","high","different","small","large","next","early","young",
  "public","private","real","best","free","able","like","want","know",
  "think","take","see","come","work","part","place","case","week","give",
  "same","back","still","world","life","hand","old","follow","around",
  "never","always","often","because","while","without","within","already",
  "even","though","since","until","unless","however","therefore","thus",
  "hence","whereas","yet","meanwhile","furthermore","moreover","indeed",
  "time","year","day","man","now","then","here","there","when","where",
]);

// Verbs whose right-hand side is a clean "definition"
const DEFINITION_VERBS =
  /\b(is|are|means|refers to|involves|defined as|consists of|represents|describes|known as|called)\b/i;

// Verbs whose right-hand side is a "function / outcome"
const ACTION_VERBS =
  /\b(enables|allows|causes|produces|results in|leads to|helps|provides|converts|breaks down|stores|carries|transports|regulates|controls|generates|releases|absorbs)\b/i;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
}

function isKeyword(w: string): boolean {
  return !STOP_WORDS.has(w) && w.length >= 4;
}

function keywordFreq(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of tokenize(text)) {
    if (isKeyword(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return freq;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6 && s.length >= 35);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function trunc(s: string, max = 95): string {
  return s.length <= max ? s : s.slice(0, max).trimEnd() + "…";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Concept model ─────────────────────────────────────────────────────────────

type DefinitionKind = "is" | "does" | "causes";  // shapes which question frame to use

interface Concept {
  term: string;
  definition: string;   // clean phrase: no sentence stubs, no "[this concept]"
  kind: DefinitionKind;
  sentence: string;
  coTerms: string[];    // other significant keywords sharing this sentence
}

// ─── Concept extraction ────────────────────────────────────────────────────────

/**
 * Extract a phrase that follows the pivot verb in a sentence.
 * Trims to a readable length and strips trailing punctuation.
 */
function extractRightPhrase(sentence: string, pivotIndex: number, pivotLen: number): string | null {
  const raw = sentence.slice(pivotIndex + pivotLen).trim();
  // Drop leading connectors ("that", "which", "a", "the")
  const cleaned = raw.replace(/^(that|which|a|an|the)\s+/i, "");
  const words = cleaned.split(/\s+/).slice(0, 10);
  if (words.length < 3) return null;
  return words.join(" ").replace(/[.!?,;:]+$/, "").trim();
}

/**
 * Extract the verb phrase AFTER the term (for fallback concepts).
 * Returns null if not enough words follow the term — we discard that sentence.
 */
function extractVerbPhrase(sentence: string, term: string): string | null {
  const rx = new RegExp(`\\b${term}\\b`, "i");
  const match = rx.exec(sentence);
  if (!match) return null;
  const after = sentence.slice(match.index + match[0].length).trim();
  // Strip leading punctuation and connectors
  const cleaned = after.replace(/^[,;:\s]+/, "").replace(/^(that|which|who|and|or|,)\s*/i, "");
  const words = cleaned.split(/\s+/).slice(0, 8);
  if (words.length < 3) return null;
  return words.join(" ").replace(/[.!?,;:]+$/, "").trim();
}

function bestTerm(leftWords: string[], freq: Map<string, number>): string | null {
  const candidates = leftWords.filter(isKeyword);
  if (candidates.length === 0) return null;
  // Prefer the rightmost (closest to verb) high-frequency keyword
  return candidates.reduce((best, w) =>
    (freq.get(w) ?? 0) >= (freq.get(best) ?? 0) ? w : best
  );
}

function tryExtractConcept(
  sentence: string,
  freq: Map<string, number>,
  usedTerms: Set<string>
): Concept | null {
  // 1. Try a definition verb first ("X is/means/refers to Y")
  const defMatch = DEFINITION_VERBS.exec(sentence);
  if (defMatch) {
    const pivot = defMatch.index;
    const left = sentence.slice(0, pivot).trim();
    const phrase = extractRightPhrase(sentence, pivot, defMatch[0].length);
    if (phrase) {
      const term = bestTerm(tokenize(left), freq);
      if (term && !usedTerms.has(term)) {
        const coTerms = tokenize(sentence).filter((w) => isKeyword(w) && w !== term);
        return { term, definition: cap(trunc(phrase)), kind: "is", sentence, coTerms };
      }
    }
  }

  // 2. Try an action verb ("X enables/causes/produces Y")
  const actMatch = ACTION_VERBS.exec(sentence);
  if (actMatch) {
    const pivot = actMatch.index;
    const left = sentence.slice(0, pivot).trim();
    const phrase = extractRightPhrase(sentence, pivot, actMatch[0].length);
    if (phrase) {
      const term = bestTerm(tokenize(left), freq);
      if (term && !usedTerms.has(term)) {
        const coTerms = tokenize(sentence).filter((w) => isKeyword(w) && w !== term);
        const kind: DefinitionKind = /\b(causes|produces|results in|leads to|generates|releases)\b/i.test(actMatch[0]) ? "causes" : "does";
        return { term, definition: cap(trunc(phrase)), kind, sentence, coTerms };
      }
    }
  }

  // 3. Fallback: pick the most frequent keyword and extract the verb phrase that FOLLOWS it.
  //    We intentionally skip if no clean phrase follows — better no question than a broken one.
  const words = tokenize(sentence).filter((w) => isKeyword(w) && !usedTerms.has(w));
  if (words.length === 0) return null;
  words.sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));

  for (const candidate of words.slice(0, 3)) {
    const phrase = extractVerbPhrase(sentence, candidate);
    if (phrase && phrase.length >= 12) {
      const coTerms = tokenize(sentence).filter((w) => isKeyword(w) && w !== candidate);
      return { term: candidate, definition: cap(trunc(phrase)), kind: "does", sentence, coTerms };
    }
  }

  return null;
}

function extractConcepts(sentences: string[], freq: Map<string, number>): Concept[] {
  const result: Concept[] = [];
  const usedTerms = new Set<string>();
  for (const sentence of sentences) {
    const c = tryExtractConcept(sentence, freq, usedTerms);
    if (c) {
      result.push(c);
      usedTerms.add(c.term);
    }
  }
  return result;
}

// ─── Question factories ────────────────────────────────────────────────────────

/**
 * Pick a question stem that matches the concept's DefinitionKind.
 * "What is X?" → for "is" concepts (definitions)
 * "What does X do?" → for "does" concepts (functions)
 * "What does X cause/produce?" → for "causes" concepts (outcomes)
 */
function pickMCQStem(concept: Concept): string {
  const t = `"${concept.term}"`;
  if (concept.kind === "causes") {
    return shuffle([
      `What does ${t} cause or produce, according to the notes?`,
      `Which outcome is associated with ${t} in the notes?`,
      `What result does ${t} lead to, based on the notes?`,
    ])[0];
  }
  if (concept.kind === "does") {
    return shuffle([
      `What does ${t} do, according to the notes?`,
      `What is the function of ${t} in the notes?`,
      `Which of the following best describes what ${t} does?`,
    ])[0];
  }
  // "is" — definitional
  return shuffle([
    `What is ${t} according to the notes?`,
    `Which of the following best describes ${t}?`,
    `How would you define ${t} based on the notes?`,
    `What does ${t} refer to in this context?`,
  ])[0];
}

function makeMCQ(concept: Concept, allConcepts: Concept[]): Omit<QuizQuestion, "id"> | null {
  const correct = cap(trunc(concept.definition, 90));

  // Distractors: definitions of other concepts with matching kind preferred,
  // but any distinct definition is acceptable.
  const pool = allConcepts
    .filter((c) => c.term !== concept.term && c.definition !== concept.definition)
    .map((c) => cap(trunc(c.definition, 90)));

  const unique = [...new Set(pool)];
  if (unique.length < 3) return null;

  const distractors = shuffle(unique).slice(0, 3);
  if (distractors.includes(correct)) return null; // Safety guard

  const options = shuffle([correct, ...distractors]);
  const answer = options.indexOf(correct);
  if (answer === -1) return null;

  return {
    type: "mcq",
    question: pickMCQStem(concept),
    options,
    answer,
    correctWord: concept.term,
  };
}

function pickTFStem(concept: Concept, def: string, isTrue: boolean): string {
  if (concept.kind === "causes") {
    return isTrue
      ? shuffle([
          `"${cap(concept.term)}" produces or causes: ${def}.`,
          `According to the notes, ${concept.term} leads to: ${def}.`,
        ])[0]
      : shuffle([
          `"${cap(concept.term)}" produces or causes: ${def}.`,
          `According to the notes, ${concept.term} leads to: ${def}.`,
        ])[0];
  }
  if (concept.kind === "does") {
    return isTrue
      ? shuffle([
          `"${cap(concept.term)}" functions to: ${def}.`,
          `According to the notes, ${concept.term} works by: ${def}.`,
        ])[0]
      : shuffle([
          `"${cap(concept.term)}" functions to: ${def}.`,
          `According to the notes, ${concept.term} works by: ${def}.`,
        ])[0];
  }
  return isTrue
    ? shuffle([
        `"${cap(concept.term)}" is defined as: ${def}.`,
        `The notes describe "${concept.term}" as: ${def}.`,
        `"${cap(concept.term)}" refers to: ${def}.`,
      ])[0]
    : shuffle([
        `"${cap(concept.term)}" is defined as: ${def}.`,
        `The notes describe "${concept.term}" as: ${def}.`,
        `"${cap(concept.term)}" refers to: ${def}.`,
      ])[0];
}

function makeTrueFalse(concept: Concept, allConcepts: Concept[]): Omit<QuizQuestion, "id"> {
  const trueDef = trunc(concept.definition, 80);
  const makeItFalse = Math.random() > 0.45;

  if (makeItFalse) {
    // Pick another concept whose definition is different enough
    const other = allConcepts.find(
      (c) =>
        c.term !== concept.term &&
        c.definition !== concept.definition &&
        !c.definition.toLowerCase().includes(concept.term)
    );
    if (other) {
      const wrongDef = trunc(other.definition, 80);
      return {
        type: "truefalse",
        question: "True or False: " + pickTFStem(concept, wrongDef, false),
        options: ["True", "False"],
        answer: 1,
        correctWord: concept.term,
        isFalseStatement: true,
      };
    }
  }

  return {
    type: "truefalse",
    question: "True or False: " + pickTFStem(concept, trueDef, true),
    options: ["True", "False"],
    answer: 0,
    correctWord: concept.term,
    isFalseStatement: false,
  };
}

function pickSAStem(concept: Concept, def: string): string {
  if (concept.kind === "causes") {
    return shuffle([
      `Which term from the notes causes or produces: "${def}"?`,
      `Name the concept that leads to: "${def}".`,
    ])[0];
  }
  if (concept.kind === "does") {
    return shuffle([
      `Which term from the notes is described as doing the following: "${def}"?`,
      `Name the concept whose function is to: "${def}".`,
    ])[0];
  }
  return shuffle([
    `Which term from the notes is defined as: "${def}"?`,
    `Name the concept described as: "${def}".`,
    `What term in the notes refers to: "${def}"?`,
  ])[0];
}

function makeShortAnswer(concept: Concept): Omit<QuizQuestion, "id"> {
  return {
    type: "shortanswer",
    question: pickSAStem(concept, trunc(concept.definition, 90)),
    options: [],
    answer: -1,
    correctWord: concept.term,
  };
}

/**
 * Hard MCQ: tests understanding of the ROLE of one concept relative to another.
 * Requires knowing both concepts and their interaction — not just one definition.
 * Correct answer describes what term A does IN THE CONTEXT of term B.
 * Wrong answers are definitions of unrelated concepts (plausible but incorrect).
 */
function makeHardQuestion(concepts: Concept[]): Omit<QuizQuestion, "id"> | null {
  for (const c of shuffle([...concepts])) {
    // Find a concept whose sentence mentions another known concept
    const related = concepts.find(
      (other) =>
        other.term !== c.term &&
        new RegExp(`\\b${other.term}\\b`, "i").test(c.sentence)
    );
    if (!related) continue;

    const correctOption = cap(trunc(c.definition, 90));

    const others = concepts.filter(
      (x) => x.term !== c.term && x.term !== related.term
    );
    if (others.length < 3) continue;

    const wrongOptions = shuffle(others)
      .slice(0, 3)
      .map((o) => cap(trunc(o.definition, 90)));

    // Guard: all options must be unique, non-empty, and correct must be findable
    if (wrongOptions.includes(correctOption)) continue;
    if (wrongOptions.some((o) => !o || o.length < 5)) continue;

    const options = shuffle([correctOption, ...wrongOptions]);
    const answer = options.indexOf(correctOption);
    if (answer === -1) continue;

    return {
      type: "mcq",
      question: `According to the notes, what is the role of "${c.term}" in the context of "${related.term}"?`,
      options,
      answer,
      correctWord: c.term,
    };
  }
  return null;
}

// ─── Summary ───────────────────────────────────────────────────────────────────

function isMeaningful(text: string): boolean {
  const words = tokenize(text);
  if (words.length < 15) return false;
  const meaningful = words.filter(isKeyword);
  if (meaningful.length < 8) return false;
  const unique = new Set(meaningful);
  if (unique.size / meaningful.length < 0.25) return false;
  return splitSentences(text).length >= 1;
}

export function generateSummary(notes: string): string | null {
  if (!isMeaningful(notes)) return null;

  const sentences = splitSentences(notes);
  if (sentences.length === 0) return null;

  const freq = keywordFreq(notes);

  const scored = sentences.map((sentence, i) => {
    const words = tokenize(sentence).filter(isKeyword);
    let score = words.reduce((acc, w) => acc + (freq.get(w) ?? 0), 0);
    if (words.length > 0) score /= words.length;
    if (i === 0) score += 2.5;
    else if (i < 3) score += 1.5;
    else if (i < 6) score += 0.5;
    const len = sentence.split(/\s+/).length;
    if (len < 6 || len > 60) score *= 0.6;
    return { sentence, score, index: i };
  });

  const pickCount = Math.min(6, Math.max(3, Math.ceil(sentences.length * 0.35)));
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, pickCount)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);

  return top.length > 0 ? top.join(" ") : null;
}

// ─── Quiz generation ───────────────────────────────────────────────────────────

export function generateQuiz(notes: string): QuizQuestion[] {
  const sentences = splitSentences(notes);
  if (sentences.length < 2) return [];

  const freq = keywordFreq(notes);

  // Zone-based extraction: beginning / middle / end for coverage across the notes
  const third = Math.max(1, Math.ceil(sentences.length / 3));
  const zones = [
    shuffle(sentences.slice(0, third)),
    shuffle(sentences.slice(third, third * 2)),
    shuffle(sentences.slice(third * 2)),
  ];

  const allConcepts: Concept[] = [];
  const usedTermsGlobal = new Set<string>();

  for (const zone of zones) {
    const zoneConcepts = extractConcepts(zone, freq).filter(
      (c) => !usedTermsGlobal.has(c.term)
    );
    for (const c of zoneConcepts) usedTermsGlobal.add(c.term);
    allConcepts.push(...zoneConcepts);
  }

  if (allConcepts.length < 2) return [];

  const rawQuestions: Array<Omit<QuizQuestion, "id">> = [];
  const usedTerms = new Set<string>();

  // Rotate through question types: vary the kind of thinking required
  type QType = "mcq" | "truefalse" | "shortanswer";
  const rotation: QType[] = [
    "mcq", "truefalse", "shortanswer",
    "mcq", "truefalse", "mcq", "shortanswer",
  ];

  for (const concept of allConcepts) {
    if (rawQuestions.length >= 6) break;
    if (usedTerms.has(concept.term)) continue;

    const qtype = rotation[rawQuestions.length % rotation.length];
    let q: Omit<QuizQuestion, "id"> | null = null;

    if (qtype === "mcq") q = makeMCQ(concept, allConcepts);
    else if (qtype === "truefalse") q = makeTrueFalse(concept, allConcepts);
    else q = makeShortAnswer(concept);

    if (!q) q = makeMCQ(concept, allConcepts) ?? makeShortAnswer(concept);

    if (q) {
      rawQuestions.push(q);
      usedTerms.add(concept.term);
    }
  }

  // Pad to at least 5 if needed
  if (rawQuestions.length < 5) {
    for (const concept of allConcepts) {
      if (rawQuestions.length >= 5) break;
      if (usedTerms.has(concept.term)) continue;
      const q = makeMCQ(concept, allConcepts) ?? makeShortAnswer(concept);
      rawQuestions.push(q);
      usedTerms.add(concept.term);
    }
  }

  // Inject exactly ONE hard question (replaces the last regular question)
  const hardQ = makeHardQuestion(allConcepts);
  if (hardQ && rawQuestions.length > 0) {
    rawQuestions[rawQuestions.length - 1] = hardQ;
  } else if (hardQ) {
    rawQuestions.push(hardQ);
  }

  return shuffle(rawQuestions).map((q, i) => ({ ...q, id: i }));
}
