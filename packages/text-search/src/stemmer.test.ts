import { test, expect } from "vitest";
import { stem } from "./stemmer.js";

test("Porter Stemmer basic stemming should not modify very short words", () => {
  expect(stem("a")).toBe("a");
  expect(stem("is")).toBe("is");
  expect(stem("be")).toBe("be");
});

test("Porter Stemmer basic stemming should handle words that are already stems", () => {
  expect(stem("cat")).toBe("cat");
  expect(stem("run")).toBe("run");
  expect(stem("jump")).toBe("jump");
});

test("Porter Stemmer plural forms (step 1a) should stem -sses to -ss", () => {
  expect(stem("caresses")).toBe("caress");
  expect(stem("dresses")).toBe("dress");
  expect(stem("processes")).toBe("process");
});

test("Porter Stemmer plural forms (step 1a) should stem -ies to -i", () => {
  expect(stem("ponies")).toBe("poni");
  expect(stem("ties")).toBe("ti");
  expect(stem("cries")).toBe("cri");
});

test("Porter Stemmer plural forms (step 1a) should preserve -ss", () => {
  expect(stem("caress")).toBe("caress");
  expect(stem("boss")).toBe("boss");
});

test("Porter Stemmer plural forms (step 1a) should remove trailing -s", () => {
  expect(stem("cats")).toBe("cat");
  expect(stem("dogs")).toBe("dog");
  expect(stem("runs")).toBe("run");
});

test("Porter Stemmer past tense and progressive (step 1b) should handle -eed endings", () => {
  // "agreed" -> "agree" in step1b, then -> "agre" in step5a
  expect(stem("agreed")).toBe("agre");
  expect(stem("feed")).toBe("feed"); // measure = 0
});

test("Porter Stemmer past tense and progressive (step 1b) should handle -ed endings", () => {
  expect(stem("plastered")).toBe("plaster");
  expect(stem("bled")).toBe("bled"); // no vowel in stem
  expect(stem("jumped")).toBe("jump");
  expect(stem("walked")).toBe("walk");
});

test("Porter Stemmer past tense and progressive (step 1b) should handle -ing endings", () => {
  expect(stem("motoring")).toBe("motor");
  expect(stem("sing")).toBe("sing"); // no vowel in stem
  expect(stem("running")).toBe("run");
  expect(stem("jumping")).toBe("jump");
});

test("Porter Stemmer past tense and progressive (step 1b) should add -e after certain consonant clusters when removing -ed/-ing", () => {
  // Note: step5a may later remove the e
  expect(stem("conflated")).toBe("conflat");
  expect(stem("troubled")).toBe("troubl");
  expect(stem("sized")).toBe("size");
});

test("Porter Stemmer past tense and progressive (step 1b) should remove double consonants after -ed/-ing removal", () => {
  expect(stem("hopping")).toBe("hop");
  expect(stem("tanned")).toBe("tan");
  expect(stem("falling")).toBe("fall"); // ll is preserved
});

test("Porter Stemmer y to i conversion (step 1c) should convert -y to -i when preceded by vowel", () => {
  expect(stem("happy")).toBe("happi");
  expect(stem("sky")).toBe("sky"); // no vowel before y
});

test("Porter Stemmer double suffixes (step 2) should handle -ational", () => {
  expect(stem("relational")).toBe("relat");
  expect(stem("conditional")).toBe("condit");
});

test("Porter Stemmer double suffixes (step 2) should handle -izer/-ization", () => {
  expect(stem("digitizer")).toBe("digit");
  expect(stem("organization")).toBe("organ");
});

test("Porter Stemmer double suffixes (step 2) should handle -fulness/-iveness/-ousness", () => {
  expect(stem("hopefulness")).toBe("hope");
  expect(stem("effectiveness")).toBe("effect");
  expect(stem("callousness")).toBe("callous");
});

test("Porter Stemmer double suffixes (step 2) should handle -alli/-entli/-eli/-ousli", () => {
  expect(stem("radically")).toBe("radic");
  expect(stem("differently")).toBe("differ");
});

test("Porter Stemmer double suffixes (step 2) should handle -ation/-ator", () => {
  expect(stem("adoption")).toBe("adopt");
  expect(stem("operator")).toBe("oper");
});

test("Porter Stemmer suffix removal (step 3) should handle -icate/-ative/-alize", () => {
  expect(stem("triplicate")).toBe("triplic");
  expect(stem("formative")).toBe("form");
  expect(stem("formalize")).toBe("formal");
});

test("Porter Stemmer suffix removal (step 3) should handle -ful/-ness", () => {
  expect(stem("hopeful")).toBe("hope");
  expect(stem("goodness")).toBe("good");
});

test("Porter Stemmer suffix removal (step 3) should handle -iciti/-ical", () => {
  expect(stem("electrical")).toBe("electr");
  expect(stem("authenticity")).toBe("authent");
});

test("Porter Stemmer suffix removal (step 4) should handle -al/-ance/-ence", () => {
  expect(stem("revival")).toBe("reviv");
  expect(stem("allowance")).toBe("allow");
  expect(stem("inference")).toBe("infer");
});

test("Porter Stemmer suffix removal (step 4) should handle -er/-able/-ible", () => {
  expect(stem("airliner")).toBe("airlin");
  expect(stem("adjustable")).toBe("adjust");
  expect(stem("defensible")).toBe("defens");
});

test("Porter Stemmer suffix removal (step 4) should handle -ant/-ement/-ment/-ent", () => {
  expect(stem("irritant")).toBe("irrit");
  expect(stem("replacement")).toBe("replac");
  expect(stem("adjustment")).toBe("adjust");
  expect(stem("dependent")).toBe("depend");
});

test("Porter Stemmer suffix removal (step 4) should handle -ion (only after s or t)", () => {
  expect(stem("adoption")).toBe("adopt");
  expect(stem("admission")).toBe("admiss"); // keeps ion when not after s/t with measure > 1
});

test("Porter Stemmer suffix removal (step 4) should handle -ism/-ate/-iti/-ous/-ive/-ize", () => {
  expect(stem("communism")).toBe("commun");
  expect(stem("activate")).toBe("activ");
  expect(stem("angulariti")).toBe("angular");
  expect(stem("homologous")).toBe("homolog");
  expect(stem("effective")).toBe("effect");
  expect(stem("bowdlerize")).toBe("bowdler");
});

test("Porter Stemmer final cleanup (step 5) should remove final -e appropriately", () => {
  expect(stem("probate")).toBe("probat");
  expect(stem("rate")).toBe("rate"); // measure = 1, ends in CVC
});

test("Porter Stemmer final cleanup (step 5) should remove one -l from -ll", () => {
  expect(stem("controll")).toBe("control");
  expect(stem("roll")).toBe("roll"); // measure not > 1
});

test('Porter Stemmer real-world examples should stem "running" to "run"', () => {
  expect(stem("running")).toBe("run");
});

test('Porter Stemmer real-world examples should stem "runs" to "run"', () => {
  expect(stem("runs")).toBe("run");
});

test('Porter Stemmer real-world examples should stem "ran" to "ran"', () => {
  expect(stem("ran")).toBe("ran");
});

test('Porter Stemmer real-world examples should stem "jumping" to "jump"', () => {
  expect(stem("jumping")).toBe("jump");
});

test('Porter Stemmer real-world examples should stem "jumped" to "jump"', () => {
  expect(stem("jumped")).toBe("jump");
});

test('Porter Stemmer real-world examples should stem "swimming" to "swim"', () => {
  expect(stem("swimming")).toBe("swim");
});

test('Porter Stemmer real-world examples should stem "swam" to "swam"', () => {
  expect(stem("swam")).toBe("swam");
});

test('Porter Stemmer real-world examples should stem "connections" to "connect"', () => {
  expect(stem("connections")).toBe("connect");
});

test('Porter Stemmer real-world examples should stem "connection" to "connect"', () => {
  expect(stem("connection")).toBe("connect");
});

test('Porter Stemmer real-world examples should stem "connected" to "connect"', () => {
  expect(stem("connected")).toBe("connect");
});

test('Porter Stemmer real-world examples should stem "connecting" to "connect"', () => {
  expect(stem("connecting")).toBe("connect");
});

test('Porter Stemmer real-world examples should stem "programming" to "program"', () => {
  expect(stem("programming")).toBe("program");
});

test('Porter Stemmer real-world examples should stem "programmer" to "programm"', () => {
  expect(stem("programmer")).toBe("programm");
});

test('Porter Stemmer real-world examples should stem "programs" to "program"', () => {
  expect(stem("programs")).toBe("program");
});

test('Porter Stemmer real-world examples should stem "functionality" to "function"', () => {
  expect(stem("functionality")).toBe("function");
});

test('Porter Stemmer real-world examples should stem "functional" to "function"', () => {
  expect(stem("functional")).toBe("function");
});

test('Porter Stemmer real-world examples should stem "functions" to "function"', () => {
  expect(stem("functions")).toBe("function");
});

test('Porter Stemmer real-world examples should stem "databases" to "databas"', () => {
  expect(stem("databases")).toBe("databas");
});

test('Porter Stemmer real-world examples should stem "optimization" to "optim"', () => {
  expect(stem("optimization")).toBe("optim");
});

test('Porter Stemmer real-world examples should stem "configurations" to "configur"', () => {
  expect(stem("configurations")).toBe("configur");
});

test('Porter Stemmer real-world examples should stem "implementing" to "implement"', () => {
  expect(stem("implementing")).toBe("implement");
});

test('Porter Stemmer real-world examples should stem "implementation" to "implement"', () => {
  expect(stem("implementation")).toBe("implement");
});

test('Porter Stemmer real-world examples should stem "organizational" to "organiz"', () => {
  expect(stem("organizational")).toBe("organiz");
});

test('Porter Stemmer real-world examples should stem "organizations" to "organ"', () => {
  expect(stem("organizations")).toBe("organ");
});

test('Porter Stemmer real-world examples should stem "management" to "manag"', () => {
  expect(stem("management")).toBe("manag");
});

test('Porter Stemmer real-world examples should stem "managers" to "manag"', () => {
  expect(stem("managers")).toBe("manag");
});

test('Porter Stemmer real-world examples should stem "processing" to "process"', () => {
  expect(stem("processing")).toBe("process");
});

test('Porter Stemmer real-world examples should stem "processed" to "process"', () => {
  expect(stem("processed")).toBe("process");
});

test("Porter Stemmer edge cases should handle empty string", () => {
  expect(stem("")).toBe("");
});

test("Porter Stemmer edge cases should handle single characters", () => {
  expect(stem("a")).toBe("a");
  expect(stem("b")).toBe("b");
});

test("Porter Stemmer edge cases should handle words with numbers", () => {
  // Numbers pass through unchanged
  expect(stem("test123")).toBe("test123");
});

test("Porter Stemmer edge cases should handle already-stemmed words", () => {
  const word = "connect";
  expect(stem(stem(word))).toBe(stem(word));
});
