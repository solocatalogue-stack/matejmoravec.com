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

const page = ({ path, title, description, image, body, jsonld, noindex }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
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
<meta name="twitter:card" content="summary_large_image">
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
</style>
</head><body>
<header class="gut"><nav><a href="/">Matěj Moravec</a><a href="/">Works</a><a href="/about/">About</a><a href="/about/#contact">Contact</a></nav></header>
<main class="gut">
${body}
</main>
</body></html>
`;

const author = { "@type": "Person", "@id": SITE + "/#person", name: "Matěj Moravec", url: SITE + "/" };
const crumbs = (...items) => ({ "@type": "BreadcrumbList", itemListElement: [{ name: "Matěj Moravec", item: SITE + "/" }, ...items].map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })) });

// project pages
for (const p of pages) {
  const path = `/${p.slug}/`;
  const list = files(p);
  const stills = list.filter(f => !isVideo(f));
  const image = media(stills[0] || "assets/og.jpg");
  const tags = p.tags.map(tagLabel);
  const shots = list.map((f, i) => isVideo(f)
    ? `<video src="${media(f)}" controls muted loop playsinline preload="metadata" aria-label="${esc(p.title)}, video ${i + 1}"></video>`
    : `<img src="${media(f)}" alt="${esc(p.title)} by Matěj Moravec, image ${i + 1}" loading="${i ? "lazy" : "eager"}">`).join("\n");
  write(`${p.slug}/index.html`, page({
    path, image,
    title: `${p.title} – Matěj Moravec`,
    description: short(p.text),
    jsonld: { "@context": "https://schema.org", "@graph": [
      { "@type": "CreativeWork", "@id": SITE + path + "#work", name: p.title, url: SITE + path, description: paragraphs(p).join(" "),
        creator: author, keywords: tags.join(", "), image: stills.slice(0, 6).map(f => SITE + media(f)),
        ...(p.link ? { sameAs: p.link[0] } : {}) },
      crumbs({ name: p.title, item: SITE + path })
    ] },
    body: `<h1>${esc(p.title)}</h1>
<div class="meta">${esc(p.years)} · ${tags.map(esc).join(", ")}</div>
${paragraphs(p).map(t => `<p>${esc(t)}</p>`).join("\n")}
${p.link ? `<p><a href="${esc(p.link[0])}" rel="noopener">${esc(p.link[1])}</a></p>` : ""}
<div class="shots">
${shots}
</div>
<p class="more"><a href="/#${p.slug}">Open in the portfolio</a> · <a href="/">All works</a></p>`
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
    crumbs({ name: "About", item: SITE + "/about/" })
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

// sitemap with images, so project images can show up in image search
const imgs = list => list.filter(f => !isVideo(f)).slice(0, 20).map(f => `<image:image><image:loc>${SITE}${encodeURI(media(f))}</image:loc></image:image>`).join("");
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>${SITE}/</loc><lastmod>${today}</lastmod><image:image><image:loc>${SITE}/assets/og.jpg</image:loc></image:image></url>
<url><loc>${SITE}/about/</loc><lastmod>${today}</lastmod></url>
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
`);
write("llms-full.txt", `${summary}
## Works
${pages.map(p => `### ${p.title}
${p.years} · ${p.tags.map(tagLabel).join(", ")}
${SITE}/${p.slug}/

${paragraphs(p).join("\n\n")}${p.link ? `\n\n${p.link[1]}: ${p.link[0]}` : ""}`).join("\n\n")}
`);

// plain links in the homepage grid for crawlers and no-JS visitors; layout() replaces them on load
const list = `<ul id="static-works">${PROJECTS.map(p => `<li>${p.text ? `<a href="/${p.slug}/">${esc(p.title)}</a>` : esc(p.title)} · ${esc(p.years)}</li>`).join("")}<li><a href="/about/">About and contact</a></li></ul>`;
index = index.replace('<div id="grid"></div>', `<div id="grid">${list}</div>`);
write("index.html", index);

console.log(`${pages.length} project pages, about page, ${Object.keys(OLD).length} old addresses checked, sitemap, llms.txt`);
