import { writeFileSync } from "node:fs";

const expr = `(async()=>{
  const book=await fetch("/api/books/willows-big-forest-adventure").then(r=>r.json());
  const template=book.pages.find(p=>p.id==="page-5");
  const mk=(id,src,art,text)=>{
    const a={...template.elements.find(e=>e.type==="image")};
    const t={...template.elements.find(e=>e.type==="text")};
    const u="/media/images/"+art;
    return {id,sourcePage:src,kind:"story",title:"WILLOW\\u2019S FOREST ADVENTURE",paragraphs:[text],imageAsset:art,fullPageAsset:art,imageUrl:u,fullPageUrl:u,position:src<=3?"top":"bottom",focalPoint:"50% 50%",background:"",elements:[{...a,id:id+"-art",imageAsset:art,imageUrl:u},{...t,id:id+"-text",text,role:"body"}]};
  };
  const restored=[
    mk("page-2",2,"art-002.webp","Willow spotted a butterfly dancing between the trees.\\n\\n\\u201cWait for me!\\u201d she giggled, pattering after it."),
    mk("page-3",3,"art-003.webp","But the butterfly fluttered away.\\n\\nWillow stopped. The forest was very quiet.\\n\\n\\u201cMommy? Mamma?\\u201d she called."),
    mk("page-4",4,"art-004.webp","Rustle, rustle. Crack!\\n\\nA big brown bear stepped out from behind a tree.\\n\\nWillow\\u2019s little knees began to wobble.")
  ];
  const byId=Object.fromEntries(book.pages.map(p=>[p.id,p]));
  restored.forEach(p=>{byId[p.id]=p;});
  const order=["page-1","page-2","page-3","page-4","page-5","page-6","page-7","page-8","page-9","page-10"];
  const pages=order.filter(id=>byId[id]).map((id,i)=>({...byId[id],sourcePage:i+1}));
  const r=await fetch("/api/admin/books/"+book.id,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({pages})});
  const j=await r.json();
  return JSON.stringify({status:r.status,error:j.error,count:j.pages?.length,page2:j.pages?.[1]?.id,snippet:(j.pages?.[1]?.elements?.[1]?.text||"").slice(0,40)});
})()`;

writeFileSync(new URL("./willow-restore-compact.txt", import.meta.url), expr);
console.log(expr.length);
