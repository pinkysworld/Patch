import { PatchInterpreter } from '../src/interpreter.js';

const samples = {
  score: `create number score = 0
watch score

change score:
  add 1

change score called bonus:
  add 10

show score
history score`,
  fruits: `create list fruits = apple, banana

change fruits:
  add orange
  remove banana

show fruits`,
  player: `create thing player:
  name = "Sam"
  score = 0
  lives = 3

change player:
  add 10 to score
  remove 1 from lives

show player`,
  undo: `create number score = 5

change score called bonus:
  add 10
show score

undo bonus
show score
redo
show score
history score`,
  story: `create number courage = 2
create text hero = "Mia"

repeat 3:
  change courage:
    add 1

if courage >= 5:
  show hero + " opens the mysterious door."
else:
  show hero + " waits outside."

preview:
  change courage:
    add 100

show courage`
};

const code = document.querySelector('#code');
const output = document.querySelector('#output');
const sample = document.querySelector('#sample');
code.value = samples.score;
sample.addEventListener('change', () => { code.value = samples[sample.value]; });
document.querySelector('#run').addEventListener('click', () => {
  try {
    const result = new PatchInterpreter().run(code.value);
    output.textContent = result.output.length ? result.output.join('\n') : '(program finished with no output)';
  } catch (err) { output.textContent = `Patch stopped:\n${err.message}`; }
});
document.querySelector('#clear').addEventListener('click', () => { output.textContent = ''; });
