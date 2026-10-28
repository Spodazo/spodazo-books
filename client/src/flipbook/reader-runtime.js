(function(){
'use strict';
var book=document.querySelector('main'),originals=Array.prototype.slice.call(book.querySelectorAll('.page')).map(function(p){return p.cloneNode(true)}),pages=[],index=0,busy=false,start=null,lastTouch=0,pendingN=null,pendingAfter=null,pendingJump=null,wantRestart=false,curlHold=true,readerReadySent=false,initialRevealPending=!book.hasAttribute('data-fade-open'),lastEdgeTap=0,lastEdgeSide=0,edgeTimer=0,zoneTimer=0;
function signalReaderReady(){
  if(readerReadySent)return;
  readerReadySent=true;
  document.documentElement.classList.remove('booting');
  var topWin=window.top||window;
  try{topWin.postMessage({type:'spodazo-reader-ready'},topWin.location.origin);}catch(err){}
}
function whenOpeningPaintReady(cb){
  var dest=pages[index]||pages[0];
  if(!dest){cb();return;}
  function run(){requestAnimationFrame(function(){requestAnimationFrame(cb);});}
  function afterFonts(){
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run);
    else run();
  }
  var imgs=[].slice.call(dest.querySelectorAll('img')).filter(function(img){return img.getAttribute('src')&&!img.complete;});
  var left=imgs.length;
  if(!left)afterFonts();
  else imgs.forEach(function(img){
    function one(){if(--left<=0)afterFonts();}
    img.addEventListener('load',one);
    img.addEventListener('error',one);
  });
  setTimeout(afterFonts,1400);
}
function finishInitialReveal(){
  if(!initialRevealPending)return;
  initialRevealPending=false;
  whenOpeningPaintReady(function(){
    pages.forEach(function(p){p.style.visibility='';});
    status();
    signalReaderReady();
  });
}
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
  var nodes=(root||book).querySelectorAll('.el-text, .cover-bit-text'),i,el,role;
  for(i=0;i<nodes.length;i++){
    el=nodes[i];
    role=el.getAttribute('data-role');
    if(el.closest('.willow-title')&&(role==='author'||role==='date'))continue;
    fitBoxFont(el);
  }
}
function updateArrows(){
  var left=document.getElementById('arrL'),right=document.getElementById('arrR');
  if(left)left.classList.toggle('off',index<=0);
  if(right)right.classList.toggle('off',index>=pages.length-1);
}
function status(){pages.forEach(function(p,i){p.classList.toggle('current',i===index);p.setAttribute('aria-hidden',i!==index);});document.documentElement.classList.toggle('closed-book',!mobile&&!!(pages[index]&&pages[index].classList.contains('front-cover')));count.textContent='Page '+(index+1)+' of '+pages.length;updateCurl();updateArrows();updateWillowSound();}
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
  if(pages[at]&&pages[at].classList.contains('willow-nap-picture')){wrap.hidden=true;return;}
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
  if(!mobile||p.classList.contains('facsimile')||p.classList.contains('title-page')||p.classList.contains('front-cover')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('end-page')||p.classList.contains('nap-spread'))return;
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
function remapWillowLeaf(el, side){
  var x=parseFloat(el.style.left)||0, w=parseFloat(el.style.width)||0;
  if(side==='left'){
    el.style.left=(x*2)+'%';
    el.style.width=(w*2)+'%';
  }else{
    el.style.left=((x-50)*2)+'%';
    el.style.width=(w*2)+'%';
  }
}
function fillWillowPicture(p){
  var img=p.querySelector('.el-image[data-size="main"]');
  p.style.setProperty('padding','0','important');
  if(!img)return;
  img.style.setProperty('position','absolute','important');
  img.style.setProperty('inset','0','important');
  img.style.setProperty('left','0','important');
  img.style.setProperty('top','0','important');
  img.style.setProperty('width','100%','important');
  img.style.setProperty('height','100%','important');
  img.style.setProperty('max-height','none','important');
  img.style.setProperty('margin','0','important');
  img.style.setProperty('border','0','important');
  img.style.setProperty('border-radius','0','important');
  img.style.setProperty('object-fit','cover','important');
  img.style.setProperty('object-position','center center','important');
}
function centerWillowLyrics(p){
  var box=p.querySelector('.el-text');
  if(box){
    box.style.setProperty('position','relative','important');
    box.style.setProperty('top','auto','important');
    box.style.setProperty('left','auto','important');
    box.style.setProperty('width','92%','important');
    box.style.setProperty('height','auto','important');
    box.style.setProperty('flex','0 0 auto','important');
    box.style.setProperty('margin','0 auto','important');
  }
  Array.prototype.forEach.call(p.querySelectorAll('.el-text p'),function(para){
    para.style.setProperty('font-size','clamp(18.72px, 2.592dvh, 23.04px)','important');
  });
}
function splitWillowPortraitLeaves(){
  var i,p,lyrics;
  if(!mobile||!document.documentElement.classList.contains('willow'))return;
  for(i=0;i<pages.length;i++){
    p=pages[i];
    if(p.classList.contains('willow-leaf')||p.classList.contains('title-page')||p.classList.contains('end-page')||p.classList.contains('front-cover'))continue;
    if(p.classList.contains('nap-spread')){
      splitWillowNap(p,i);
      continue;
    }
    if(!p.classList.contains('laid-out'))continue;
    if(!p.querySelector('.el-image[data-leaf="left"][data-size="main"]')||!p.querySelector('.el-text[data-leaf="right"]'))continue;
    lyrics=p.cloneNode(true);
    Array.prototype.slice.call(p.querySelectorAll('[data-leaf="right"]')).forEach(function(el){el.remove();});
    Array.prototype.slice.call(p.querySelectorAll('[data-leaf="left"]')).forEach(function(el){remapWillowLeaf(el,'left');});
    p.classList.add('willow-leaf','willow-picture');
    fillWillowPicture(p);
    Array.prototype.slice.call(lyrics.querySelectorAll('[data-leaf="left"]')).forEach(function(el){el.remove();});
    Array.prototype.slice.call(lyrics.querySelectorAll('[data-leaf="right"]')).forEach(function(el){remapWillowLeaf(el,'right');});
    lyrics.classList.add('willow-leaf','willow-lyrics');
    lyrics.classList.remove('current');
    lyrics.removeAttribute('data-cue');
    centerWillowLyrics(lyrics);
    if(p.nextSibling)book.insertBefore(lyrics,p.nextSibling);
    else book.appendChild(lyrics);
    pages.splice(i+1,0,lyrics);
    i++;
  }
}
function splitWillowNap(p,i){
  var end=document.createElement('article');
  end.className='page willow-leaf willow-the-end';
  end.setAttribute('aria-label','The End');
  if(p.getAttribute('data-source'))end.setAttribute('data-source',p.getAttribute('data-source'));
  if(p.hasAttribute('data-cue')){
    end.setAttribute('data-cue',p.getAttribute('data-cue'));
    p.removeAttribute('data-cue');
  }
  end.innerHTML='<p class="nap-end" style="position:absolute;left:0;right:0;top:50%;width:100%;margin:0;transform:translateY(-50%);text-align:center;">The End</p>';
  var blank=p.querySelector('.nap-leaf-blank');
  if(blank)blank.remove();
  p.classList.add('willow-leaf','willow-nap-picture');
  book.insertBefore(end,p);
  pages.splice(i,0,end);
}
function shrinkStory(p){
  if(p.classList.contains('title-page')||p.classList.contains('front-cover')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('facsimile')||p.classList.contains('end-page')||p.classList.contains('nap-spread'))return;
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
  resetViewZoom();
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
  splitWillowPortraitLeaves();
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
      if(pendingJump!=null){
        var jumpN=pendingJump;
        pendingJump=null;
        jumpTo(jumpN);
        return;
      }
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
var leavePending=false;
function leaveLibrary(e){
  var a=e.target.closest&&e.target.closest('a.reader-close');
  if(!a)return false;
  e.preventDefault();
  if(leavePending)return true;
  leavePending=true;
  var href=a.getAttribute('href')||'/';
  var topWin=window.top||window;
  try{
    topWin.postMessage({type:'spodazo-book-close',href:href},topWin.location.origin);
  }catch(err){
    topWin.location.href=href;
  }
  window.setTimeout(function(){leavePending=false;},1200);
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
  resetViewZoom();
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
  if(!mobile&&old.classList.contains('front-cover')){
    old.style.visibility='hidden';
    document.documentElement.classList.remove('closed-book');
  }
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
  jumpTo(0);
}
function jumpTo(n){
  if(n<0||n>=pages.length)return;
  if(n===index&&!busy)return;
  pendingN=null;
  pendingAfter=null;
  wantRestart=false;
  if(busy){pendingJump=n;return;}
  if(n===index)return;
  resetViewZoom();
  var old=pages[index],dest=pages[n];
  if(!old||!dest)return;
  index=n;
  playFade(dest,old);
}
function goToStart(){jumpTo(0);}
function goToEnd(){jumpTo(pages.length-1);}
function go(dir){
  if(!dir)return;
  show(index+dir);
}
function direction(target){var z=target.closest('[data-dir]');return z?Number(z.getAttribute('data-dir')):0;}
function control(target,name){return !!(target&&target.closest&&target.closest(name));}
var song=null,songMuted=false;
function musicAudible(){
  return !!(song&&!songMuted&&!song.paused&&!song.ended);
}
function syncSingAlong(playing){
  var btns=document.querySelectorAll('.sing-along'),i;
  for(i=0;i<btns.length;i++){
    btns[i].setAttribute('aria-pressed',playing?'true':'false');
    btns[i].classList.toggle('is-playing',playing);
    btns[i].textContent=playing?'Pause':'Sing Along';
  }
  syncWillowSound();
}
function syncWillowSound(){
  var btn=document.getElementById('soundBtn'),audible,label;
  if(!btn)return;
  audible=musicAudible();
  label=audible?'Silence Music':'Start Music';
  btn.textContent=label;
  btn.classList.toggle('is-playing',audible);
  btn.setAttribute('aria-pressed',audible?'true':'false');
  btn.setAttribute('aria-label',label);
}
function placeWillowSound(){
  var btn=document.getElementById('soundBtn'),r,w,h,compact,x,y,sideGap;
  if(!btn||!book)return;
  r=book.getBoundingClientRect();
  w=btn.offsetWidth||106;
  h=btn.offsetHeight||29;
  sideGap=Math.max(10,Math.round(r.width*0.035));
  compact=window.innerWidth>window.innerHeight&&Math.min(window.innerWidth,window.innerHeight)<520;
  if(compact){
    x=window.innerWidth-w-Math.max(12,sideGap);
    y=window.innerHeight/3-h/2;
  }else{
    x=r.left+r.width/2-w/2;
    y=r.top-h-14;
  }
  btn.style.left=Math.round(x)+'px';
  btn.style.top=Math.round(Math.max(0,y))+'px';
}
function updateWillowSound(){
  var btn=document.getElementById('soundBtn'),page,cover,theEnd,show;
  if(!btn)return;
  page=pages[index];
  cover=!page||page.classList.contains('front-cover');
  theEnd=!!(page&&(page.classList.contains('nap-spread')||page.classList.contains('end-page')||page.classList.contains('willow-the-end')||page.classList.contains('willow-nap-picture')));
  show=!cover&&!theEnd;
  btn.hidden=false;
  btn.classList.toggle('is-visible',show);
  btn.setAttribute('aria-hidden',show?'false':'true');
  placeWillowSound();
  syncWillowSound();
}
function songAudio(){
  var btn,src;
  if(song)return song;
  btn=document.querySelector('.sing-along');
  src=btn&&btn.getAttribute('data-audio');
  if(!src)return null;
  song=new Audio(src);
  song.addEventListener('ended',function(){songMuted=false;syncSingAlong(false);followSong();});
  song.addEventListener('play',function(){syncSingAlong(musicAudible());followSong();});
  song.addEventListener('pause',function(){syncSingAlong(false);});
  song.addEventListener('timeupdate',followSong);
  return song;
}
function cueFor(p){
  if(!p)return NaN;
  var raw=p.getAttribute('data-cue');
  if(raw==null||raw==='')return NaN;
  return Number(raw);
}
function pageForSongTime(t){
  var best=-1,bestCue=-1,i,c,lead;
  for(i=0;i<pages.length;i++){
    c=cueFor(pages[i]);
    if(isNaN(c))continue;
    lead=pages[i].classList.contains('end-page')?0:0.4;
    if(t+lead>=c&&c>=bestCue){bestCue=c;best=i;}
  }
  return best;
}
function followSong(){
  var target,t;
  if(!song||busy)return;
  if(song.paused&&!song.ended)return;
  t=song.ended?Infinity:song.currentTime;
  target=pageForSongTime(t);
  if(target<0||target<=index)return;
  if(target===index+1)go(1);
  else jumpTo(target);
}
function toggleSingAlong(){
  var audio=songAudio(),cue;
  if(!audio)return;
  if(musicAudible()){
    songMuted=true;
    audio.muted=true;
    syncSingAlong(false);
    return;
  }
  songMuted=false;
  audio.muted=false;
  cue=cueFor(pages[index]);
  if((audio.ended||audio.currentTime<0.5)&&!isNaN(cue))audio.currentTime=cue;
  if(audio.paused||audio.ended)audio.play().catch(function(){});
  else syncSingAlong(true);
}
var willowSoundBtn=document.getElementById('soundBtn');
if(willowSoundBtn){
  willowSoundBtn.addEventListener('pointerup',function(e){
    e.preventDefault();
    e.stopPropagation();
    toggleSingAlong();
  });
  willowSoundBtn.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
  });
}
function edgeJumpSide(x,width){
  var band=Math.max(56,width*0.18);
  if(x<=band)return -1;
  if(x>=width-band)return 1;
  return 0;
}
var viewScale=1,viewPanX=0,viewPanY=0,pinchRefDist=0,pinchRefScale=1,gesturePinch=false,gesturePan=false,panPending=false,pinchHold=false;
var panStartX=0,panStartY=0,panRefX=0,panRefY=0,zoomTapAt=0,zoomTapX=0,zoomTapY=0;
function clampZoom(n){return Math.max(1,Math.min(4,n));}
function touchDist(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
function applyViewZoom(){
  if(viewScale<=1.001){
    viewScale=1;viewPanX=0;viewPanY=0;gesturePan=false;panPending=false;
    book.style.transform='';
    document.documentElement.classList.remove('reader-zoomed');
    return;
  }
  var extra=viewScale-1,maxX=book.offsetWidth*extra*0.52,maxY=book.offsetHeight*extra*0.52;
  viewPanX=Math.max(-maxX,Math.min(maxX,viewPanX));
  viewPanY=Math.max(-maxY,Math.min(maxY,viewPanY));
  book.style.transform='translate('+viewPanX+'px,'+viewPanY+'px) scale('+viewScale+')';
  document.documentElement.classList.add('reader-zoomed');
}
function resetViewZoom(){
  viewScale=1;viewPanX=0;viewPanY=0;gesturePinch=false;gesturePan=false;panPending=false;pinchHold=false;zoomTapAt=0;
  applyViewZoom();
}
book.addEventListener('touchstart',function(e){
  if(e.touches.length>=2){
    gesturePinch=true;pinchHold=false;panPending=false;gesturePan=false;start=null;
    var a=e.touches[0],b=e.touches[1];
    pinchRefDist=touchDist({x:a.clientX,y:a.clientY},{x:b.clientX,y:b.clientY});
    pinchRefScale=viewScale;
    return;
  }
  if(pinchHold)return;
  if(viewScale>1&&e.touches.length===1){
    start=null;panPending=true;gesturePan=false;
    panStartX=e.touches[0].clientX;panStartY=e.touches[0].clientY;panRefX=viewPanX;panRefY=viewPanY;
    return;
  }
  if(e.touches.length!==1){start=null;return;}
  start={x:e.touches[0].clientX,y:e.touches[0].clientY};
},{passive:true});
book.addEventListener('touchmove',function(e){
  if(gesturePinch&&e.touches.length>=2){
    var a=e.touches[0],b=e.touches[1],d=touchDist({x:a.clientX,y:a.clientY},{x:b.clientX,y:b.clientY});
    if(pinchRefDist>0){viewScale=clampZoom(pinchRefScale*(d/pinchRefDist));applyViewZoom();}
    if(e.cancelable)e.preventDefault();
    return;
  }
  if(panPending&&e.touches.length===1&&viewScale>1){
    var dx=e.touches[0].clientX-panStartX,dy=e.touches[0].clientY-panStartY;
    if(!gesturePan&&Math.sqrt(dx*dx+dy*dy)<12)return;
    gesturePan=true;viewPanX=panRefX+dx;viewPanY=panRefY+dy;applyViewZoom();
    if(e.cancelable)e.preventDefault();
    return;
  }
  if(!mobile||!start||e.touches.length!==1||viewScale>1)return;
  var sx=e.touches[0].clientX-start.x,sy=e.touches[0].clientY-start.y;
  if(Math.abs(sx)>8&&Math.abs(sx)>Math.abs(sy)&&e.cancelable)e.preventDefault();
},{passive:false});
book.addEventListener('touchend',function(e){
  if(e.target.closest&&(e.target.closest('.admin-login')||e.target.closest('.reader-close'))){start=null;panPending=false;return;}
  if(control(e.target,'.sing-along')){e.preventDefault();start=null;panPending=false;lastTouch=Date.now();toggleSingAlong();return;}
  if(control(e.target,'.read-again')){e.preventDefault();start=null;panPending=false;lastTouch=Date.now();restart();return;}
  if(gesturePinch){
    if(e.touches.length<2){
      gesturePinch=false;start=null;panPending=false;
      if(viewScale<=1.05)resetViewZoom();
      else{pinchHold=e.touches.length>0;applyViewZoom();}
      lastTouch=Date.now();
    }
    return;
  }
  if(pinchHold){
    if(!e.touches.length)pinchHold=false;
    start=null;panPending=false;
    return;
  }
  if(viewScale>1&&(panPending||gesturePan)){
    var t=e.changedTouches[0],pdx=t.clientX-panStartX,pdy=t.clientY-panStartY;
    panPending=false;
    if(!gesturePan&&Math.sqrt(pdx*pdx+pdy*pdy)<12){
      var now=Date.now();
      if(now-zoomTapAt<350&&Math.sqrt(Math.pow(t.clientX-zoomTapX,2)+Math.pow(t.clientY-zoomTapY,2))<32){resetViewZoom();lastTouch=now;return;}
      zoomTapAt=now;zoomTapX=t.clientX;zoomTapY=t.clientY;
    }
    gesturePan=false;lastTouch=Date.now();
    if(viewScale<=1.05)resetViewZoom();
    return;
  }
  if(!start||viewScale>1){start=null;lastTouch=Date.now();return;}
  var t2=e.changedTouches[0],dx=t2.clientX-start.x,dy=t2.clientY-start.y;start=null;var dir=0;
  if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4){clearTimeout(edgeTimer);edgeTimer=0;lastEdgeTap=0;lastEdgeSide=0;dir=dx<0?1:-1;}
  else if(!mobile&&Math.abs(dx)<20&&Math.abs(dy)<20)dir=direction(e.target);
  if(dir){e.preventDefault();lastTouch=Date.now();go(dir);return;}
  if(mobile&&Math.abs(dx)<20&&Math.abs(dy)<20){var box=book.getBoundingClientRect();var side=edgeJumpSide(t2.clientX-box.left,box.width);var now2=Date.now();if(side&&side===lastEdgeSide&&now2-lastEdgeTap>0&&now2-lastEdgeTap<=350){clearTimeout(edgeTimer);edgeTimer=0;lastEdgeTap=0;lastEdgeSide=0;e.preventDefault();lastTouch=now2;if(side<0)goToStart();else goToEnd();return;}if(side){lastEdgeTap=now2;lastEdgeSide=side;}}
},{passive:false});
book.addEventListener('touchcancel',function(){start=null;panPending=false;gesturePan=false;if(gesturePinch){gesturePinch=false;if(viewScale<=1.05)resetViewZoom();else applyViewZoom();}});
book.addEventListener('click',function(e){if(leaveLibrary(e))return;if(control(e.target,'.sing-along')){e.preventDefault();if(Date.now()-lastTouch<=650)return;toggleSingAlong();return;}if(control(e.target,'.read-again')){e.preventDefault();if(Date.now()-lastTouch<=650)return;restart();return;}if(e.target.closest&&e.target.closest('.admin-login'))return;if(viewScale>1)return;var dir=direction(e.target);if(mobile||!dir)return;e.preventDefault();if(Date.now()-lastTouch<=650)return;if(e.detail>=2){clearTimeout(zoneTimer);zoneTimer=0;if(dir<0)goToStart();else goToEnd();return;}clearTimeout(zoneTimer);zoneTimer=setTimeout(function(){zoneTimer=0;go(dir);},400);});
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
  return !!(p&&!p.classList.contains('title-page')&&!p.classList.contains('front-cover')&&!p.classList.contains('cover-plate')&&!p.classList.contains('cover-page')&&!p.classList.contains('facsimile')&&!p.classList.contains('end-page')&&!p.classList.contains('nap-spread'));
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
  var fitted=p.querySelector('.el-text');
  return !!(box&&(box.style.lineHeight||box.style.fontSize||(fitted&&fitted.style.fontSize)));
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
  if(!pending.length){refitPages();finishInitialReveal();return;}
  var left=pending.length,done=false;
  function tick(){if(done||--left>0)return;done=true;refitPages();finishInitialReveal();}
  pending.forEach(function(img){img.addEventListener('load',tick);img.addEventListener('error',tick);});
  setTimeout(function(){if(done)return;done=true;refitPages();finishInitialReveal();},800);
}
function bootPages(){
  watchImages();
}
function bindArrow(el,dir){
  if(!el)return;
  var timer=0;
  el.addEventListener('click',function(e){
    e.preventDefault();
    e.stopPropagation();
    if(el.classList.contains('off')||busy)return;
    if(e.detail>=2){
      clearTimeout(timer);
      timer=0;
      if(dir<0)goToStart();
      else goToEnd();
      return;
    }
    clearTimeout(timer);
    timer=setTimeout(function(){
      timer=0;
      if(el.classList.contains('off'))return;
      go(dir);
    },400);
  });
}
bindArrow(document.getElementById('arrL'),-1);
bindArrow(document.getElementById('arrR'),1);
rebuild();
bootPages();
requestAnimationFrame(function(){requestAnimationFrame(function(){curlHold=false;if(!busy)updateCurl();});});
var hint=document.getElementById('hint');setTimeout(function(){if(hint)hint.remove()},3000);
var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(busy)return;rebuild();bootPages();},200)});
})();
