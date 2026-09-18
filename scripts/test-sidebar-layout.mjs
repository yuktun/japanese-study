import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const [html,css,app]=await Promise.all(['index.html','styles.css','app.js'].map(file=>readFile(resolve(root,file),'utf8')));

assert.match(html,/id="menu-button"[^>]*aria-controls="sidebar"/,'the menu button controls the sidebar');
assert.match(css,/@media\(max-width:1366px\)/,'iPad layouts use the compact sidebar breakpoint');
assert.match(css,/@media\(max-width:1366px\)\{\.app-shell\{display:block\}\.sidebar\{position:fixed/,'compact sidebars overlay rather than resize main content');
assert.match(css,/\.app-shell\.sidebar-collapsed\{grid-template-columns:minmax\(0,1fr\)\}/,'collapsed desktop sidebars release main-content width');
assert.match(app,/const compactSidebarQuery=window\.matchMedia\('\(max-width:1366px\)'\)/,'the iPad breakpoint is shared by sidebar controls');
assert.match(app,/drawerBackdrop\.addEventListener\('click',\(\)=>setDrawerOpen\(false\)\)/,'outside taps close the overlay');
assert.match(app,/if\(event\.key==='Escape'\)\{if\(\$\('#menu-button'\)\.getAttribute\('aria-expanded'\)==='true'\)/,'Escape closes an open sidebar');

console.log('Sidebar layout tests passed.');
