import fs from 'node:fs'
const BASE = 'https://solid-panes.github.io/store/catalogue.jsonld'
const id = (frag) => ({ '@id': BASE + '#' + frag })
const me = 'Melvin Carvalho'
const panes = [
  ['notes', 'Notes reader', 'Markdown notes read as pages, with links between notes and previous and next.', 'https://solid-panes.github.io/notes/notes-pane.js', 'https://solid-panes.github.io/notes/', me, 'MIT'],
  ['chess', 'Chess', 'A chess game kept in your pod, played on a board in the data browser.', 'https://solid-panes.github.io/chess/chess-pane.js', 'https://solid-panes.github.io/chess/', me, 'GPL-3.0'],
  ['profile', 'Profile', "A person's profile: photo, name, bio, CV, projects, skills, languages, contacts and friends. Read-only.", 'https://solid-panes.github.io/profile/profile-pane.js', 'https://solid-panes.github.io/profile/', me, 'MIT'],
  ['poll', 'Poll', 'Find a time for a call or a meeting. Offer hours; people say which they can make, each in their own time zone.', 'https://solid-panes.github.io/poll/poll-pane.js', 'https://solid-panes.github.io/poll/', me, 'MIT'],
  ['tool-index', 'Tool index dashboard', 'The dashboard for your tool index: add, switch off and remove panes and apps.', 'https://solid-panes.github.io/tool-index/tool-index-pane.js', 'https://solid-panes.github.io/tool-index/', me, 'MIT']
]
// Apps from the list PodOS offers (core/src/open-with), with the same types.
const apps = [
  ['data-browser', 'Data Browser (SolidOS)', 'The SolidOS data browser, for anything.', 'https://solidos.github.io/mashlib/dist/browse.html?uri={url}', '', 'https://github.com/SolidOS/mashlib'],
  ['penny', 'Penny', 'A plain view of the data in any resource, for anything.', 'https://penny.vincenttunru.com/explore/?url={url}', '', 'https://penny.vincenttunru.com/'],
  ['solid-file-manager', 'Solid File Manager', 'A file manager for a folder.', 'https://otto-aa.github.io/solid-filemanager/?url={url}', 'http://www.w3.org/ns/ldp#Container', 'https://github.com/Otto-AA/solid-filemanager'],
  ['umai', 'Umai', 'A recipe manager. Opens a recipe in its viewer.', 'https://umai.noeldemartin.com/viewer?url={url}', 'https://schema.org/Recipe', 'https://umai.noeldemartin.com/'],
  ['podos-contacts', 'PodOS Contacts', 'Opens an address book. Experimental.', 'https://contacts.pod-os.org/address-book?uri={url}', 'http://www.w3.org/2006/vcard/ns#AddressBook', 'https://contacts.pod-os.org/']
]
const graph = [{
  '@id': BASE, '@type': 'tools:ToolIndex',
  'schema:name': 'solid-panes store',
  'schema:description': 'A public catalogue of panes and apps for a Solid tool index. Each entry is a registration that can be copied into your own index.',
  'tools:registration': [...panes, ...apps].map(e => id(e[0]))
}]
for (const [frag, name, description, url, home, author, licence] of panes) {
  graph.push({ ...id(frag), '@type': 'tools:Registration', 'schema:name': name, 'schema:description': description, 'schema:author': author, 'schema:license': licence, 'schema:mainEntityOfPage': { '@id': home }, 'ac:capability': id(frag + '-cap') })
  graph.push({ ...id(frag + '-cap'), '@type': 'ac:Capability', 'ac:action': { '@id': 'odrl:display' }, 'ac:invocation': id(frag + '-inv') })
  graph.push({ ...id(frag + '-inv'), '@type': 'panes:PaneModuleInvocation', 'schema:url': url })
}
for (const [frag, name, description, template, kind, home] of apps) {
  graph.push({ ...id(frag), '@type': 'tools:AppRegistration', 'schema:name': name, 'schema:description': description, 'schema:mainEntityOfPage': { '@id': home }, 'ac:capability': id(frag + '-cap') })
  graph.push({ ...id(frag + '-cap'), '@type': 'ac:Capability', 'ac:action': { '@id': 'odrl:display' }, ...(kind ? { 'ac:resourceType': { '@id': kind } } : {}), 'ac:invocation': id(frag + '-inv') })
  graph.push({ ...id(frag + '-inv'), '@type': 'ac:UriTemplateInvocation', 'hydra:template': template, 'hydra:mapping': id(frag + '-map') })
  graph.push({ ...id(frag + '-map'), 'hydra:variable': 'url', 'hydra:property': { '@id': 'ac:open' } })
}
const doc = { '@context': { tools: 'https://pod-os.org/vocab/tools#', ac: 'https://www.w3.org/ns/ac#', hydra: 'http://www.w3.org/ns/hydra/core#', schema: 'https://schema.org/', odrl: 'http://www.w3.org/ns/odrl/2/', panes: 'https://mashlib.com/ns/panes#' }, '@graph': graph }
fs.writeFileSync(new URL('catalogue.jsonld', import.meta.url), JSON.stringify(doc, null, 2) + '\n')
console.log(panes.length + ' panes, ' + apps.length + ' apps, ' + graph.length + ' nodes')
