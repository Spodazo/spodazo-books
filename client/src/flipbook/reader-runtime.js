(function(){
'use strict';
var book=document.querySelector('main'),originals=Array.prototype.slice.call(book.querySelectorAll('.page')).map(function(p){return p.cloneNode(true)}),pages=[],index=0,busy=false,start=null,lastTouch=0,pendingN=null,pendingAfter=null,wantRestart=false;
var count=document.getElementById('count'),mobile=false;
function status(){pages.forEach(function(p,i){p.classList.toggle('current',i===index);p.setAttribute('aria-hidden',i!==index);});count.textContent='Page '+(index+1)+' of '+pages.length;updateCurl();}
function isPicturePage(p){
  return !!(p&&!p.classList.contains('title-page')&&!p.classList.contains('end-page')&&!p.classList.contains('cover-page')&&p.querySelector('img'));
}
function curlFrame(){
  var page=pages[index],img,r;
  if(mobile&&page&&!page.classList.contains('title-page')&&!page.classList.contains('end-page')){
    img=page.querySelector('.el-image[data-size="main"]')||page.querySelector('img');
    if(img){
      r=img.getBoundingClientRect();
      if(r.width>80&&r.height>80)return img;
    }
  }
  return book;
}
function pinCurl(wrap){
  if(!wrap||!book)return;
  var frame=curlFrame();
  var r=frame.getBoundingClientRect();
  var bookR=book.getBoundingClientRect();
  if(r.width<80||r.height<80){frame=book;r=bookR;}
  var top=Math.max(r.top,bookR.top);
  var left=Math.max(r.left,bookR.left);
  var right=Math.min(r.right,bookR.right);
  var bottom=Math.min(r.bottom,bookR.bottom);
  var width=Math.max(0,right-left);
  var height=Math.max(0,bottom-top);
  var radius=getComputedStyle(frame).borderTopRightRadius||getComputedStyle(book).borderRadius||'12px';
  var sizeBase=bookR.width;
  var size=Math.round(Math.max(mobile?60:48,Math.min(120,sizeBase*(mobile?0.18:0.10))));
  wrap.style.position='fixed';
  wrap.style.top=top+'px';
  wrap.style.left=left+'px';
  wrap.style.width=width+'px';
  wrap.style.height=height+'px';
  wrap.style.right='auto';
  wrap.style.bottom='auto';
  wrap.style.borderRadius=radius;
  wrap.style.setProperty('--curl-w',size+'px');
  wrap.style.setProperty('--curl-top','0px');
  wrap.style.setProperty('--curl-peek-right','0px');
  wrap.style.setProperty('--curl-flap-right','1px');
  wrap.style.setProperty('--curl-flap-top','0px');
  wrap.style.setProperty('--curl-radius',radius);
}
function keepCurl(){
  updateCurl(index);
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
  var wrap=document.querySelector('.page-curl');
  if(!wrap)return;
  if(at==null)at=index;
  var next=pages[at+1];
  var peekFrom=next?peekPage(at)||next:null;
  var show=!!next;
  pinCurl(wrap);
  fillPeek(wrap.querySelector('.page-curl-peek'),show?peekFrom:null);
  wrap.hidden=!show;
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
  if(!mobile||p.classList.contains('facsimile')||p.classList.contains('title-page')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('end-page'))return;
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
  if(p.classList.contains('title-page')||p.classList.contains('cover-plate')||p.classList.contains('cover-page')||p.classList.contains('facsimile')||p.classList.contains('end-page'))return;
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
  status();
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
function copy(p){
  var c=p.cloneNode(true);
  c.classList.remove('current');
  c.classList.add('leaf-copy');
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
  var turning=layer.querySelector('.leaf')||layer.querySelector('.mobile-leaf');
  if(turning){
    turning.style.transition='none';
    turning.style.visibility='hidden';
  }
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
function showBack(face,page){
  if(!face)return;
  face.classList.remove('leaf-front');
  face.classList.add('leaf-unflip');
  face.replaceChildren(paperSheet(),copy(page));
  face.style.transform='scaleX(-1)';
}
function animateLeaf(leaf,done,ms,onMid){
  var dur=ms||1200;
  leaf.style.transition='none';
  leaf.style.transform=pose(0);
  void leaf.offsetWidth;
  var timer,mid;
  function finish(){if(leaf._done)return;leaf._done=true;clearTimeout(timer);clearTimeout(mid);done();}
  leaf.addEventListener('transitionend',function(e){if(e.target===leaf&&e.propertyName==='transform')finish();});
  leaf.style.transition='transform '+dur+'ms linear';
  leaf.style.transform=pose(-180);
  if(onMid)mid=setTimeout(function(){if(!leaf._done)onMid();},Math.round(dur*0.5));
  timer=setTimeout(finish,dur+40);
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
  var old=pages[index],next=pages[n];
  if(!old||!next)return;
  if(specialPage(old)||specialPage(next)){
    index=n;
    status();
    if(after)after();
    return;
  }
  busy=true;
  keepCurl();
  index=n;
  next.classList.add('current');
  next.style.visibility='hidden';
  void next.offsetHeight;
  if(!alreadyFit(next))fitLaidOut(next);
  next.style.visibility='hidden';
  var layer=document.createElement('div');
  layer.setAttribute('aria-hidden','true');
  layer.style.width=book.clientWidth+'px';
  layer.style.height=book.clientHeight+'px';
  function done(){releaseFlip(layer,after);}
  if(mobile){
    layer.className='flip-layer mobile-flip';
    var under=document.createElement('div');under.className='mobile-under';
    under.appendChild(paperSheet());under.appendChild(copy(next));layer.appendChild(under);
    var mleaf=document.createElement('div');mleaf.className='mobile-leaf';
    var mface=face('mobile-leaf-face',old);
    mleaf.appendChild(mface);
    layer.appendChild(mleaf);
    book.appendChild(layer);
    old.style.visibility='hidden';
    animateLeaf(mleaf,done,ms,function(){showBack(mface,next);});
    return;
  }
  layer.className='flip-layer';
  var underLeft=document.createElement('div'),underRight=document.createElement('div');
  underLeft.className='fixed-half left-half';underRight.className='fixed-half right-half';
  underLeft.appendChild(copy(old));
  underRight.appendChild(copy(next));
  layer.appendChild(underLeft);layer.appendChild(underRight);
  var leaf=document.createElement('div');leaf.className='leaf';
  var front=face('leaf-face leaf-front',old);
  leaf.appendChild(front);
  layer.appendChild(leaf);
  book.appendChild(layer);
  old.style.visibility='hidden';
  animateLeaf(leaf,done,ms,function(){
    showBack(front,next);
  });
}
function restart(){
  if(index<=0)return;
  if(busy){wantRestart=true;return;}
  var step=Math.max(45,Math.min(90,Math.round(700/Math.max(1,index))));
  show(index-1,step,function(){if(index>0)restart();});
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
book.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.read-again')){e.preventDefault();if(Date.now()-lastTouch<=650)return;restart();return;}if(e.target.closest&&(e.target.closest('.reader-close')||e.target.closest('.admin-login')))return;var dir=direction(e.target);if(mobile||!dir)return;e.preventDefault();if(Date.now()-lastTouch>650)go(dir);});
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
  return !!(p&&!p.classList.contains('title-page')&&!p.classList.contains('cover-plate')&&!p.classList.contains('cover-page')&&!p.classList.contains('facsimile')&&!p.classList.contains('end-page'));
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
  var nodes=[box],i,lh=1.25,gap=shortSpread()?1.5:2,size,cs,pad,img,imgH,available,inner,room,floor;
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
var hint=document.getElementById('hint');setTimeout(function(){if(hint)hint.remove()},3000);
var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(busy)return;rebuild();bootPages();},200)});
})();
