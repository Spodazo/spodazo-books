(function(){
'use strict';
var book=document.querySelector('main'),originals=Array.prototype.slice.call(book.querySelectorAll('.page')).map(function(p){return p.cloneNode(true)}),pages=[],index=0,busy=false,start=null,lastTouch=0,pendingN=null,pendingAfter=null,wantRestart=false,curlHold=true;
var count=document.getElementById('count'),mobile=false;
function fitBoxFont(el){
  if(!el||el.clientHeight<8)return;
  if(!el.getAttribute('data-base-size'))el.setAttribute('data-base-size',getComputedStyle(el).fontSize);
  el.style.setProperty('font-size',el.getAttribute('data-base-size'),'important');
  var size=parseFloat(getComputedStyle(el).fontSize),min=Math.max(8,size*0.45),n=0,paras,i;
  while((el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)&&size>min&&n<40){
    size=Math.round(size*0.94*10)/10;
    el.style.setProperty('font-size',size+'px','important');
    paras=el.querySelectorAll('p');
    for(i=0;i<paras.length;i++)paras[i].style.setProperty('font-size',size+'px','important');
    n++;
  }
}
function fitPageText(root){
  var nodes=(root||book).querySelectorAll('.el-text, .cover-bit-text'),i;
  for(i=0;i<nodes.length;i++)fitBoxFont(nodes[i]);
}
function status(){pages.forEach(function(p,i){p.classList.toggle('current',i===index);p.setAttribute('aria-hidden',i!==index);});document.documentElement.classList.toggle('closed-book',!mobile&&!!(pages[index]&&pages[index].classList.contains('front-cover')));count.textContent='Page '+(index+1)+' of '+pages.length;updateCurl();}
function isPicturePage(p){
  return !!(p&&!p.classList.contains('title-page')&&!p.classList.contains('end-page')&&!p.classList.contains('cover-page')&&p.querySelector('img'));
}
function curlFrame(){
  var page=pages[index],img,r,leaf;
  if(page&&page.classList.contains('front-cover')){
    leaf=page.querySelector('.front-cover-leaf');
    if(leaf)return leaf;
  }
  if(mobile&&page&&!page.classList.contains('title-page')&&!page.classList.contains('end-page')){
    img=page.querySelector('.el-image[data-size="main"]')||page.querySelector('img');
    if(!img)return null;
    r=img.getBoundingClientRect();
    if(r.width>80&&r.height>80)return img;
    return null;
  }
  return book;
}
function readCurlBox(){
  var frame=curlFrame();
  if(!frame)return null;
  var r=frame.getBoundingClientRect();
  var bookR=book.getBoundingClientRect();
  if(r.width<80||r.height<80)return null;
  return {
    top:Math.max(r.top,bookR.top),
    left:Math.max(r.left,bookR.left),
    width:Math.max(0,Math.min(r.right,bookR.right)-Math.max(r.left,bookR.left)),
    height:Math.max(0,Math.min(r.bottom,bookR.bottom)-Math.max(r.top,bookR.top)),
    radius:getComputedStyle(frame).borderTopRightRadius||getComputedStyle(book).borderRadius||'12px'
  };
}
function applyCurlBox(wrap,box){
  if(!wrap||!box||!book)return;
  var size=Math.round(Math.max(mobile?60:48,Math.min(120,book.getBoundingClientRect().width*(mobile?0.18:0.10))));
  wrap.style.position='fixed';
  wrap.style.top=box.top+'px';
  wrap.style.left=box.left+'px';
  wrap.style.width=box.width+'px';
  wrap.style.height=box.height+'px';
  wrap.style.right='auto';
  wrap.style.bottom='auto';
  wrap.style.borderRadius=box.radius;
  wrap.style.setProperty('--curl-w',size+'px');
  wrap.style.setProperty('--curl-top','0px');
  wrap.style.setProperty('--curl-peek-right','0px');
  wrap.style.setProperty('--curl-flap-right','1px');
  wrap.style.setProperty('--curl-flap-top','0px');
  wrap.style.setProperty('--curl-radius',box.radius);
}
function pinCurl(wrap){
  applyCurlBox(wrap,readCurlBox());
}
function hideCurl(){
  var wrap=document.querySelector('.page-curl');
  if(wrap)wrap.hidden=true;
}
function plantCurl(at,under){
  var wrap=document.querySelector('.page-curl');
  if(!wrap)return;
  if(curlHold){wrap.hidden=true;return;}
  if(at==null)at=index;
  var next=pages[at+1];
  var box=readCurlBox();
  if(!box||box.width<80||box.height<80){wrap.hidden=true;return;}
  var peekFrom=next?peekPage(at)||next:null;
  applyCurlBox(wrap,box);
  fillPeek(wrap.querySelector('.page-curl-peek'),!!next?peekFrom:null);
  wrap.style.zIndex=under?'3':'';
  wrap.hidden=!next;
}
function pageImg(p){
  return p&&(p.querySelector(':scope > img')||p.querySelector('img'));
}
function pageColor(p){
  if(!p)return'';
  var root=getComputedStyle(document.documentElement);
  if(p.classList.contains('title-page')||p.classList.contains('end-page')||p.classList.contains('cover-plate')||p.classList.contains('cover-page'))
    return (root.getPropertyValue('--title-bg')||'').trim()||'#f0dfb3';
  return (root.getPropertyValue('--page-paper')||'').trim()||'#efdda6';
}
function peekPage(at){
  var next=pages[at+1];
  if(!next)return next;
  var cur=pages[at]||pages[index];
  var curSrc=(pageImg(cur)&&(pageImg(cur).currentSrc||pageImg(cur).src))||'';
  var i=at+1;
  while(i<pages.length){
    var p=pages[i];
    if(p.classList.contains('title-page')||p.classList.contains('end-page')||p.classList.contains('cover-page'))return p;
    var img=pageImg(p),src=img&&(img.currentSrc||img.src)||'';
    if(src&&src!==curSrc)return p;
    i++;
  }
  return next;
}
function fillPeek(peek,next){
  peek.replaceChildren();
  peek.style.background=pageColor(next);
  if(!next||!isPicturePage(next))return;
  var img=next.querySelector('img');
  var src=img&&(img.currentSrc||img.src);
  if(!src)return;
  var peekImg=document.createElement('img');
  peekImg.className='page-curl-peek-img';
  peekImg.src=src;
  peekImg.alt='';
  peek.appendChild(peekImg);
}
function updateCurl(at){
  plantCurl(at==null?index:at);
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
function splitStory(p,template,i){
  if(!mobile||p.classList.contains('facsimile')||p.classList.contains('title-page')||p.classList.contains('front-cover')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('end-page'))return;
  var keep=p.classList.contains('current');
  p.classList.add('current');
  p.style.visibility='hidden';
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
  if(!keep)p.classList.remove('current');
  p.style.visibility=keep?'':'';
}
function shrinkStory(p){
  if(p.classList.contains('title-page')||p.classList.contains('front-cover')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('facsimile')||p.classList.contains('end-page'))return;
  var section=p.querySelector('section'),body=p.querySelector('p');
  if(!section||!body)return;
  var keep=p.classList.contains('current');
  p.classList.add('current');
  if(!keep)p.style.visibility='hidden';
  var size=parseFloat(getComputedStyle(body).fontSize);
  var floor=mobile?14:15;
  while(section.scrollHeight>section.clientHeight+1&&size>floor){size-=.5;body.style.fontSize=size+'px';}
  if(!keep)p.classList.remove('current');
  if(!keep)p.style.visibility='';
}
function rebuild(){
  if(busy)return;
  var source=pages[index]?pages[index].getAttribute('data-source'):null;
  mobile=matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1100px)').matches&&matchMedia('(orientation: portrait)').matches;
  document.documentElement.classList.toggle('mobile',mobile);
  var first=!pages.length;
  if(first){
    pages=Array.prototype.slice.call(book.querySelectorAll('.page'));
    pages.forEach(function(p,i){if(!p.getAttribute('data-source'))p.setAttribute('data-source',String(i));});
  }else{
    book.innerHTML='';
    pages=[];
    originals.forEach(function(template,i){
      var p=template.cloneNode(true);
      p.setAttribute('data-source',String(i));
      p.className=template.className.replace(/\bcurrent\b/g,'').trim();
      book.appendChild(p);
      pages.push(p);
    });
  }
  pages.slice().forEach(function(p,i){
    var src=Number(p.getAttribute('data-source'));
    var template=originals[isNaN(src)?i:src]||originals[i];
    if(template)splitStory(p,template,isNaN(src)?i:src);
  });
  pages.forEach(shrinkStory);
  if(source){
    index=Math.max(0,pages.findIndex(function(p){return p.getAttribute('data-source')===source;}));
    if(index<0)index=0;
  }else{
    index=0;
  }
  fitPageText(pages[index]);
  status();
  if(first)openFade();
}
function copyFit(fromEl,toEl){
  if(!fromEl||!toEl)return;
  var cs=getComputedStyle(fromEl);
  var fs=fromEl.style.fontSize||cs.fontSize;
  var lh=fromEl.style.lineHeight||cs.lineHeight;
  var mb=fromEl.style.marginBottom||cs.marginBottom;
  if(fs)toEl.style.setProperty('font-size',fs,'important');
  if(lh)toEl.style.setProperty('line-height',lh,'important');
  if(mb)toEl.style.setProperty('margin-bottom',mb,'important');
}
function copy(p,full){
  var c=p.cloneNode(true);
  c.classList.remove('current');
  if(full)c.classList.add('current','fade-page');
  else c.classList.add('leaf-copy');
  c.setAttribute('aria-hidden','true');
  c.style.visibility='';
  var from=p.querySelectorAll('.el-text'),to=c.querySelectorAll('.el-text'),i,j,fromP,paras;
  for(i=0;i<from.length&&i<to.length;i++){
    copyFit(from[i],to[i]);
    fromP=from[i].querySelectorAll('p');
    paras=to[i].querySelectorAll('p');
    for(j=0;j<fromP.length&&j<paras.length;j++)copyFit(fromP[j],paras[j]);
  }
  fromP=p.querySelectorAll('section p, p');
  paras=c.querySelectorAll('section p, p');
  for(j=0;j<fromP.length&&j<paras.length;j++)copyFit(fromP[j],paras[j]);
  return c;
}
function paperSheet(){var sheet=document.createElement('div');sheet.className='leaf-sheet';return sheet;}
function face(className,page){var el=document.createElement('div');el.className=className;el.appendChild(paperSheet());el.appendChild(copy(page));return el;}
function pose(deg){
  var t=Math.abs(Math.sin(deg*Math.PI/180));
  var s=1/(1+0.2*t);
  return 'perspective(3600px) rotateY('+deg+'deg) scaleY('+s+')';
}
function specialPage(p){return p.classList.contains('cover-plate');}
function releaseFlip(layer,after){
  if(!busy)return;
  var dest=pages[index];
  var back=layer.classList.contains('flip-back');
  var under=layer.querySelector(back?'.right-half':'.left-half');
  if(under&&dest){
    under.replaceChildren(copy(dest));
    void under.offsetWidth;
  }
  var turning=layer.querySelector('.leaf')||layer.querySelector('.mobile-leaf');
  if(turning){
    turning.style.transition='none';
    turning.style.visibility='hidden';
  }
  document.documentElement.classList.remove('opening');
  pages.forEach(function(p){p.style.visibility='';});
  status();
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      if(layer.parentNode)layer.remove();
      busy=false;
      if(wantRestart){wantRestart=false;restart();return;}
      if(after)after();
      else if(pendingN!=null){
        var n=pendingN,fn=pendingAfter;
        pendingN=null;
        pendingAfter=null;
        show(n,null,fn);
      }
    });
  });
}
function showBack(face,page,side){
  if(!face)return;
  face.classList.remove('leaf-front');
  face.classList.add('leaf-unflip');
  if(side==='right')face.classList.add('leaf-unflip-right');
  face.replaceChildren(paperSheet(),copy(page));
  face.style.transform='scaleX(-1)';
}
function animateLeaf(leaf,done,ms,onMid,back){
  var dur=ms||1200;
  leaf.style.transition='none';
  leaf.style.transform=pose(0);
  void leaf.offsetWidth;
  var timer,mid;
  function finish(){if(leaf._done)return;leaf._done=true;clearTimeout(timer);clearTimeout(mid);done();}
  leaf.addEventListener('transitionend',function(e){if(e.target===leaf&&e.propertyName==='transform')finish();});
  leaf.style.transition='transform '+dur+'ms linear';
  leaf.style.transform=pose(back?180:-180);
  if(onMid)mid=setTimeout(function(){if(!leaf._done)onMid();},Math.round(dur*0.5));
  timer=setTimeout(finish,dur+40);
}
function openUnderCover(old,next,done){
  var layer=document.createElement('div');
  layer.className='flip-layer fade-layer cover-open';
  layer.setAttribute('aria-hidden','true');
  layer.style.width=book.clientWidth+'px';
  layer.style.height=book.clientHeight+'px';
  var top=document.createElement('div');
  top.className='cover-open-top';
  top.appendChild(copy(old,true));
  layer.appendChild(top);
  book.appendChild(layer);
  next.style.transition='none';
  next.style.clipPath='inset(0 25% 0 25%)';
  next.style.visibility='';
  old.style.visibility='hidden';
  void next.offsetWidth;
  next.style.transition='clip-path 1.6s cubic-bezier(.22,.6,.2,1)';
  next.style.clipPath='inset(0 0 0 0)';
  curlHold=false;
  plantCurl(index,true);
  var timer=setTimeout(function(){top.classList.add('away');},900);
  var end=setTimeout(finish,1850);
  function finish(){
    if(layer._done)return;
    layer._done=true;
    clearTimeout(timer);
    clearTimeout(end);
    next.style.transition='none';
    next.style.clipPath='';
    var wrap=document.querySelector('.page-curl');
    if(wrap)wrap.style.zIndex='';
    done(layer);
  }
}
function closeOntoCover(old,next,done){
  document.documentElement.classList.add('closed-book');
  var layer=document.createElement('div');
  layer.className='flip-layer fade-layer cover-open';
  layer.setAttribute('aria-hidden','true');
  layer.style.width=book.clientWidth+'px';
  layer.style.height=book.clientHeight+'px';
  var top=document.createElement('div');
  top.className='cover-open-top away';
  top.appendChild(copy(next,true));
  layer.appendChild(top);
  book.appendChild(layer);
  next.style.visibility='hidden';
  old.style.transition='none';
  old.style.clipPath='inset(0 0 0 0)';
  void old.offsetWidth;
  old.style.transition='clip-path 1.6s cubic-bezier(.22,.6,.2,1)';
  old.style.clipPath='inset(0 25% 0 25%)';
  top.classList.remove('away');
  var end=setTimeout(finish,1850);
  function finish(){
    if(layer._done)return;
    layer._done=true;
    clearTimeout(end);
    old.style.visibility='hidden';
    old.style.transition='none';
    old.style.clipPath='';
    done(layer);
  }
}
function leaveLibrary(e){
  var a=e.target.closest&&e.target.closest('a.reader-close');
  if(!a)return false;
  e.preventDefault();
  var href=a.getAttribute('href')||'/';
  var topWin=window.top||window;
  try{
    var url=new URL(href,topWin.location.href);
    topWin.history.pushState(null,'',url.pathname+url.search+url.hash);
  }catch(err){
    topWin.location.href=href;
  }
  return true;
}
function show(n,ms,after){
  if(n<0)return;
  if(n>=pages.length)n=0;
  if(n===index&&!busy)return;
  if(busy){
    pendingN=n;
    pendingAfter=after||null;
    return;
  }
  if(n===index)return;
  var from=index,old=pages[from],next=pages[n],back=n<from;
  if(!old||!next)return;
  if(specialPage(old)||specialPage(next)){
    index=n;
    status();
    if(after)after();
    return;
  }
  busy=true;
  hideCurl();
  index=n;
  next.classList.add('current');
  next.style.visibility='hidden';
  void next.offsetHeight;
  if(!alreadyFit(next))fitLaidOut(next);
  fitPageText(next);
  next.style.visibility='hidden';
  void next.offsetHeight;
  var layer=document.createElement('div');
  layer.setAttribute('aria-hidden','true');
  layer.style.width=book.clientWidth+'px';
  layer.style.height=book.clientHeight+'px';
  function done(){releaseFlip(layer,after);}
  if(!mobile&&old.classList.contains('front-cover')&&!back){openUnderCover(old,next,function(coverLayer){releaseFlip(coverLayer,after);});return;}
  if(!mobile&&next.classList.contains('front-cover')&&back){closeOntoCover(old,next,function(coverLayer){releaseFlip(coverLayer,after);});return;}
  if(mobile){
    layer.className='flip-layer mobile-flip'+(back?' flip-back':'');
    var under=document.createElement('div');under.className='mobile-under';
    under.appendChild(paperSheet());under.appendChild(copy(next));layer.appendChild(under);
    var mleaf=document.createElement('div');mleaf.className='mobile-leaf'+(back?' leaf-back-turn':'');
    var mface=face('mobile-leaf-face',old);
    mleaf.appendChild(mface);
    layer.appendChild(mleaf);
    book.appendChild(layer);
    old.style.visibility='hidden';
    plantCurl(index);
    animateLeaf(mleaf,done,ms,function(){showBack(mface,next);},back);
    return;
  }
  layer.className='flip-layer'+(back?' flip-back':'');
  var underLeft=document.createElement('div'),underRight=document.createElement('div');
  underLeft.className='fixed-half left-half';underRight.className='fixed-half right-half';
  underLeft.appendChild(copy(back?next:old));
  underRight.appendChild(copy(back?old:next));
  layer.appendChild(underLeft);layer.appendChild(underRight);
  var leaf=document.createElement('div');leaf.className=back?'leaf leaf-back-turn':'leaf';
  var front=face(back?'leaf-face':'leaf-face leaf-front',old);
  leaf.appendChild(front);
  layer.appendChild(leaf);
  book.appendChild(layer);
  old.style.visibility='hidden';
  plantCurl(index);
  animateLeaf(leaf,done,ms,function(){
    showBack(front,next,back?'right':null);
  },back);
}
function playFade(dest,from){
  if(!dest)return;
  busy=true;
  hideCurl();
  document.documentElement.classList.toggle('closed-book',!mobile&&dest.classList.contains('front-cover'));
  dest.classList.add('current');
  dest.style.visibility='hidden';
  void dest.offsetHeight;
  if(!alreadyFit(dest))fitLaidOut(dest);
  fitPageText(dest);
  dest.style.visibility='hidden';
  var layer=document.createElement('div');
  layer.className='flip-layer fade-layer'+(!mobile&&dest.classList.contains('front-cover')?' fade-cover':'');
  layer.setAttribute('aria-hidden','true');
  layer.style.width=book.clientWidth+'px';
  layer.style.height=book.clientHeight+'px';
  var incoming=document.createElement('div');incoming.className='fade-to';
  incoming.appendChild(copy(dest,true));
  layer.appendChild(incoming);
  var outgoing=null;
  if(from){
    outgoing=document.createElement('div');outgoing.className='fade-from';
    outgoing.appendChild(copy(from,true));
    layer.appendChild(outgoing);
  }else{
    incoming.style.opacity='0';
  }
  book.appendChild(layer);
  if(from)from.style.visibility='hidden';
  curlHold=false;
  plantCurl(index);
  void incoming.offsetWidth;
  function done(){if(layer._done)return;layer._done=true;releaseFlip(layer);}
  if(outgoing){
    outgoing.addEventListener('transitionend',function(e){if(e.target===outgoing&&e.propertyName==='opacity')done();});
    outgoing.style.opacity='0';
  }else{
    incoming.style.transition='opacity 1.8s ease';
    incoming.addEventListener('transitionend',function(e){if(e.target===incoming&&e.propertyName==='opacity')done();});
    incoming.style.opacity='1';
  }
  setTimeout(done,1900);
}
function openFade(){
  if(!book.hasAttribute('data-fade-open')||busy)return;
  var dest=pages[index]||pages[0];
  if(!dest){document.documentElement.classList.remove('opening');return;}
  busy=true;
  var started=false;
  function start(){
    if(started)return;
    started=true;
    playFade(dest,null);
  }
  function afterFonts(){
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(start);
    else start();
  }
  var imgs=[].slice.call(dest.querySelectorAll('img')).filter(function(img){return img.getAttribute('src')&&!img.complete;});
  var left=imgs.length;
  if(!left)afterFonts();
  else imgs.forEach(function(img){
    function one(){if(--left<=0)afterFonts();}
    img.addEventListener('load',one);
    img.addEventListener('error',one);
  });
  setTimeout(start,80);
}
function restart(){
  if(index<=0)return;
  if(busy){wantRestart=true;return;}
  var old=pages[index],dest=pages[0];
  if(!old||!dest)return;
  index=0;
  playFade(dest,old);
}
function go(dir){
  if(!dir)return;
  show(index+dir);
}
function direction(target){var z=target.closest('[data-dir]');return z?Number(z.getAttribute('data-dir')):0;}
book.addEventListener('touchstart',function(e){if(e.touches.length!==1){start=null;return;}start={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
book.addEventListener('touchend',function(e){if(e.target.closest&&(e.target.closest('.admin-login')||e.target.closest('.reader-close'))){start=null;return;}if(e.target.closest&&e.target.closest('.read-again')){e.preventDefault();start=null;lastTouch=Date.now();restart();return;}if(!start)return;var t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;var dir=0;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)dir=dx<0?1:-1;else if(!mobile&&Math.abs(dx)<20&&Math.abs(dy)<20)dir=direction(e.target);if(dir){e.preventDefault();lastTouch=Date.now();go(dir);}},{passive:false});
book.addEventListener('touchmove',function(e){if(!mobile||!start||e.touches.length!==1)return;var dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)&&e.cancelable)e.preventDefault();},{passive:false});
book.addEventListener('touchcancel',function(){start=null;});
book.addEventListener('click',function(e){if(leaveLibrary(e))return;if(e.target.closest&&e.target.closest('.read-again')){e.preventDefault();if(Date.now()-lastTouch<=650)return;restart();return;}if(e.target.closest&&e.target.closest('.admin-login'))return;var dir=direction(e.target);if(mobile||!dir)return;e.preventDefault();if(Date.now()-lastTouch>650)go(dir);});
book.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&direction(e.target)){e.preventDefault();go(direction(e.target));}});
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(e.key==='ArrowRight'?1:-1);}});
function applyLineHeight(nodes,lh){
  var i;
  for(i=0;i<nodes.length;i++)nodes[i].style.lineHeight=String(lh);
}
function shortSpread(){
  return !mobile&&matchMedia('(orientation: landscape) and (max-height: 700px)').matches;
}
function storyPage(p){
  return !!(p&&!p.classList.contains('title-page')&&!p.classList.contains('front-cover')&&!p.classList.contains('cover-plate')&&!p.classList.contains('cover-page')&&!p.classList.contains('facsimile')&&!p.classList.contains('end-page'));
}
function contentHeight(box){
  var h=0,kids=box.children,i,el,cs;
  for(i=0;i<kids.length;i++){
    el=kids[i];
    if(el.classList&&el.classList.contains('text-frame'))continue;
    cs=getComputedStyle(el);
    h+=el.offsetHeight+(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0);
  }
  return h;
}
function fitTextBox(p,box){
  var paras=box.querySelectorAll('p');
  if(!paras.length)return;
  var nodes=[box],i,lh=1.25,gap=shortSpread()?1.2:1.6,size,cs,pad,img,imgH,available,inner,room,floor;
  for(i=0;i<paras.length;i++){
    nodes.push(paras[i]);
    paras[i].style.marginBottom='';
    paras[i].style.removeProperty('font-size');
    paras[i].style.flexShrink='0';
  }
  box.style.removeProperty('font-size');
  applyLineHeight(nodes,lh);
  function applyGaps(){
    for(i=0;i<paras.length-1;i++)paras[i].style.marginBottom=gap+'lh';
  }
  function overflowing(){
    inner=box.clientHeight;
    cs=getComputedStyle(p);
    pad=(parseFloat(getComputedStyle(box).paddingTop)||0)+(parseFloat(getComputedStyle(box).paddingBottom)||0);
    img=p.querySelector('.el-image[data-size="main"]');
    imgH=img?img.offsetHeight:0;
    available=Math.max(0,p.clientHeight-imgH-((parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0)));
    if(inner<8)inner=available;
    else if(mobile&&available>8)inner=Math.min(inner,available);
    room=Math.max(0,inner-pad);
    return contentHeight(box)>room+1||box.scrollHeight>box.clientHeight+1;
  }
  applyGaps();
  while(overflowing()&&lh>1.1){
    lh=Math.round((lh-0.05)*100)/100;
    applyLineHeight(nodes,lh);
  }
  while(overflowing()&&gap>1){
    gap=Math.round((gap-0.25)*100)/100;
    applyGaps();
  }
  while(overflowing()&&lh>0.95){
    lh=Math.round((lh-0.05)*100)/100;
    applyLineHeight(nodes,lh);
  }
  while(overflowing()&&gap>0.5){
    gap=Math.round((gap-0.25)*100)/100;
    applyGaps();
  }
  while(overflowing()&&lh>0.85){
    lh=Math.round((lh-0.05)*100)/100;
    applyLineHeight(nodes,lh);
  }
  while(shortSpread()&&overflowing()&&lh>0.8){
    lh=Math.round((lh-0.05)*100)/100;
    applyLineHeight(nodes,lh);
  }
  if(overflowing()){
    size=parseFloat(getComputedStyle(box).fontSize)||16;
    floor=shortSpread()?10:12;
    while(overflowing()&&size>floor){
      size-=0.5;
      box.style.setProperty('font-size',size+'px','important');
      for(i=0;i<paras.length;i++)paras[i].style.setProperty('font-size',size+'px','important');
    }
  }
}
function alreadyFit(p){
  if(!storyPage(p))return true;
  var box=p.querySelector('.el-text p')||p.querySelector('p');
  return !!(box&&(box.style.lineHeight||box.style.fontSize||(p.querySelector('.el-text')||{}).style.fontSize));
}
function fitLaidOut(p){
  if(!storyPage(p))return false;
  var boxes=p.querySelectorAll('.el-text');
  if(!boxes.length)return false;
  var was=p.classList.contains('current');
  var vis=p.style.visibility;
  p.classList.add('current');
  p.style.visibility='hidden';
  void p.offsetHeight;
  var i;
  for(i=0;i<boxes.length;i++)fitTextBox(p,boxes[i]);
  if(!was)p.classList.remove('current');
  p.style.visibility=vis;
  return true;
}
function refitPages(){
  pages.forEach(function(p){
    if(fitLaidOut(p))return;
    if(!storyPage(p))return;
    var section=p.querySelector('section'),body=p.querySelector('p');
    if(!section||!body)return;
    var was=p.classList.contains('current');
    var vis=p.style.visibility;
    p.classList.add('current');
    p.style.visibility='hidden';
    var lh=parseFloat(getComputedStyle(body).lineHeight)/parseFloat(getComputedStyle(body).fontSize)||1.25;
    while(section.scrollHeight>section.clientHeight+1&&lh>0.85){lh=Math.round((lh-0.04)*100)/100;body.style.lineHeight=String(lh);}
    if(!was)p.classList.remove('current');
    p.style.visibility=vis;
  });
  if(busy)return;
  pages.forEach(function(p){p.style.visibility='';});
  status();
}
function watchImages(){
  var pending=[].slice.call(book.querySelectorAll('img')).filter(function(img){return!img.complete;});
  if(!pending.length){refitPages();return;}
  var left=pending.length,done=false;
  function tick(){if(done||--left>0)return;done=true;refitPages();}
  pending.forEach(function(img){img.addEventListener('load',tick);img.addEventListener('error',tick);});
  setTimeout(function(){if(done)return;done=true;refitPages();},800);
}
function bootPages(){
  watchImages();
}
rebuild();
bootPages();
requestAnimationFrame(function(){requestAnimationFrame(function(){curlHold=false;if(!busy)updateCurl();});});
var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(busy)return;rebuild();bootPages();},200)});
})();
