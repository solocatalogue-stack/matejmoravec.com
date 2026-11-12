// Builds the crawlable side of the site from the data in index.html, so search engines
// and AI assistants (most of which don't run JavaScript) can read every project.
// Runs in the Pages workflow before upload; writes:
//   /<slug>/index.html   a static page per project with text, images and structured data
//   /about/index.html    bio, experience, recognition and contact as plain HTML
//   /<old-slug>/         redirects from old WordPress addresses whose slug changed
//   /sitemap.xml, /llms.txt, /llms-full.txt
// and puts a plain list of project links inside #grid in index.html (the script replaces it on load).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runInNewContext } from "node:vm";

const SITE = "https://matejmoravec.com";
const ROOT = new URL("..", import.meta.url).pathname;
const read = f => readFileSync(ROOT + f, "utf8");
const write = (f, s) => { mkdirSync(ROOT + f.replace(/[^/]*$/, ""), { recursive: true }); writeFileSync(ROOT + f, s); };

let index = read("index.html");
const grab = (start, end) => {
  const i = index.indexOf(start);
  if (i < 0) throw new Error(`index.html: "${start}" not found`);
  return index.slice(i + start.length, index.indexOf(end, i + start.length));
};
const PROJECTS = runInNewContext("[" + grab("const PROJECTS = [", "\n];") + "]");
const TAGS = runInNewContext("[" + grab("const TAGS = [", "\n];") + "]");
const ABOUT = grab("const about = `", "`;");
const CV = grab("const cv = `", "`;").replace(/\s*<h3>Contact<\/h3>\s*$/, "");
const CONTACT = grab("const contact = `", "`;");
const PERSON = JSON.parse(grab('<script type="application/ld+json">', "</script>"));

const today = new Date().toISOString().slice(0, 10);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const strip = html => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const tagLabel = id => TAGS.find(t => t.id === id).label;
const media = path => "/" + (path.startsWith("assets/") ? path : "wp-content/uploads/" + path);
const isVideo = path => /\.(mp4|webm|mov)$/i.test(path);
const short = (s, n = 158) => s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…";

// a project gets its own page only when it has words to index
const pages = PROJECTS.filter(p => p.text);
const files = p => {
  const out = [];
  const add = f => { if (typeof f === "string") out.push(f); else (f.small || f.row || []).forEach(add); };
  if (!p.coverOnly) add(p.cover[0]);
  p.shots.forEach(add);
  if (p.coverOnly) out.unshift(p.cover[0]);
  return [...new Set(out)];
};
const paragraphs = p => [p.text, ...(p.more || []), ...p.shots.filter(f => f && f.text).map(f => f.text)];

const EMAIL_JS = `<script>document.querySelectorAll(".mail").forEach(a => { const e = ["moc.cevaromjetam", "johA"].map(s => [...s].reverse().join("")).reverse().join(String.fromCharCode(64)).toLowerCase(); a.href = "mailto:" + e; a.textContent = e; });</script>`;

const page = ({ path, title, description, image, imageAlt = title, body, jsonld, noindex, lang = "en", locale = "en_GB", css = "" }) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="Matěj Moravec">
<meta name="robots" content="${noindex ? "noindex" : "index, follow, max-image-preview:large"}">
<link rel="canonical" href="${SITE}${path}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Matěj Moravec">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta property="og:locale" content="${locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}${image}">
<link rel="alternate" type="text/plain" href="/llms.txt" title="Summary for AI assistants">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
<style>
:root { color-scheme: light; --ink: #111; --muted: #8a8a86; }
body { margin: 0; background: #fff; color: var(--ink); font: 15px/1.4 "Helvetica Neue", Helvetica, Arial, sans-serif; }
.gut { padding: 0 max(16px, env(safe-area-inset-left, 0px)); }
header { padding-block: 18px 10px; }
nav { display: flex; gap: 28px; flex-wrap: wrap; align-items: baseline; }
nav a { color: inherit; text-decoration: none; }
nav a:first-child { margin-right: auto; }
main { padding-block: 30px 80px; }
h1 { font-size: clamp(28px, 5vw, 56px); font-weight: 400; letter-spacing: -.025em; line-height: 1.02; margin: 18px 0 0; max-width: 18ch; }
.meta { color: var(--muted); margin-top: 18px; }
p { max-width: 58ch; font-size: 17px; line-height: 1.45; margin: 22px 0 0; }
a { color: inherit; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 18px; margin-top: 40px; }
.shots img, .shots video { display: block; width: 100%; height: auto; border-radius: 3px; background: rgba(0,0,0,.06); }
h2 { font-size: 15px; font-weight: 700; margin: 48px 0 0; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 24px; margin-top: 14px; }
dt { color: var(--muted); }
dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.more { margin-top: 48px; font-size: 14px; }
@media (max-width: 560px) { nav { gap: 16px; } }
${css}</style>
</head><body>
<header class="gut"><nav><a href="/">Matěj Moravec</a><a href="/">Works</a><a href="/about/">About</a><a href="/about/#contact">Contact</a></nav></header>
<main class="gut">
${body}
</main>
</body></html>
`;

const author = { "@type": "Person", "@id": SITE + "/#person", name: "Matěj Moravec", url: SITE + "/" };
const website = { "@type": "WebSite", "@id": SITE + "/#website", url: SITE + "/", name: "Matěj Moravec", inLanguage: "en", author: { "@id": SITE + "/#person" }, publisher: { "@id": SITE + "/#person" } };
const firstYear = p => (String(p.years).match(/(19|20)\d\d/) || [])[0];
// every project page links to the next ones in portfolio order, so crawlers reach all of them
const related = p => { const i = pages.indexOf(p); return [1, 2, 3, 4].map(k => pages[(i + k) % pages.length]); };
const crumbs = (...items) => ({ "@type": "BreadcrumbList", itemListElement: [{ name: "Matěj Moravec", item: SITE + "/" }, ...items].map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })) });

// project pages
for (const p of pages) {
  const path = `/${p.slug}/`;
  const list = files(p);
  const stills = list.filter(f => !isVideo(f));
  const image = `/assets/og/${p.slug}.jpg`;
  const tags = p.tags.map(tagLabel);
  const shots = list.map((f, i) => isVideo(f)
    ? `<video src="${media(f)}" controls muted loop playsinline preload="metadata" aria-label="${esc(p.title)}, video ${i + 1}"></video>`
    : `<img src="${media(f)}" alt="${esc(p.title)} by Matěj Moravec: ${esc(tags.join(", ").toLowerCase())}, ${i + 1} of ${list.length}" loading="${i ? "lazy" : "eager"}">`).join("\n");
  write(`${p.slug}/index.html`, page({
    path, image,
    title: `${p.title} – ${tags[0]} by Matěj Moravec`,
    imageAlt: `${p.title} by Matěj Moravec`,
    description: short(p.text),
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "CreativeWork", "@id": SITE + path + "#work", name: p.title, url: SITE + path, description: paragraphs(p).join(" "),
        creator: author, author: { "@id": SITE + "/#person" }, keywords: tags.join(", "), inLanguage: "en", isPartOf: { "@id": SITE + "/#website" },
        ...(firstYear(p) ? { dateCreated: firstYear(p) } : {}), thumbnailUrl: SITE + image,
        image: stills.slice(0, 6).map(f => SITE + encodeURI(media(f))),
        ...(p.link ? { sameAs: p.link[0] } : {}) },
      website, crumbs({ name: p.title, item: SITE + path })
    ] },
    body: `<h1>${esc(p.title)}</h1>
<div class="meta">${esc(p.years)} · ${tags.map(esc).join(", ")}</div>
${paragraphs(p).map(t => `<p>${esc(t)}</p>`).join("\n")}
${p.link ? `<p><a href="${esc(p.link[0])}" rel="noopener">${esc(p.link[1])}</a></p>` : ""}
<div class="shots">
${shots}
</div>
<h2>More work</h2>
<ul>
${related(p).map(r => `<li><a href="/${r.slug}/">${esc(r.title)}</a> · ${esc(r.years)}</li>`).join("\n")}
</ul>
<p class="more"><a href="/#${p.slug}">Open in the portfolio</a> · <a href="/">All works</a> · <a href="/about/">About Matěj Moravec</a></p>`
  }));
}

// about page: the same text as the About sheet, with the email assembled in the browser
const contact = CONTACT
  .replace(/<dd><a id="mail"[^]*?<\/dd>/, '<dd><a class="mail" href="/about/#contact">Email address loads with JavaScript</a></dd>')
  .replace(/ target="_blank"/g, "").replace(/ style="color:inherit"/g, "");
const bio = strip(ABOUT.replace(/<h2>[^]*?<\/h2>/, ""));
write("about/index.html", page({
  path: "/about/",
  title: "About Matěj Moravec – Art Director in Lausanne",
  description: short(strip(ABOUT)),
  image: "/assets/og.jpg",
  jsonld: { "@context": "https://schema.org", "@graph": [
    { "@type": "ProfilePage", "@id": SITE + "/about/", url: SITE + "/about/", name: "About Matěj Moravec", mainEntity: { "@id": SITE + "/#person" } },
    { ...PERSON, "@context": undefined, "@id": SITE + "/#person", description: bio },
    website, crumbs({ name: "About", item: SITE + "/about/" })
  ] },
  body: `<h1>${strip(ABOUT.match(/<h2>([^]*?)<\/h2>/)[1])}</h1>
${ABOUT.replace(/<h2>[^]*?<\/h2>/, "").trim()}
${CV.replace(/<h3>/g, "<h2>").replace(/<\/h3>/g, "</h2>").replace(/ target="_blank"/g, "").replace(/ style="color:inherit"/g, "")}
<h2 id="contact">Contact</h2>
${contact}
<h2>Selected works</h2>
<ul>
${pages.map(p => `<li><a href="/${p.slug}/">${esc(p.title)}</a></li>`).join("\n")}
</ul>
${EMAIL_JS}`
}));

// old WordPress addresses whose slug changed: a real page that forwards, so search engines move the ranking over
const OLD = runInNewContext("(" + read("404.html").match(/const OLD = (\{[^]*?\});/)[1] + ")");
for (const [from, to] of Object.entries(OLD)) {
  const target = to === "about" ? "/about/" : `/${to}/`;
  if (from === to || !(to === "about" || pages.some(p => p.slug === to))) continue;
  write(`${from}/index.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Matěj Moravec</title>
<link rel="canonical" href="${SITE}${target}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
</head><body><a href="${target}">${SITE}${target}</a></body></html>
`);
}


// free tools: a Czech page for the open-source Czech typography script for Affinity
const TYPO = "/ceska-typografie/";
const typoText = "Skript zdarma pro Affinity Publisher, který opraví českou sazbu: nedělitelné mezery za jednoznakovými předložkami, české uvozovky, pomlčky, data i jednotky. Inspirovaný TypoSkriptem, napsaný od nuly.";
// the page practises what the script does: no single-letter word or number left at a line end
const czNbsp = html => html.replace(/>([^<]+)</g, (m, t) => ">" + t
  .replace(/(^|[\s(„])([ksvzouaiKSVZOUAI]) (?=\S)/g, "$1$2\u00a0").replace(/(^|[\s(„])([ksvzouaiKSVZOUAI]) (?=\S)/g, "$1$2\u00a0")
  .replace(/(\d) (?=\d{3}\b|%|Kč|Ph|Cmd)/g, "$1\u00a0").replace(/(\d\.) (?=\d|ledna)/g, "$1\u00a0") + "<");
write("ceska-typografie/index.html", page({
  path: TYPO, lang: "cs", locale: "cs_CZ",
  title: "Česká typografie pro Affinity Publisher – skript jako TypoSkript, zdarma",
  description: typoText,
  image: "/assets/og.jpg",
  css: `.get { display: inline-block; margin-top: 30px; padding: 14px 26px; font-size: 19px; text-decoration: none; background: #fff; border: 1.5px solid var(--ink); border-radius: 14px; box-shadow: 0 6px 0 0 var(--ink); transition: transform .15s ease, box-shadow .15s ease; }
.get:hover { transform: translateY(-2px); box-shadow: 0 8px 0 0 var(--ink); }
.get:active { transform: translateY(6px); box-shadow: none; }
ul, ol { max-width: 58ch; font-size: 17px; line-height: 1.45; margin: 14px 0 0; padding-left: 1.3em; }
li + li { margin-top: 6px; }
code { font-size: .92em; }`,
  jsonld: { "@context": "https://schema.org", "@graph": [
    { "@type": "SoftwareApplication", "@id": SITE + TYPO + "#app", name: "Česká typografie pro Affinity", url: SITE + TYPO, description: typoText,
      applicationCategory: "DesignApplication", keywords: "česká typografie, Affinity Publisher, TypoSkript pro Affinity, jednoznakové předložky, nedělitelné mezery, české uvozovky, skript", operatingSystem: "macOS, Windows", softwareRequirements: "Affinity 3.3 nebo novější", softwareVersion: "1.0", inLanguage: "cs",
      downloadUrl: SITE + "/assets/ceska-typografie/CeskaTypografie.js", codeRepository: "https://github.com/solocatalogue-stack/ceska-typografie-affinity", sameAs: "https://github.com/solocatalogue-stack/ceska-typografie-affinity", license: "https://www.gnu.org/licenses/gpl-3.0.html",
      offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" }, author: { "@id": SITE + "/#person" }, isPartOf: { "@id": SITE + "/#website" } },
    website, crumbs({ name: "Česká typografie pro Affinity", item: SITE + TYPO })
  ] },
  body: czNbsp(`<h1>Česká typografie pro Affinity</h1>
<p class="meta">Pro Affinity od Canvy, verze 3.3 a novější · verze skriptu 1.0, listopad 2026 · zdarma, licence GNU GPL v3, © 2026 Matěj Moravec</p>
<p>Skript, který jedním kliknutím opraví českou sazbu v Affinity: nedělitelné mezery za jednoznakovými předložkami, uvozovky, pomlčky a další drobnosti, na které se v textech od klientů pořád zapomíná. Je zdarma a otevřený, takže ho může kdokoli používat, upravovat a navrhovat vylepšení.</p>
<a class="get" href="/assets/ceska-typografie/CeskaTypografie.js" download>Stáhnout CeskaTypografie.js</a>
<p class="meta">Zdrojový kód a návrhy úprav: <a href="https://github.com/solocatalogue-stack/ceska-typografie-affinity">GitHub</a></p>

<h2>Co opravuje</h2>
<ul>
<li>nedělitelné mezery za jednoznakovými předložkami a spojkami (v, k, s, z, o, u, a, i), aby nezůstávaly na konci řádku</li>
<li>mezery mezi číslem a jednotkou nebo měnou a v tisících (250 Kč, 10 %, 1 000)</li>
<li>data (3. 12. 2026, 1. ledna), tituly (Ing., Mgr., Ph.D.), iniciály a zkratky (s. r. o., a. s., č. p.)</li>
<li>anglické uvozovky na české „ “ a ‚ ‘</li>
<li>pomlčky v rozsazích (10–15) a mezi slovy, tři tečky na výpustku …, znak × u rozměrů</li>
<li>zdvojené mezery a tabulátory</li>
<li>e-maily a webové adresy, aby se nelámaly na konci řádku</li>
</ul>
<p>Každé pravidlo jde v okně skriptu vypnout. Formátování textu zůstane, jak bylo, a celou opravu vrátíte jedním Cmd+Z.</p>

<h2>Instalace</h2>
<p>Skript funguje v Affinity od Canvy ve verzi 3.3 a novější, protože skriptování přibylo až v této verzi. Ve starých aplikacích Affinity Publisher, Designer a Photo (V1 a V2) nepoběží.</p>
<ol>
<li>V Affinity otevřete Settings › Scripting a zapněte <em>Enable Affinity Scripting</em>.</li>
<li>Stažený soubor otevřete v textovém editoru (třeba TextEdit), označte všechno a zkopírujte.</li>
<li>V Affinity otevřete Window › Scripting › Script Editor, zvolte New Script, text vložte a uložte ho pod názvem „Česká typografie“.</li>
</ol>

<h2>Použití</h2>
<p>Označte textové rámečky, které chcete opravit. Když nic neoznačíte, skript projde celý dokument. Pak v knihovně skriptů klikněte na Česká typografie, vyberte pravidla a potvrďte.</p>

<h2>Inspirace TypoSkriptem</h2>
<p>Předlohou byl <a href="https://typoskript.cz/">TypoSkript</a> Františka Erbena, nástroj na opravu české sazby v Adobe InDesign, který čeští grafici a sazeči používají už roky. Pro Affinity nic podobného nebylo, tak vznikl tenhle skript.</p>
<p>Česká typografie pro Affinity je ale napsaná celá znovu, od nuly. S TypoSkriptem nesdílí žádný kód, pravidla vycházejí z normy pro úpravu písemností ČSN 01 6910 a z běžných zvyklostí české sazby. Pokud pracujete v InDesignu, sáhněte po originále: <a href="https://typoskript.erben.work/aktualni-verze/">aktuální verze TypoSkriptu</a> a <a href="https://typoskript.erben.work/napoveda/">nápověda</a>.</p>

<h2>Otevřený kód a návrhy úprav</h2>
<p>Zdrojový kód je veřejně na GitHubu: <a href="https://github.com/solocatalogue-stack/ceska-typografie-affinity">ceska-typografie-affinity</a>. Když skript něco opraví špatně nebo mu chybí pravidlo, <a href="https://github.com/solocatalogue-stack/ceska-typografie-affinity/issues/new/choose">nahlaste to</a> a přidejte ukázku textu. Kdo umí JavaScript, může rovnou poslat <a href="https://github.com/solocatalogue-stack/ceska-typografie-affinity/pulls">pull request</a> s úpravou.</p>

<h2>Licence</h2>
<p>Skript je zdarma pod licencí <a href="https://www.gnu.org/licenses/gpl-3.0.html">GNU GPL v3</a>. Můžete ho používat i v placené práci, upravovat ho a šířit dál. Když ale upravenou verzi zveřejníte, musí zůstat otevřená pod stejnou licencí a s uvedeným autorem.</p>
<p class="more"><a href="/">Portfolio Matěje Moravce</a> · <a href="/about/">O mně a kontakt</a></p>`)
}));

// sitemap with images, so project images can show up in image search
const imgs = list => list.filter(f => !isVideo(f)).slice(0, 20).map(f => `<image:image><image:loc>${SITE}${encodeURI(media(f))}</image:loc></image:image>`).join("");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE}/</loc><lastmod>${today}</lastmod><image:image><image:loc>${SITE}/assets/og.jpg</image:loc></image:image></url>
<url><loc>${SITE}/about/</loc><lastmod>${today}</lastmod></url>
<url><loc>${SITE}${TYPO}</loc><lastmod>${today}</lastmod></url>
${pages.map(p => `<url><loc>${SITE}/${p.slug}/</loc><lastmod>${today}</lastmod>${imgs(files(p))}</url>`).join("\n")}
</urlset>
`);

// llms.txt: a short plain summary for AI assistants, with links to every page (llmstxt.org)
const cvLines = [...CV.matchAll(/<dt>([^<]*)<\/dt><dd>([^]*?)<\/dd>/g)].map(m => `- ${m[1]}: ${strip(m[2])}`);
const split = cvLines.length - [...CV.split("<h3>Recognition</h3>")[1].matchAll(/<dt>/g)].length;
const links = [...CONTACT.matchAll(/<dt>([^<]*)<\/dt><dd><a href="(http[^"]+)"/g)].map(m => `- [${m[1]}](${m[2]})`);
const summary = `# Matěj Moravec

> ${strip(ABOUT.match(/<h2>([^]*?)<\/h2>/)[1])} Matěj Moravec works across brand identity, typography, type design, posters, motion design and audio-reactive visuals for commercial, cultural and independent clients.

${bio}

## Key facts
- Name: Matěj Moravec (also written Matej Moravec); makes music as Nathan Solo
- Based in: Lausanne, Switzerland; born in Prague, Czech Republic
- Work: art director and senior graphic designer; ${(PERSON.knowsAbout || []).slice(0, 12).join(", ").toLowerCase()}
- Current role: ${strip(CV.match(/<dd>([^]*?)<\/dd>/)[1])}
- Languages: ${(PERSON.knowsLanguage || []).join(", ")}
- Education: ${(PERSON.alumniOf || []).map(a => a.name).join("; ")}
- Website: ${SITE}/ (portfolio), ${SITE}/about/ (CV and contact)

## Experience
${cvLines.slice(0, split).join("\n")}

## Recognition
${cvLines.slice(split).join("\n")}

## Contact
- [About and contact page](${SITE}/about/#contact)
${links.join("\n")}
`;
write("llms.txt", `${summary}
## Works
${pages.map(p => `- [${p.title}](${SITE}/${p.slug}/): ${short(p.text, 200)}`).join("\n")}

## Free tools
- [Česká typografie pro Affinity](${SITE}${TYPO}): ${typoText}
`);
write("llms-full.txt", `${summary}
## Works
${pages.map(p => `### ${p.title}
${p.years} · ${p.tags.map(tagLabel).join(", ")}
${SITE}/${p.slug}/

${paragraphs(p).join("\n\n")}${p.link ? `\n\n${p.link[1]}: ${p.link[0]}` : ""}`).join("\n\n")}
`);

// plain links in the homepage grid for crawlers and no-JS visitors; layout() replaces them on load
const list = `<ul id="static-works">${PROJECTS.map(p => `<li>${p.text ? `<a href="/${p.slug}/">${esc(p.title)}</a>` : esc(p.title)} · ${esc(p.years)}</li>`).join("")}<li><a href="/about/">About and contact</a></li><li><a href="/ceska-typografie/" lang="cs">Česká typografie pro Affinity</a></li></ul>`;
index = index.replace(/<div id="grid">[^]*?<\/div><\/main>/, `<div id="grid">${list}</div></main>`);
// homepage: the site and the list of works as structured data, next to the Person block
const home = { "@context": "https://schema.org", "@graph": [
  website,
  { "@type": "CollectionPage", "@id": SITE + "/#works", url: SITE + "/", name: "Works by Matěj Moravec", isPartOf: { "@id": SITE + "/#website" }, about: { "@id": SITE + "/#person" },
    mainEntity: { "@type": "ItemList", itemListElement: pages.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/${p.slug}/`, name: p.title })) } }
] };
index = index.replace("</head>", `<script type="application/ld+json">\n${JSON.stringify(home)}\n</script>\n</head>`);
write("index.html", index);

console.log(`${pages.length} project pages, about page, ${Object.keys(OLD).length} old addresses checked, sitemap, llms.txt`);
