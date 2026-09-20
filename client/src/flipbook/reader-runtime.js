(function(){
'use strict';
var book=document.querySelector('main'),originals=Array.prototype.slice.call(book.querySelectorAll('.page')).map(function(p){return p.cloneNode(true)}),pages=[],index=0,busy=false,start=null,lastTouch=0;
var count=document.getElementById('count'),mobile=false;
function status(){pages.forEach(function(p,i){p.classList.toggle('current',i===index);p.setAttribute('aria-hidden',i!==index);});count.textContent='Page '+(index+1)+' of '+pages.length;updateCurl();}
function updateCurl(){
  var curl=document.querySelector('.page-curl');
  if(!curl)return;
  curl.hidden=!!busy||!pages[index+1];
}
function fits(section){return section.scrollHeight<=section.clientHeight+1;}
function isPageNum(s){return /^\d+\s*\/\s*\d+$/.test(String(s).replace(/<[^>]+>/g,'').trim());}
function endsSentence(s){return /[.!?][”"']?\s*$/.test(String(s).replace(/<[^>]+>/g,''));}
function groupParagraphs(html){
  var lines=String(html).split(/<br\s*\/?>(?:\s*)/i).map(function(s){return s.trim();}).filter(function(s){return s&&!isPageNum(s);});
  var out=[],pending='';
  lines.forEach(function(line){
    var plain=line.replace(/<[^>]+>/g,'');
    if(pending&&/^[“"]/.test(plain)){out.push(pending);pending='';}
    pending+=(pending?' ':'')+line;
    if(endsSentence(line)){out.push(pending);pending='';}
  });
  if(pending)out.push(pending);
  return out.length?out:[''];
}
function sentencesOf(html){
  var text=String(html),out=[],last=0,re=/[.!?][”"']?/g,m;
  while((m=re.exec(text))){var piece=text.slice(last,m.index+m[0].length).trim();if(piece)out.push(piece);last=m.index+m[0].length;}
  var tail=text.slice(last).trim();
  if(tail)out.push(tail);
  return out.length?out:[text];
}
function takeWordsPreferSentence(article,html){
  var section=article.querySelector('section'),body=article.querySelector('p');
  var tokens=String(html).split(/(\s+)/).filter(Boolean),low=0,high=tokens.length;
  while(low<high){var mid=Math.ceil((low+high)/2);body.innerHTML=tokens.slice(0,mid).join('');if(fits(section))low=mid;else high=mid-1;}
  var count=Math.max(1,low),slice=tokens.slice(0,count).join(''),last=-1,re=/[.!?][”"']?/g,m;
  while((m=re.exec(slice)))last=m.index+m[0].length;
  if(last>=12){var used=slice.slice(0,last).trim();body.innerHTML=used;return String(html).slice(used.length).replace(/^\s+/,'');}
  body.innerHTML=slice;
  return tokens.slice(count).join('').replace(/^\s+/,'');
}
function splitLong(article,html){
  var section=article.querySelector('section'),body=article.querySelector('p');
  var sents=sentencesOf(html),kept=[],i;
  for(i=0;i<sents.length;i++){
    body.innerHTML=kept.concat([sents[i]]).join(' ');
    if(!fits(section)){
      if(!kept.length)return takeWordsPreferSentence(article,html);
      body.innerHTML=kept.join(' ');
      return sents.slice(i).join(' ');
    }
    kept.push(sents[i]);
  }
  return '';
}
var PGAP=' ';
function takeComplete(article,units){
  var section=article.querySelector('section'),body=article.querySelector('p'),kept=[],i;
  for(i=0;i<units.length;i++){
    body.innerHTML=kept.concat([units[i]]).join(PGAP);
    if(!fits(section)){
      if(!kept.length){
        var leftover=splitLong(article,units[i]);
        return (leftover?[leftover]:[]).concat(units.slice(i+1));
      }
      body.innerHTML=kept.join(PGAP);
      return units.slice(i);
    }
    kept.push(units[i]);
  }
  return [];
}
function rebuild(){if(busy)return;var source=pages[index]?pages[index].getAttribute('data-source'):'0';mobile=matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1100px)').matches;document.documentElement.classList.toggle('mobile',mobile);book.innerHTML='';pages=[];
originals.forEach(function(template,i){var p=template.cloneNode(true);p.setAttribute('data-source',String(i));p.className=template.className.replace(/\bcurrent\b/g,'').trim();book.appendChild(p);pages.push(p);
if(mobile&&!p.classList.contains('facsimile')&&!p.classList.contains('title-page')&&!p.classList.contains('cover-plate')&&!p.classList.contains('end-page')){
p.classList.add('current');p.style.visibility='hidden';
var box=p.querySelector('section'),text=p.querySelector('p');
if(box&&text){
 var units=groupParagraphs(text.innerHTML);
 text.innerHTML=units.join(PGAP);
 var img=p.querySelector('img'),imgH=img&&img.getBoundingClientRect().height||0;
 box.style.maxHeight=Math.max(120,Math.floor(imgH>40?book.clientHeight-imgH-20:book.clientHeight*.26))+'px';
 var size=parseFloat(getComputedStyle(text).fontSize);
 while(!fits(box)&&size>14){size-=.5;text.style.fontSize=size+'px';}
 if(!fits(box)){
  var rest=takeComplete(p,units);
  while(rest.length){
   var extra=template.cloneNode(true);
   extra.className=template.className.replace(/\bcurrent\b/g,'').trim()+' continuation current';
   extra.style.visibility='hidden';
   extra.setAttribute('data-source',String(i));
   extra.querySelector('p').style.fontSize=text.style.fontSize||'';
   extra.querySelector('p').innerHTML='';
   book.appendChild(extra);
   rest=takeComplete(extra,rest);
   extra.classList.remove('current');
   extra.style.visibility='';
   pages.push(extra);
  }
 }
}
p.classList.remove('current');p.style.visibility='';}

});if(mobile){pages.forEach(function(p){if(p.classList.contains('title-page')||p.classList.contains('cover-plate')||p.classList.contains('facsimile')||p.classList.contains('end-page'))return;p.classList.add('current');p.style.visibility='hidden';var section=p.querySelector('section'),body=p.querySelector('p');if(!section||!body){p.classList.remove('current');p.style.visibility='';return;}var size=parseFloat(getComputedStyle(body).fontSize);while(section.scrollHeight>section.clientHeight+1&&size>14){size-=.5;body.style.fontSize=size+'px';}p.classList.remove('current');p.style.visibility='';});}else{pages.forEach(function(p){if(p.classList.contains('title-page')||p.classList.contains('cover-plate')||p.classList.contains('facsimile')||p.classList.contains('end-page'))return;var section=p.querySelector('section'),body=p.querySelector('p');if(!section||!body)return;p.classList.add('current');var size=parseFloat(getComputedStyle(body).fontSize);while(section.scrollHeight>section.clientHeight+1&&size>15){size-=.5;body.style.fontSize=size+'px';}p.classList.remove('current');});}index=Math.max(0,pages.findIndex(function(p){return p.getAttribute('data-source')===source}));if(index<0)index=0;status();}
function copy(p){var c=p.cloneNode(true);c.classList.remove('current');c.classList.add('leaf-copy');c.setAttribute('aria-hidden','true');return c;}
function specialPage(p){return p.classList.contains('cover-plate');}
function finishFlip(layer,n){return function(){if(!busy)return;index=n;layer.remove();busy=false;status();};}
function animateLeaf(leaf,forward,done){
  leaf.style.transform=forward?'rotateY(0deg)':'rotateY(-180deg)';
  var timer;
  function finish(){if(leaf._done)return;leaf._done=true;clearTimeout(timer);done();}
  leaf.addEventListener('transitionend',function(e){if(e.target===leaf&&e.propertyName==='transform')finish();});
  requestAnimationFrame(function(){requestAnimationFrame(function(){leaf.style.transition='transform 900ms cubic-bezier(.3,.05,.2,1)';leaf.style.transform=forward?'rotateY(-180deg)':'rotateY(0deg)';timer=setTimeout(finish,1100);});});
}
function show(n){if(busy||n<0)return;if(n>=pages.length)n=0;if(n===index)return;var old=pages[index],next=pages[n];if(specialPage(old)||specialPage(next)){index=n;status();return;}busy=true;updateCurl();var forward=n>index;var layer=document.createElement('div');layer.setAttribute('aria-hidden','true');
if(mobile){
  layer.className='flip-layer mobile-flip';
  var under=document.createElement('div');under.className='mobile-under';under.appendChild(copy(next));layer.appendChild(under);
  var mleaf=document.createElement('div');mleaf.className='mobile-leaf';
  var mfront=document.createElement('div'),mback=document.createElement('div');mfront.className='mobile-leaf-face';mback.className='mobile-leaf-face mobile-leaf-back';
  mfront.appendChild(copy(forward?old:next));mback.appendChild(copy(forward?next:old));
  mleaf.appendChild(mfront);mleaf.appendChild(mback);layer.appendChild(mleaf);
  mleaf.style.transform=forward?'rotateY(0deg)':'rotateY(-180deg)';
  book.appendChild(layer);
  next.classList.add('current');
  animateLeaf(mleaf,forward,finishFlip(layer,n));
  return;
}
layer.className='flip-layer';
var underLeft=document.createElement('div'),underRight=document.createElement('div');underLeft.className='fixed-half left-half';underRight.className='fixed-half right-half';underLeft.appendChild(copy(forward?old:next));underRight.appendChild(copy(forward?next:old));layer.appendChild(underLeft);layer.appendChild(underRight);
var leaf=document.createElement('div');leaf.className='leaf';var front=document.createElement('div'),back=document.createElement('div');front.className='leaf-face leaf-front';back.className='leaf-face leaf-back';front.appendChild(copy(forward?old:next));back.appendChild(copy(forward?next:old));leaf.appendChild(front);leaf.appendChild(back);layer.appendChild(leaf);book.appendChild(layer);
next.classList.add('current');
animateLeaf(leaf,forward,finishFlip(layer,n));
}
function restart(){
  if(mobile){
    var layer=book.querySelector('.flip-layer');
    if(layer)layer.remove();
    busy=false;
    index=0;
    status();
    return;
  }
  show(0);
}
function direction(target){var z=target.closest('[data-dir]');return z?Number(z.getAttribute('data-dir')):0;}
book.addEventListener('touchstart',function(e){if(e.touches.length!==1){start=null;return;}start={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
book.addEventListener('touchend',function(e){if(e.target.closest&&(e.target.closest('.admin-login')||e.target.closest('.reader-close'))){start=null;return;}if(e.target.closest&&e.target.closest('.read-again')){e.preventDefault();start=null;lastTouch=Date.now();restart();return;}if(!start)return;var t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;var dir=0;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)dir=dx<0?1:-1;else if(!mobile&&Math.abs(dx)<20&&Math.abs(dy)<20)dir=direction(e.target);if(dir){e.preventDefault();lastTouch=Date.now();show(index+dir);}},{passive:false});
book.addEventListener('touchmove',function(e){if(!mobile||!start||e.touches.length!==1)return;var dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)&&e.cancelable)e.preventDefault();},{passive:false});
book.addEventListener('touchcancel',function(){start=null;});
book.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.read-again')){e.preventDefault();if(Date.now()-lastTouch<=650)return;restart();return;}if(e.target.closest&&(e.target.closest('.reader-close')||e.target.closest('.admin-login')))return;var dir=direction(e.target);if(mobile||!dir)return;e.preventDefault();if(Date.now()-lastTouch>650)show(index+dir);});
book.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&direction(e.target)){e.preventDefault();show(index+direction(e.target));}});
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}});
function refitMobile(){
  if(!mobile||busy)return;
  pages.forEach(function(p){
    if(p.classList.contains('title-page')||p.classList.contains('cover-plate')||p.classList.contains('facsimile')||p.classList.contains('end-page'))return;
    var section=p.querySelector('section'),body=p.querySelector('p'),img=p.querySelector('img');
    if(!section||!body)return;
    var was=p.classList.contains('current');
    p.classList.add('current');
    p.style.visibility='hidden';
    var imgH=img&&img.getBoundingClientRect().height||0;
    if(imgH>40)section.style.maxHeight=Math.max(120,Math.floor(book.clientHeight-imgH-20))+'px';
    var size=parseFloat(getComputedStyle(body).fontSize);
    while(section.scrollHeight>section.clientHeight+1&&size>14){size-=.5;body.style.fontSize=size+'px';}
    if(!was)p.classList.remove('current');
    p.style.visibility='';
  });
}
function watchImages(){
  var pending=[].slice.call(book.querySelectorAll('img')).filter(function(img){return!img.complete;});
  if(!pending.length){refitMobile();return;}
  var left=pending.length,done=false;
  function tick(){if(done||--left>0)return;done=true;refitMobile();}
  pending.forEach(function(img){img.addEventListener('load',tick);img.addEventListener('error',tick);});
}
rebuild();
watchImages();
var hint=document.getElementById('hint');setTimeout(function(){if(hint)hint.remove()},3000);
var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){rebuild();watchImages();},200)});
})();
