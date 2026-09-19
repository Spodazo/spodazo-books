import * as pdfjs from 'pdfjs-dist';
import workerURL from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {detectStoryLayout} from './layout.js';
pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
const toBlob = canvas => new Promise((resolve,reject) => canvas.toBlob(b=>b?resolve(b):reject(new Error('Image conversion failed')), 'image/jpeg', .91));
/** Import in the admin, then persist blobs + manifest. Never render PDFs per visitor. */
export async function importPDF(file, {mode='auto', signal, onProgress=()=>{}, maxPages=100, maxBytes=80*1024*1024,resourceBase=new URL(`${import.meta.env.BASE_URL}pdfjs/`,location.origin).href}={}) {
  if (!(file instanceof Blob) || !file.size) throw new Error('Choose a PDF file.');
  if (file.size > maxBytes) throw new Error('PDF exceeds the 80 MB import limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0,1024));
  if (!header.includes('%PDF-')) throw new Error('This file is not a PDF.');
  const task = pdfjs.getDocument({data:bytes, isEvalSupported:false, useSystemFonts:false, cMapUrl:new URL('cmaps/',resourceBase).href,cMapPacked:true,standardFontDataUrl:new URL('standard_fonts/',resourceBase).href,wasmUrl:new URL('wasm/',resourceBase).href});
  task.onPassword = () => { task.destroy(); };
  const abort = () => task.destroy();
  signal?.addEventListener('abort',abort,{once:true});
  const check = () => {if(signal?.aborted)throw new DOMException('Import cancelled','AbortError');};
  const urls=[];const assets=[];
  try {
    check(); const doc=await task.promise;
    if(doc.numPages>maxPages)throw new Error(`Maximum ${maxPages} pages per book.`);
    const pages=[];
    for(let i=1;i<=doc.numPages;i++) {
      check();onProgress({page:i,total:doc.numPages});
      const page=await doc.getPage(i),base=page.getViewport({scale:1});
      const content=await page.getTextContent();
      const items=content.items.filter(t=>'str' in t).map(t=>{const m=pdfjs.Util.transform(base.transform,t.transform);return {text:t.str,x:m[4],y:m[5],size:Math.hypot(m[2],m[3])};});
      const layout=detectStoryLayout(items,base.width,base.height,mode);
      const scale=Math.min(1800/Math.max(base.width,base.height),Math.sqrt(4_000_000/(base.width*base.height)));
      const viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;
      check();
      const fullBlob=await toBlob(canvas);const fullName=`page-${String(i).padStart(3,'0')}.jpg`;
      const fullURL=URL.createObjectURL(fullBlob);urls.push(fullURL);assets.push({name:fullName,blob:fullBlob});
      let imageURL=fullURL,imageAsset=fullName;
      if(layout){
        const crop=document.createElement('canvas');crop.width=Math.round(canvas.width*layout.imageFraction);crop.height=canvas.height;
        crop.getContext('2d').drawImage(canvas,0,0, crop.width,crop.height,0,0,crop.width,crop.height);
        const blob=await toBlob(crop);imageAsset=`art-${String(i).padStart(3,'0')}.jpg`;imageURL=URL.createObjectURL(blob);urls.push(imageURL);assets.push({name:imageAsset,blob});crop.width=crop.height=0;
      }
      pages.push({id:`page-${i}`,sourcePage:i,kind:layout?'story':'facsimile',title:layout?.title||`Page ${i}`,paragraphs:layout?.paragraphs||[],imageUrl:imageURL,imageAsset,fullPageUrl:fullURL,fullPageAsset:fullName,position:'bottom',focalPoint:'50% 50%'});
      canvas.width=canvas.height=0;page.cleanup();
    }
    const pdfURL=URL.createObjectURL(file);urls.push(pdfURL);
    return {book:{schemaVersion:1,title:(file.name||'New book').replace(/\.pdf$/i,'').replace(/[-_]/g,' '),pages,pdfUrl:pdfURL},assets,pdf:file,dispose(){urls.forEach(u=>URL.revokeObjectURL(u));}};
  } catch(e){urls.forEach(u=>URL.revokeObjectURL(u));if(signal?.aborted)throw new DOMException('Import cancelled','AbortError');throw new Error(e.message||'Unable to read this PDF. Password-protected PDFs must be unlocked first.');}
  finally {signal?.removeEventListener('abort',abort);await task.destroy();}
}
