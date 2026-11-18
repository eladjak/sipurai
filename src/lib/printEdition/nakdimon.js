// Nakdimon, Elazar Gershuni and Yuval Pinter. The original browser model is
// self-hosted and loaded only on request; the story stays in the browser.
// https://github.com/elazarg/nakdimon/tree/5b73cdd6a43ad465faabc8c1118933592df356c8
import { argMax, ready, setBackend, tensor2d, tidy } from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import { loadLayersModel } from '@tensorflow/tfjs-layers';
import { stripNikud } from './model';

const vowels = ['', '', 'ְ', 'ֱ', 'ֲ', 'ֳ', 'ִ', 'ֵ', 'ֶ', 'ַ', 'ָ', 'ֹ', 'ֺ', 'ֻ', 'ּ', 'ַ'];
const dagesh = ['', '', 'ּ'];
const shin = ['', '', 'ׁ', 'ׂ'];
const alphabet = [...'אבגדהוזחטיךכלםמןנסעףפץצקרשת'];
const letters = [...' !"\'(),-.:;?', ...alphabet];
const tokens = ['', 'H', 'O', '5', ...letters];
const tokenIndex = new Map(tokens.map((token, index) => [token, index]));
const rowLength = 80;
let modelPromise;

function feature(character) {
  if (/\s/u.test(character)) return ' ';
  if (letters.includes(character)) return character;
  if ('־‒–—―−'.includes(character)) return '-';
  if (character === '[') return '(';
  if (character === ']') return ')';
  if ('´‘’׳'.includes(character)) return "'";
  if ('“”״'.includes(character)) return '"';
  if (/[0-9]/.test(character)) return '5';
  if (character === '…') return ',';
  if ('ײװױ'.includes(character)) return 'H';
  return 'O';
}

function rowsFor(characters) {
  const rows = [];
  let start = 0;
  while (start < characters.length) {
    let end = Math.min(start + rowLength, characters.length);
    if (end < characters.length && !/\s/u.test(characters[end])) {
      let boundary = end;
      while (boundary > start && !/\s/u.test(characters[boundary - 1])) boundary--;
      if (boundary > start) end = boundary;
    }
    rows.push(characters.slice(start, end));
    start = end;
  }
  return rows;
}

async function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await setBackend('cpu');
      await ready();
      return loadLayersModel('/models/nakdimon/model.json');
    })().catch((error) => {
      modelPromise = undefined;
      throw error;
    });
  }
  return modelPromise;
}

export async function addNikud(source) {
  const plain = stripNikud(source);
  if (!/[א-ת]/.test(plain)) return plain;
  const rows = rowsFor([...plain]);
  const model = await loadModel();
  return tidy(() => {
    const input = tensor2d(rows.map((row) => {
      const indices = row.map((char) => tokenIndex.get(feature(char)));
      return indices.concat(Array(rowLength - indices.length).fill(0));
    }), [rows.length, rowLength], 'int32');
    const predictions = model.predict(input);
    if (!Array.isArray(predictions) || predictions.length !== 3) throw new Error('Invalid Nakdimon model output');
    const [v, d, s] = predictions.map((output) => argMax(output, -1).dataSync());
    return rows.map((row, rowNumber) => row.map((char, column) => {
      const i = rowNumber * rowLength + column;
      const dot = 'בגדהוזטיכלמנספצקשתךף'.includes(char) ? dagesh[d[i]] : '';
      const side = char === 'ש' ? shin[s[i]] : '';
      const vowel = 'אבגדהוזחטיכלמנסעפצקרשתךן'.includes(char) ? vowels[v[i]] : '';
      return char + dot + side + vowel;
    }).join('')).join('').normalize('NFC');
  });
}
