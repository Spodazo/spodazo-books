/** Adapt uploadAsset to your authenticated storage/backend; returns durable HTTPS URLs. */
export async function persistImportedBook(imported,uploadAsset,saveManifest) {
  const urls=new Map();
  for(const asset of imported.assets)urls.set(asset.name,await uploadAsset(asset.blob,asset.name));
  const pdfUrl=await uploadAsset(imported.pdf,'book.pdf');
  const book={...imported.book,pdfUrl,pages:imported.book.pages.map(p=>({...p,imageUrl:urls.get(p.imageAsset),fullPageUrl:urls.get(p.fullPageAsset)}))};
  // Do not save browser-local blob: URLs in your database.
  if([book.pdfUrl,...book.pages.flatMap(p=>[p.imageUrl,p.fullPageUrl])].some(u=>!u||!/^https?:\/\//.test(u)))throw new Error('Storage adapter must return durable HTTP(S) URLs.');
  return await saveManifest(book);
}
