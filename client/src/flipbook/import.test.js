import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {detectStoryLayout,escapeHTML,safeURL} from '../src/layout.js';
import {getDocument,Util} from 'pdfjs-dist/legacy/build/pdf.mjs';
test('Willow PDF: all ten pages yield the matching title and story without headers or footers',async()=>{
 const task=getDocument({data:new Uint8Array(await fs.readFile(new URL('../public/Willows-Big-Forest-Adventure.pdf',import.meta.url))),useSystemFonts:true});const pdf=await task.promise;
 try{assert.equal(pdf.numPages,10);const texts=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),v=p.getViewport({scale:1}),t=await p.getTextContent();const items=t.items.filter(x=>'str'in x).map(x=>{const m=Util.transform(v.transform,x.transform);return{text:x.str,x:m[4],y:m[5],size:Math.hypot(m[2],m[3])}});const l=detectStoryLayout(items,v.width,v.height);assert.ok(l,`page ${i} detected`);assert.ok(l.title.length>3);assert.ok(l.paragraphs.join(' ').length>20);assert.ok(!l.paragraphs[0].includes(' / 10'));texts.push(l.paragraphs.join(' '));}assert.match(texts[9],/Mommy/);assert.match(texts[9],/Mamma/);assert.doesNotMatch(texts.join(' '),/Daddy/);}finally{await task.destroy();}
});
test('unsupported layouts retain whole pages rather than silently cropping',()=>{assert.equal(detectStoryLayout([],720,720),null);assert.equal(detectStoryLayout([{text:'All text',x:20,y:100,size:18}],600,900),null);});
test('safe text and assets',()=>{assert.equal(escapeHTML('<script>'), '&lt;script&gt;');assert.throws(()=>safeURL('javascript:alert(1)'));assert.throws(()=>safeURL('data:text/html,x'));assert.equal(safeURL('/art.jpg','https://books.example/'),'https://books.example/art.jpg');});
