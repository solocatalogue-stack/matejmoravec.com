'use strict';

/*
  Česká typografie pro Affinity · verze skriptu 1.0 (listopad 2026)
  Potřebuje Affinity od Canvy verze 3.3 nebo novější.
  Ve starých aplikacích Affinity V1 a V2 nefunguje (nemají skriptování).
  © 2026 Matěj Moravec, licence GNU GPL v3 (viz LICENSE).
  https://github.com/solocatalogue-stack/ceska-typografie-affinity
  https://matejmoravec.com

  Inspirováno TypoSkriptem Františka Erbena pro Adobe InDesign
  (https://typoskript.cz/). Kód je napsaný celý znovu, od nuly;
  z TypoSkriptu nebyl převzat žádný kód.

  Opravuje českou hladkou sazbu podle běžných pravidel (ČSN 01 6910):
  nedělitelné mezery za jednopísmennými předložkami a spojkami, u čísel a jednotek,
  v datech, u titulů, iniciál a zkratek; české uvozovky; pomlčky; výpustku;
  nadbytečné mezery. Formátování textu zůstává zachováno.
  Vše se provede jako jeden krok, takže jde vrátit přes Cmd+Z.
*/

const NB = ' ';          // nedělitelná mezera
const OBJ = '￼';         // zástupný znak pro pole, kotvy apod.

// ---------------------------------------------------------------------------
// Pravidla
// ---------------------------------------------------------------------------

const DEFAULTS = {
    normalizeSpaces: false,  // všechny mezery na standardní (před opravou)
    extraSpaces: true,       // nadbytečné mezery
    extraTabs: false,        // nadbytečné tabulátory
    quotes: true,            // anglické uvozovky na české
    prepositions: true,      // jednopísmenné předložky a spojky
    general: true,           // data, rozsahy, pomlčky, výpustka, iniciály
    abbreviations: true,     // obecné zkratky (s. r. o., a. s., č. p. …)
    units: true,             // čísla, jednotky a měny
    titles: true,            // akademické tituly a hodnosti
    ordinals: true,          // 1 st → 1st
    urls: true               // nedělit e-maily a webové adresy
};

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
function alt(list) {
    return list.slice().sort((a, b) => b.length - a.length).map(esc).join('|');
}
function loopReplace(s, re, fn) {
    for (let i = 0; i < 6; i++) {
        const t = s.replace(re, fn);
        if (t === s) return t;
        s = t;
    }
    return s;
}

const SP = '[ \\u00A0]';                     // mezera nebo nedělitelná mezera
const BEFORE_WORD = '(^|[\\s\\u00A0(\\[{„‚"«»–—/' + OBJ + '])';

const UNITS = [
    '%', '‰', '°C', '°F', '°', 'K',
    'Kč', 'CZK', 'EUR', '€', 'USD', '$', 'CHF', 'GBP', '£', 'Sk', 'Ft', 'zł', 'PLN',
    'km', 'm', 'dm', 'cm', 'mm', 'µm', 'μm', 'nm',
    'km²', 'm²', 'dm²', 'cm²', 'mm²', 'km2', 'm2', 'cm2', 'mm2',
    'm³', 'dm³', 'cm³', 'mm³', 'm3', 'cm3',
    'ha',
    't', 'kg', 'dkg', 'g', 'mg', 'µg',
    'l', 'hl', 'dl', 'cl', 'ml',
    'h', 'hod.', 'min', 'min.', 's', 'ms', 'µs', 'ns',
    'Hz', 'kHz', 'MHz', 'GHz',
    'W', 'kW', 'MW', 'GW', 'kWh', 'MWh', 'Wh',
    'V', 'mV', 'kV', 'A', 'mA', 'Ah', 'mAh', 'Ω', 'kΩ',
    'J', 'kJ', 'MJ', 'cal', 'kcal',
    'Pa', 'hPa', 'kPa', 'MPa', 'bar', 'N', 'kN',
    'B', 'kB', 'KB', 'MB', 'GB', 'TB', 'PB', 'kb', 'Mb', 'Gb', 'kbps', 'Mbps', 'Gbps',
    'px', 'pt', 'dpi', 'ppi', 'lpi', 'mm/s', 'km/h', 'm/s',
    'ks', 'kus', 'kusů', 'Kč/ks', 'Kč/h', 'Kč/měs.',
    'mil.', 'tis.', 'mld.', 'bil.', 'x', '×'
];
// Jednotky z jednoho velkého písmene váží i předložku (V, A …), proto je
// vážeme jen tehdy, když za nimi nenásleduje další slovo malým písmenem.
const RISKY_UNITS = ['K', 'W', 'V', 'A', 'J', 'N', 'B', 's', 'x'];
const SAFE_UNITS = UNITS.filter(u => RISKY_UNITS.indexOf(u) < 0);

const NUM_ABBR = [
    'č.', 'Č.', 's.', 'S.', 'str.', 'Str.', 'odst.', 'písm.', 'obr.', 'Obr.', 'tab.', 'Tab.',
    'kap.', 'Kap.', 'r.', 'roč.', 'čl.', 'Čl.', 'tel.', 'Tel.', 'mob.', 'sv.', 'pozn.',
    'příl.', 'Příl.', 'vyd.', 'max.', 'min.', 'cca', 'ca', 'č. j.', 'č. p.', 'č. ú.',
    'ev. č.', 'reg. č.', 'kat. č.', 'bod', 'body', '§', '§§', 'čp.', 'PSČ', 'IČ', 'IČO', 'DIČ', 'No.', 'Nr.'
];

const MONTHS = [
    'ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna',
    'září', 'října', 'listopadu', 'prosince',
    'leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen',
    'říjen', 'listopad', 'prosinec'
];

const TITLES_BEFORE = [
    'Bc.', 'BcA.', 'Ing.', 'Ing. arch.', 'MUDr.', 'MDDr.', 'MVDr.', 'Mgr.', 'MgA.', 'JUDr.',
    'PhDr.', 'RNDr.', 'PharmDr.', 'PaedDr.', 'ThDr.', 'ThLic.', 'ThMgr.', 'RSDr.', 'ICDr.',
    'ICLic.', 'doc.', 'Doc.', 'prof.', 'Prof.', 'Dr.', 'akad.', 'akad. mal.', 'akad. soch.',
    'akad. arch.', 'arch.', 'Mons.', 'P.', 'p.', 'pí', 'sl.', 'sv.', 'Sv.', 'MUC.',
    // vojenské hodnosti
    'gen.', 'armgen.', 'genmjr.', 'genpor.', 'brig. gen.', 'brig.', 'plk.', 'pplk.', 'mjr.',
    'kpt.', 'npor.', 'por.', 'ppor.', 'nprap.', 'št. prap.', 'prap.', 'šrtm.', 'nrtm.',
    'rtm.', 'rtn.', 'čet.', 'des.', 'svob.', 'voj.'
];
const TITLES_AFTER = [
    'Ph.D.', 'Th.D.', 'CSc.', 'DrSc.', 'DiS.', 'MBA', 'LL.M.', 'MSc.', 'BSc.', 'M.A.', 'B.A.',
    'MPA', 'DBA', 'MA', 'BA', 'dr. h. c.', 'Dr. h. c.', 'Dr.h.c.', 'MBA, LL.M.'
];

function fixQuotes(s) {
    // dvojité
    const isOpenCtx = (prev) => prev === '' || /[\s (\[{\-–—\/„‚￼]/.test(prev);
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '"' || c === '“' || c === '”') {
            const prev = i > 0 ? out[out.length - 1] : '';
            out += isOpenCtx(prev) ? '„' : '“';
        } else {
            out += c;
        }
    }
    // jednoduché: jen v párech, aby se nerozbily apostrofy
    s = out;
    const chars = s.split('');
    let open = -1;
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        if (c !== "'" && c !== '‘' && c !== '’' && c !== '‚') continue;
        const prev = i > 0 ? chars[i - 1] : '';
        const next = i + 1 < chars.length ? chars[i + 1] : '';
        const letterPrev = /[\p{L}\p{N}]/u.test(prev);
        const letterNext = /[\p{L}\p{N}]/u.test(next);
        if (letterPrev && letterNext) continue;          // apostrof uvnitř slova
        if (open < 0) {
            if (isOpenCtx(prev) && next !== '' && !/\s/.test(next)) open = i;
        } else if (letterPrev || /[.,!?…)\]]/.test(prev)) {
            chars[open] = '‚';
            chars[i] = '‘';
            open = -1;
        }
    }
    return chars.join('');
}

// Opraví text jednoho odstavce. Nikdy nepřidává ani neubírá konce odstavců.
function fixParagraph(s, o) {
    if (o.normalizeSpaces)
        s = s.replace(/[           ]/g, ' ');

    if (o.extraTabs) {
        s = s.replace(/\t{2,}/g, '\t');
        s = s.replace(/^\t+/, '');
    }

    if (o.quotes)
        s = fixQuotes(s);

    if (o.extraSpaces) {
        s = s.replace(/[  ]{2,}/g, m => (m.indexOf(NB) >= 0 ? NB : ' '));
        s = s.replace(/^[  ]+/, '');
        s = s.replace(/[  \t]+$/, '');
        const closers = o.quotes ? '.,;!?)\\]}“‘' : '.,;!?)\\]}';
        s = s.replace(new RegExp('[ \\u00A0]+([' + closers + '])', 'g'), (m, p, off, str) => {
            // ponechat „ .“ u výpustky a mezery u „ – “ nejsou dotčeny
            if (p === '.' && str.substr(off + m.length, 2) === '..') return m;
            return p;
        });
        // dvojtečka: mezeru ponecháme u poměrů a skóre (1 : 2)
        s = s.replace(/(\S)[  ]+:(?![  ]?\d)/g, '$1:');
        s = s.replace(/([(\[{„‚])[  ]+/g, '$1');
    }

    if (o.general) {
        // výpustka
        s = s.replace(/\.{3,}/g, '…');
        s = s.replace(/\. \. \./g, '…');
        // data 1.1.2025 → 1. 1. 2025
        s = s.replace(/(^|[^\d.,])(\d{1,2})\.[  ]?(\d{1,2})\.[  ]?(\d{4})(?![\d.,]\d)/g,
            (m, b, d, mo, y) => {
                const di = +d, mi = +mo;
                if (di < 1 || di > 31 || mi < 1 || mi > 12) return m;
                return b + d + '.' + NB + mo + '. ' + y;
            });
        // 1. ledna
        s = s.replace(new RegExp('(^|[^\\d])(\\d{1,2})\\.[ \\u00A0]?(' + alt(MONTHS) + ')(?![\\p{L}])', 'gu'),
            (m, b, d, mon) => b + d + '.' + NB + mon);
        // rozsahy čísel a letopočtů: 10 - 15, 1999-2001 → pomlčka
        s = s.replace(/(^|[^\d\-–.,\/])(\d{1,4})[  ]*[-–][  ]*(\d{1,4})(?![\d\-–\/]|[.,]\d)/g,
            (m, b, a1, a2) => b + a1 + '–' + a2);
        // dvě spojovníky → pomlčka
        s = s.replace(/(^|[^-])--(?!-)/g, '$1–');
        // pomlčka mezi slovy: „slovo - slovo“ → „slovo␣– slovo“
        s = s.replace(/(\S)[  ]+[-–—][  ]+(?=\S)/g, '$1' + NB + '– ');
        // iniciály: J. Novák, J. R. R. Tolkien
        s = loopReplace(s, /(^|[\s („‚\-–])(\p{Lu})\.[ ](?=\p{Lu})/gu, (m, b, l) => b + l + '.' + NB);
        // násobení 3 x 4 → 3 × 4
        s = s.replace(/(\d)[  ]?[x×][  ]?(\d)/g, '$1' + NB + '×' + NB + '$2');
    }

    if (o.abbreviations) {
        const ABBR = [
            [/s\.[  ]?r\.[  ]?o\./g, 's.' + NB + 'r.' + NB + 'o.'],
            [/spol\.[  ]?s[  ]?r\.[  ]?o\./g, 'spol.' + NB + 's' + NB + 'r.' + NB + 'o.'],
            [/v\.[  ]?o\.[  ]?s\./g, 'v.' + NB + 'o.' + NB + 's.'],
            [/o\.[  ]?p\.[  ]?s\./g, 'o.' + NB + 'p.' + NB + 's.'],
            [/př\.[  ]?n\.[  ]?l\./g, 'př.' + NB + 'n.' + NB + 'l.'],
            [/a\.[  ]?s\.(?!\p{L})/gu, 'a.' + NB + 's.'],
            [/k\.[  ]?s\.(?!\p{L})/gu, 'k.' + NB + 's.'],
            [/z\.[  ]?s\.(?!\p{L})/gu, 'z.' + NB + 's.'],
            [/z\.[  ]?ú\./g, 'z.' + NB + 'ú.'],
            [/s\.[  ]?p\.(?!\p{L})/gu, 's.' + NB + 'p.'],
            [/č\.[  ]?p\./g, 'č.' + NB + 'p.'],
            [/č\.[  ]?j\./g, 'č.' + NB + 'j.'],
            [/č\.[  ]?ú\./g, 'č.' + NB + 'ú.'],
            [/n\.[  ]?l\./g, 'n.' + NB + 'l.'],
            [/t\.[  ]?č\./g, 't.' + NB + 'č.'],
            [/t\.[  ]?r\./g, 't.' + NB + 'r.'],
            [/t\.[  ]?j\./g, 'tj.'],
            [/a\.[  ]?j\./g, 'aj.'],
            [/Ph\.[  ]?D\./g, 'Ph.D.'],
            [/Th\.[  ]?D\./g, 'Th.D.']
        ];
        for (const [re, rep] of ABBR) {
            const src = '(^|[^\\p{L}])(?:' + re.source + ')';
            s = s.replace(new RegExp(src, 'gu'), (m, b) => b + rep);
        }
    }

    if (o.titles) {
        const before = new RegExp('(^|[^\\p{L}])(' + alt(TITLES_BEFORE) + ')[ ](?=\\p{Lu}|arch\\.|et\\b|mal\\.|soch\\.|gen\\.|prap\\.)', 'gu');
        s = loopReplace(s, before, (m, b, t) => b + t + NB);
        // uvnitř víceslovných titulů
        s = s.replace(/(Ing\.|akad\.|brig\.|št\.)[ ](arch\.|mal\.|soch\.|gen\.|prap\.)/g, '$1' + NB + '$2');
        s = s.replace(new RegExp(',[ ](' + alt(TITLES_AFTER) + ')(?![\\p{L}])', 'gu'), ',' + NB + '$1');
        s = s.replace(/dr\.[  ]?h\.[  ]?c\./gi, m => m[0] + 'r.' + NB + 'h.' + NB + 'c.');
    }

    if (o.units) {
        // tisíce: 1 000 000
        s = s.replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1' + NB);
        // číslo + jednotka
        const safe = new RegExp('(\\d|\\d,-|\\d,–)[ ](' + alt(SAFE_UNITS) + ')(?![\\p{L}\\p{N}])', 'gu');
        s = s.replace(safe, '$1' + NB + '$2');
        const risky = new RegExp('(\\d)[ ](' + alt(RISKY_UNITS) + ')(?=$|[^\\p{L}\\p{N} \\u00A0]|[ \\u00A0][^\\p{Ll}])', 'gu');
        s = s.replace(risky, '$1' + NB + '$2');
        // měna před číslem: € 50
        s = s.replace(/(^|[^\p{L}\p{N}])([€$£¥])[ ](?=\d)/gu, '$1$2' + NB);
        // zkratka + číslo: č. 5, s. 12, § 3
        const abbr = new RegExp('(^|[^\\p{L}])(' + alt(NUM_ABBR) + ')[ ](?=\\d|[a-z]\\))', 'gu');
        s = s.replace(abbr, '$1$2' + NB);
    }

    if (o.prepositions) {
        const re = new RegExp(BEFORE_WORD + '([ksvzouaiKSVZOUAI])[ ](?=\\S)', 'gu');
        s = loopReplace(s, re, (m, b, l) => b + l + NB);
    }

    if (o.ordinals)
        s = s.replace(/(\d)[  ](st|nd|rd|th)(?![\p{L}])/gu, '$1$2');

    return s;
}

const BREAK_RE = /[\n\r\u2028\u2029\u000B\u000C]/;

function splitParagraphs(text) {
    const parts = [];
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
        if (i === text.length || BREAK_RE.test(text[i])) {
            parts.push({ start, text: text.substring(start, i) });
            start = i + 1;
        }
    }
    return parts;
}

// Myersův diff dvou řetězců → seznam úseků {begin, end, text}
function diff(a, b) {
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let suf = 0;
    while (suf < a.length - pre && suf < b.length - pre &&
           a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
    const A = a.substring(pre, a.length - suf);
    const B = b.substring(pre, b.length - suf);
    if (!A.length && !B.length) return [];
    if (!A.length || !B.length) return [{ begin: pre, end: pre + A.length, text: B }];

    const N = A.length, M = B.length, MAX = N + M;
    const off = MAX;
    let V = new Int32Array(2 * MAX + 2);
    const trace = [];
    let found = false;
    for (let d = 0; d <= MAX && !found; d++) {
        trace.push(V.slice());
        for (let k = -d; k <= d; k += 2) {
            let x;
            if (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) x = V[off + k + 1];
            else x = V[off + k - 1] + 1;
            let y = x - k;
            while (x < N && y < M && A[x] === B[y]) { x++; y++; }
            V[off + k] = x;
            if (x >= N && y >= M) { found = true; break; }
        }
    }
    // zpětný průchod
    const ops = []; // {type:'eq'|'del'|'ins', ai, bi}
    let x = N, y = M;
    for (let d = trace.length - 1; d >= 0; d--) {
        const Vd = trace[d];
        const k = x - y;
        let prevK;
        if (k === -d || (k !== d && Vd[off + k - 1] < Vd[off + k + 1])) prevK = k + 1;
        else prevK = k - 1;
        const prevX = Vd[off + prevK];
        const prevY = prevX - prevK;
        while (x > prevX && y > prevY) { ops.push({ t: 'eq', ai: x - 1, bi: y - 1 }); x--; y--; }
        if (d > 0) {
            if (x === prevX) ops.push({ t: 'ins', ai: x, bi: y - 1 });
            else ops.push({ t: 'del', ai: x - 1, bi: y });
        }
        x = prevX; y = prevY;
    }
    ops.reverse();
    const hunks = [];
    let cur = null;
    for (const op of ops) {
        if (op.t === 'eq') { if (cur) { hunks.push(cur); cur = null; } continue; }
        if (!cur) cur = { begin: op.t === 'del' ? op.ai : op.ai, end: op.t === 'del' ? op.ai : op.ai, text: '' };
        if (op.t === 'del') cur.end = op.ai + 1;
        else cur.text += B[op.bi];
    }
    if (cur) hunks.push(cur);
    return hunks.map(h => ({ begin: h.begin + pre, end: h.end + pre, text: h.text }));
}

const URL_RE = /(?:https?:\/\/|s?ftps?:\/\/|www\.)[^\s ￼]+|[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}\-]+(?:\.[\p{L}\p{N}\-]+)+/gu;

// Spočítá všechny opravy pro text celého článku.
function computeEdits(text, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const edits = [];
    const finalParts = [];
    for (const p of splitParagraphs(text)) {
        const fixed = fixParagraph(p.text, o);
        finalParts.push(fixed);
        if (fixed === p.text) continue;
        for (const h of diff(p.text, fixed)) {
            const removed = p.text.substring(h.begin, h.end);
            if (removed.indexOf(OBJ) >= 0) continue;   // nikdy nesahat na pole a kotvy
            edits.push({ begin: p.start + h.begin, end: p.start + h.end, text: h.text, old: removed });
        }
    }
    // pozice adres ve výsledném textu
    const noBreak = [];
    if (o.urls) {
        let pos = 0;
        const breaks = [];
        for (let i = 0; i < text.length; i++) if (BREAK_RE.test(text[i])) breaks.push(text[i]);
        const finalText = finalParts.map((t, i) => t + (i < breaks.length ? breaks[i] : '')).join('');
        let m;
        URL_RE.lastIndex = 0;
        while ((m = URL_RE.exec(finalText)) !== null) {
            let u = m[0].replace(/[.,;:!?)\]“‘»]+$/, '');
            if (u.length > 3) noBreak.push({ begin: m.index, end: m.index + u.length });
        }
        void pos;
    }
    return { edits, noBreak };
}

function fixText(text, opts) {
    const { edits } = computeEdits(text, opts);
    let s = text;
    for (let i = edits.length - 1; i >= 0; i--) {
        const e = edits[i];
        s = s.substring(0, e.begin) + e.text + s.substring(e.end);
    }
    return s;
}

// ---------------------------------------------------------------------------
// Affinity
// ---------------------------------------------------------------------------

function main() {
    const { Document } = require('/document.js');
    const { Dialog, DialogResult } = require('/dialog.js');
    const { CompoundCommandBuilder, DocumentCommand } = require('/commands.js');
    const { Selection, TextSelection } = require('/selections.js');
    const { StoryDelta } = require('/storydelta.js');

    const doc = Document.current;
    if (!doc) {
        alert('Nejdřív otevři dokument.');
        return;
    }

    const selectedText = doc.selection.nodes.filter(n => n.isTextNode).toArray();

    // --- dialog ---
    const dlg = Dialog.create('Česká typografie');
    const col = dlg.addColumn();
    const g0 = col.addGroup('Co procházet');
    const scope = g0.addButtonSet('Rozsah', ['Celý dokument', 'Vybrané texty'], selectedText.length ? 1 : 0);
    const masters = g0.addSwitch('Včetně vzorových stránek', true);
    const hidden = g0.addSwitch('Přeskočit skryté vrstvy', true);
    const g1 = col.addGroup('Mezery');
    const sw = {};
    sw.normalizeSpaces = g1.addSwitch('Nejdřív všechny mezery na standardní', DEFAULTS.normalizeSpaces);
    sw.extraSpaces = g1.addSwitch('Odstranit nadbytečné mezery', DEFAULTS.extraSpaces);
    sw.extraTabs = g1.addSwitch('Odstranit nadbytečné tabulátory', DEFAULTS.extraTabs);
    const g2 = col.addGroup('Nedělitelné mezery');
    sw.prepositions = g2.addSwitch('Jednopísmenné předložky a spojky (v, k, s, z, o, u, a, i)', DEFAULTS.prepositions);
    sw.units = g2.addSwitch('Čísla, jednotky, měny, tisíce, § a č.', DEFAULTS.units);
    sw.titles = g2.addSwitch('Akademické tituly a hodnosti', DEFAULTS.titles);
    sw.abbreviations = g2.addSwitch('Zkratky (s. r. o., a. s., č. p. …)', DEFAULTS.abbreviations);
    const g3 = col.addGroup('Znaky');
    sw.quotes = g3.addSwitch('Uvozovky na české „ “ a ‚ ‘', DEFAULTS.quotes);
    sw.general = g3.addSwitch('Data, pomlčky, rozsahy, výpustka, iniciály', DEFAULTS.general);
    sw.ordinals = g3.addSwitch('Anglické číslovky (1 st → 1st)', DEFAULTS.ordinals);
    sw.urls = g3.addSwitch('Nedělit e-maily a webové adresy', DEFAULTS.urls);
    dlg.initialWidth = 420;

    const res = dlg.runModal();
    if ((res?.value ?? res) != DialogResult.Ok.value) return;

    const opts = {};
    for (const k of Object.keys(sw)) opts[k] = !!sw[k].value;

    // --- sběr textů ---
    const isHidden = (node) => {
        try {
            for (let n = node; n; n = n.parent) {
                if (n.isVisible === false) return true;
            }
        } catch (e) { /* ignorovat */ }
        return false;
    };

    let candidates = [];
    if (scope.selectedIndex === 1) {
        if (!selectedText.length) {
            alert('Není vybraný žádný text. Vyber textové rámečky, nebo zvol Celý dokument.');
            return;
        }
        candidates = selectedText;
    } else {
        const roots = doc.spreads.toArray();
        if (masters.value) {
            try { roots.push(...doc.masterSpreads.toArray()); } catch (e) { /* bez vzorů */ }
        }
        for (const spread of roots)
            for (const n of spread.children.all)
                if (n.isTextNode) candidates.push(n);
    }

    // jeden článek = jeden zápis (zřetězené rámečky sdílí článek)
    const targets = [];
    for (const n of candidates) {
        if (hidden.value && isHidden(n)) continue;
        let first = n;
        try {
            if (n.isFrameTextNode && n.textFrameInterface.isMultiFrameTextFlow)
                first = n.textFrameInterface.textFlowNodes[0];
        } catch (e) { /* jednoduchý rámeček */ }
        if (targets.some(t => t.isSameNode(first))) continue;
        targets.push(first);
    }

    function textSel(node, begin, end) {
        const sel = Selection.create(doc, node);
        sel.addSubSelectionForNode(node, TextSelection.create([{ begin, end }]));
        return sel;
    }

    // text článku, kde 1 znak = 1 pozice v Affinity
    function storyTextExact(story) {
        const len = story.length;
        const out = new Array(len);
        for (let i = 0; i < len; i++) {
            const g = story.getGlyph(i);
            if (g && g.isCharGlyph) {
                const str = g.string;
                out[i] = str.length === 1 ? str : OBJ;
            } else if (g && g.isHardBreakGlyph) {
                out[i] = '\n';
            } else {
                out[i] = OBJ;
            }
        }
        return out.join('');
    }

    function editsMatch(story, edits) {
        for (const e of edits) {
            for (let i = e.begin; i < e.end; i++) {
                const g = story.getGlyph(i);
                if (!g || !g.isCharGlyph || g.string !== e.old[i - e.begin]) return false;
            }
        }
        return true;
    }

    let changed = 0, stories = 0, skipped = 0;
    const builder = CompoundCommandBuilder.create();
    let cmdCount = 0;

    for (const node of targets) {
        let story;
        try { story = node.story; } catch (e) { skipped++; continue; }
        if (!story || story.isEmpty) continue;
        try { if (story.isTable) { skipped++; continue; } } catch (e) { /* ignorovat */ }

        let result = null;
        try {
            const fast = story.text;
            if (typeof fast === 'string' && fast.length === story.length) {
                const r = computeEdits(fast, opts);
                if (editsMatch(story, r.edits)) result = r;
            }
        } catch (e) { result = null; }
        if (!result) result = computeEdits(storyTextExact(story), opts);

        const { edits, noBreak } = result;
        if (!edits.length && !noBreak.length) continue;

        for (let i = edits.length - 1; i >= 0; i--) {
            const e = edits[i];
            builder.addCommand(DocumentCommand.createSetText(textSel(node, e.begin, e.end), e.text));
            cmdCount++;
        }
        for (const r of noBreak) {
            builder.addCommand(DocumentCommand.createFormatText(textSel(node, r.begin, r.end), StoryDelta.createIsNoBreak(true)));
            cmdCount++;
        }
        changed += edits.length;
        if (edits.length) stories++;
    }

    if (!cmdCount) {
        alert('Hotovo. Nebylo co opravit.');
        return;
    }
    doc.executeCommand(builder.createCommand());

    let msg = 'Hotovo. Opraveno míst: ' + changed + ' (texty: ' + stories + ').';
    if (skipped) msg += '\nPřeskočeno (tabulky apod.): ' + skipped + '.';
    msg += '\nVše vrátíš jedním Cmd+Z.';
    alert(msg);
}

if (typeof globalThis !== 'undefined' && globalThis.__CZTYPO_TEST__) {
    globalThis.__CZTYPO__ = { fixParagraph, fixText, computeEdits, diff, DEFAULTS };
} else {
    main();
}
