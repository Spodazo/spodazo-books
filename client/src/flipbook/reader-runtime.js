(function(){
'use strict';
var book=document.querySelector('main'),originals=Array.prototype.slice.call(book.querySelectorAll('.page')).map(function(p){return p.cloneNode(true)}),pages=[],index=0,busy=false,start=null,lastTouch=0;
var count=document.getElementById('count'),mobile=false;
function status(){pages.forEach(function(p,i){p.classList.toggle('current',i===index);p.setAttribute('aria-hidden',i!==index);});count.textContent='Page '+(index+1)+' of '+pages.length;}
function rebuild(){if(busy)return;var source=pages[index]?pages[index].getAttribute('data-source'):'0';mobile=matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1100px)').matches;document.documentElement.classList.toggle('mobile',mobile);book.innerHTML='';pages=[];
originals.forEach(function(template,i){var p=template.cloneNode(true);p.setAttribute('data-source',String(i));p.className=template.className.replace(/\bcurrent\b/g,'').trim();book.appendChild(p);pages.push(p);
if(mobile&&!p.classList.contains('facsimile')){
p.classList.add('current');p.style.visibility='hidden';
var box=p.querySelector('section'),text=p.querySelector('p');
if(box.getBoundingClientRect().height>book.clientHeight*.32){
 var paragraphs=text.innerHTML.split(/<br\s*\/?>(?:\s*)/i),first=paragraphs.shift()||'';
 text.innerHTML=first;box.style.maxHeight=Math.floor(book.clientHeight*.36)+'px';
 function takeFit(article,html){
  var section=article.querySelector('section'),body=article.querySelector('p');
  var tokens=html.split(/(\s+|<br>)/).filter(Boolean),low=0,high=tokens.length;
  while(low<high){var mid=Math.ceil((low+high)/2);body.innerHTML=tokens.slice(0,mid).join('');if(section.scrollHeight<=section.clientHeight+1)low=mid;else high=mid-1;}
  var count=Math.max(1,low);body.innerHTML=tokens.slice(0,count).join('');return tokens.slice(count).join('').replace(/^(\s|<br>)+/,'');
 }
 var leftover=takeFit(p,first);var rest=(leftover?[leftover]:[]).concat(paragraphs).join('<br>');
 // Every continuation is measured before display; long text gets further screens.
 while(rest){var extra=template.cloneNode(true);extra.className='page continuation current';extra.style.visibility='hidden';extra.setAttribute('data-source',String(i));extra.querySelector('h1').textContent='Continued';book.appendChild(extra);rest=takeFit(extra,rest);extra.classList.remove('current');extra.style.visibility='';pages.push(extra);}
}
p.classList.remove('current');p.style.visibility='';}

});if(mobile){pages.forEach(function(p){p.classList.add('current');p.style.visibility='hidden';var section=p.querySelector('section'),body=p.querySelector('p');if(!section||!body){p.classList.remove('current');p.style.visibility='';return;}var size=parseFloat(getComputedStyle(body).fontSize);while(section.scrollHeight>section.clientHeight+1&&size>16){size-=.5;body.style.fontSize=size+'px';}p.classList.remove('current');p.style.visibility='';});}index=Math.max(0,pages.findIndex(function(p){return p.getAttribute('data-source')===source}));status();}
function copy(p){var c=p.cloneNode(true);c.classList.remove('current');c.classList.add('leaf-copy');c.setAttribute('aria-hidden','true');return c;}
function show(n){if(busy||n<0)return;if(n>=pages.length)n=0;if(n===index)return;busy=true;var forward=n>index,old=pages[index],next=pages[n],layer=document.createElement('div');layer.className='flip-layer';layer.setAttribute('aria-hidden','true');
var underLeft=document.createElement('div'),underRight=document.createElement('div');underLeft.className='fixed-half left-half';underRight.className='fixed-half right-half';underLeft.appendChild(copy(forward?old:next));underRight.appendChild(copy(forward?next:old));layer.appendChild(underLeft);layer.appendChild(underRight);
var leaf=document.createElement('div');leaf.className='leaf';var front=document.createElement('div'),back=document.createElement('div');front.className='leaf-face leaf-front';back.className='leaf-face leaf-back';front.appendChild(copy(forward?old:next));back.appendChild(copy(forward?next:old));leaf.appendChild(front);leaf.appendChild(back);layer.appendChild(leaf);book.appendChild(layer);
leaf.style.transform=forward?'rotateY(0deg)':'rotateY(-180deg)';var done=false,timer;function finish(){if(done)return;done=true;clearTimeout(timer);index=n;status();layer.remove();busy=false;}
leaf.addEventListener('transitionend',function(e){if(e.target===leaf&&e.propertyName==='transform')finish();});
requestAnimationFrame(function(){requestAnimationFrame(function(){leaf.style.transition='transform 1800ms cubic-bezier(.3,.05,.2,1)';leaf.style.transform=forward?'rotateY(-180deg)':'rotateY(0deg)';timer=setTimeout(finish,2050);});});
}
function direction(target){var z=target.closest('[data-dir]');return z?Number(z.getAttribute('data-dir')):0;}
book.addEventListener('touchstart',function(e){if(e.touches.length!==1){start=null;return;}start={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
book.addEventListener('touchend',function(e){if(!start)return;var t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;var dir=0;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)dir=dx<0?1:-1;else if(!mobile&&Math.abs(dx)<20&&Math.abs(dy)<20)dir=direction(e.target);if(dir){e.preventDefault();lastTouch=Date.now();show(index+dir);}},{passive:false});
book.addEventListener('touchmove',function(e){if(!mobile||!start||e.touches.length!==1)return;var dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)&&e.cancelable)e.preventDefault();},{passive:false});
book.addEventListener('touchcancel',function(){start=null;});
book.addEventListener('click',function(e){var dir=direction(e.target);if(mobile||!dir)return;e.preventDefault();if(Date.now()-lastTouch>650)show(index+dir);});
book.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&direction(e.target)){e.preventDefault();show(index+direction(e.target));}});
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(index+(e.key==='ArrowRight'?1:-1));}});
rebuild();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(rebuild);
var hint=document.getElementById('hint');setTimeout(function(){if(hint)hint.remove()},3000);
var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(rebuild,200)});
})();
