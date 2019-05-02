/*
 * Accumulate log output, and output it in
 * a sorted manner when the program exits.
 */

const output = [];

exports.sortedLog = text => {
  output.push(text);
};

process.on('exit', () => {
  for (const x of output.sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )) {
    console.log(x);
  }
});
