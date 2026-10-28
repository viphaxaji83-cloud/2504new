/* Shared block map: the editor and the page use exactly the same targets. */
(() => {
 'use strict';
 const esc=window.MGTU_escape;
 const field=(id,label,selector,path,type='text')=>({id,label,selector,path,type});
 const f=field;
 const blocks=[
  {id:'header',label:'Шапка и навигация',group:'Верх страницы',selector:'.header',fields:[f('about','Ссылка «Возможности»','nav a:nth-child(1)',null,'link'),f('programs','Ссылка «Направления»','nav a:nth-child(2)',null,'link'),f('faq','Ссылка «Вопросы»','nav a:nth-child(3)',null,'link'),f('register','Кнопка регистрации','.header-actions [data-register]'),f('logo','Логотип','.brand img',null,'image')]},
  {id:'hero',label:'Первый экран',group:'Верх страницы',selector:'.hero',fields:[f('title','Главный заголовок','#heroTitle','title'),f('description','Описание под заголовком','#heroDescription','description'),f('register','Кнопка регистрации','.hero-buttons button'),f('programs','Ссылка на направления','.hero-buttons a',null,'link'),f('date','Дата и время','#eventDate','date'),f('place','Место проведения','#eventPlace','place'),f('caption','Приглашение для близких','.meta-caption'),f('photo','Большая фотография','.photo-main img',null,'image'),f('mini','Маленькая фотография','.photo-mini img',null,'image'),f('photoCaption','Подпись маленькой фотографии','.photo-mini>span'),f('note','Записка рядом с фотографией','.floating-note'),f('coordinate','Подпись внизу композиции','.art-coordinate')]},
  {id:'ticker',label:'Бегущая строка',group:'Верх страницы',selector:'.ticker',fields:[f('phrases','Фразы бегущей строки','.ticker-group',null,'ticker')]},
  {id:'about',label:'Об университете · заголовок',group:'Об университете',selector:'#about',section:'about',fields:[f('title','Заголовок раздела','.section-heading h2','texts.aboutTitle')]},
  {id:'discover',label:'Знакомство · заголовок и кнопка',group:'Знакомство',selector:'#discover',section:'discover',fields:[f('title','Заголовок раздела','.discover-intro h2','texts.discoverTitle'),f('button','Кнопка «Хочу познакомиться»','.discover-intro button')]},
  {id:'discover-people',label:'Карточка «Представь себя здесь»',group:'Знакомство',selector:'.discovery-people',fields:[f('eyebrow','Надпись над заголовком','div>span'),f('title','Заголовок карточки','h3'),f('body','Описание карточки','p'),f('photo','Фотография','img',null,'image')]},
  {id:'discover-choice',label:'Карточка «Найди то, что откликается»',group:'Знакомство',selector:'.discovery-choice',fields:[f('eyebrow','Надпись над заголовком',':scope>span:not(.discovery-mark)'),f('title','Заголовок карточки','h3'),f('body','Описание карточки','p'),f('button','Кнопка перехода','a',null,'link')]},
  {id:'discover-practice',label:'Карточка «Увидь профессию в деле»',group:'Знакомство',selector:'.discovery-practice',fields:[f('eyebrow','Надпись над заголовком','div>span'),f('title','Заголовок карточки','h3'),f('photo','Фотография','img',null,'image')]},
  {id:'programs',label:'Каталог · заголовок и управление',group:'Направления',selector:'#programs',section:'programs',fields:[f('title','Заголовок каталога','h2','texts.programsTitle'),f('search','Подсказка поиска','#programSearch',null,'placeholder'),f('more','Кнопка «Показать ещё»','#showMore')]},
  {id:'program-template',label:'Все карточки направлений · оформление',group:'Направления',selector:'.program-card',template:true,fields:[f('title','Названия направлений','h3',null,'style'),f('faculty','Подписи факультетов','.faculty',null,'style'),f('meta','Уровень и код направления','.program-top>span:first-child',null,'style'),f('hint','Надпись «О направлении»','.card-hint',null,'style'),f('compare','Кнопка сравнения','.compare-toggle',null,'style')]},
  {id:'resources',label:'Памятки · заголовок',group:'Памятки',selector:'#resources',section:'resources',fields:[f('title','Заголовок раздела',':scope>h2','texts.resourcesTitle'),f('spoTitle','Заголовок ссылки для выпускников СПО','.spo-link>span:first-child'),f('spoText','Подпись ссылки для выпускников СПО','.spo-link>span:last-child'),f('spo','Ссылка на подготовку после СПО','.spo-link',null,'linkOnly')]},
  ...['school','college','masters'].map((key,i)=>({id:'guide-'+key,label:['Памятка · после школы','Памятка · колледж','Памятка · магистратура'][i],group:'Памятки',selector:'.guide-'+key,fields:[f('label','Для кого эта памятка','.guide-label'),f('title','Заголовок памятки','h3'),f('body','Описание памятки','p'),f('button','Надпись на кнопке','.guide-card-action'),f('link','Ссылка на PDF',':scope',null,'linkOnly')]})),
  {id:'faq',label:'Вопросы · заголовок',group:'Вопросы',selector:'#faq',section:'faq',fields:[f('title','Заголовок раздела','h2','texts.faqTitle')]},
  ...[1,2,3,4].map(i=>({id:'faq-'+i,label:'Вопрос '+i,group:'Вопросы',selector:'.faq-list>details:nth-child('+i+')',fields:[f('question','Текст вопроса','summary',null,'firstText'),f('answer','Ответ на вопрос','p'),f('action','Дополнительное действие','.text-link',null,'link')]})),
  {id:'final',label:'Финальный экран · приглашение',group:'Низ страницы',selector:'.final-cta',fields:[f('title','Финальный заголовок','h2','texts.finalTitle'),f('button','Кнопка регистрации','button')]},
  ...[1,2,3].map(i=>({id:'final-photo-'+i,label:'Финальная фотография '+i,group:'Низ страницы',selector:'.final-photo:nth-of-type('+i+')',fields:[f('caption','Подпись под фотографией','figcaption'),f('photo','Фотография','img',null,'image')]})),
  {id:'footer',label:'Контакты и подвал',group:'Низ страницы',selector:'#contact',fields:[f('label','Подпись над контактами','.tiny-label'),f('phone','Телефон приёмной комиссии','#contactPhone','phone'),f('email','Электронная почта','#contactEmail','email'),f('site','Ссылка на сайт университета','.footer-links>a:first-child',null,'link'),f('presentation','Ссылка на презентацию факультетов','.footer-links>a:nth-child(2)',null,'link'),f('group','Кнопка группового участия','.footer-links button'),f('copyright','Подпись авторских прав','.footer-bottom>span'),f('logo','Логотип','.brand img',null,'image')]}
 ];
 const fonts=['Steppe','Arial','Verdana','Georgia','Trebuchet MS','Times New Roman'];
 window.MGTU_EDITOR_FONTS=fonts;
 const styleProperties={fontFamily:'font-family',fontSize:'font-size',fontWeight:'font-weight',lineHeight:'line-height',letterSpacing:'letter-spacing',color:'color',textAlign:'text-align',backgroundColor:'background-color',padding:'padding',borderRadius:'border-radius',objectFit:'object-fit'};
 const limits={fontSize:[8,180,'px'],mobileFontSize:[8,100,'px'],lineHeight:[.8,3,''],letterSpacing:[-8,20,'px'],padding:[0,160,'px'],borderRadius:[0,100,'px']};
 const targets=(root,selector)=>selector===':scope'?[root]:[...root.querySelectorAll(selector)];
 const textOf=(node,type)=>type==='firstText'?[...node.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim():type==='ticker'?[...node.querySelectorAll('span')].map(n=>n.textContent).join('\n'):node.innerText?.trim()||node.textContent.trim();
 const snapshot=node=>{const style=getComputedStyle(node);return Object.fromEntries(Object.keys(styleProperties).map(k=>[k,style[k]]));};
 function catalog(doc=document){
  const overrides=doc.querySelector('#blockOverrides'),disabled=overrides?.disabled;if(overrides)overrides.disabled=true;
  const result=blocks.map(b=>({...b,fields:b.fields.map(e=>({...e}))}));
  doc.querySelectorAll('.atlas-panel').forEach(panel=>{
   const id=panel.id.replace('atlas-panel-',''),tab=doc.querySelector('#atlas-tab-'+id),group='Об университете · '+tab.textContent;
   result.push({id:'atlas-'+id,label:'Название вкладки и заголовок',group,selector:'#'+panel.id,tab:id,fields:[f('title','Заголовок вкладки','.atlas-panel-title h3'),{...f('tab','Название кнопки вкладки','#atlas-tab-'+id),global:true}]});
   panel.querySelectorAll('.atlas-tile').forEach((tile,i)=>{
    const source=tile.dataset.factSource,selector='[data-fact-source="'+source+'"]',fields=[];
    const add=(key,label,sel)=>{if(tile.querySelector(sel))fields.push(f(key,label,sel));};
    add('title','Заголовок карточки','h3');add('kicker','Подпись над числом','.atlas-kicker');
    if(tile.querySelector('.atlas-number-value'))add('number','Число / показатель','.atlas-number-value');else add('number','Число / показатель',':scope>strong');
    add('description','Пояснение к показателю',':scope>p');
    tile.querySelectorAll('li').forEach((li,j)=>{if(li.querySelector('b'))return;fields.push(f('item-'+j,'Пункт '+(j+1),'li:nth-child('+(j+1)+')'));});
    tile.querySelectorAll('.atlas-place-split>span').forEach((n,j)=>{fields.push(f('places-'+j,j?'Места по договору':'Бюджетные места','.atlas-place-split>span:nth-child('+(j+1)+')'));});
    tile.querySelectorAll('.atlas-sports p').forEach((n,j)=>{fields.push(f('sport-number-'+j,'Спорт · число '+(j+1),'.atlas-sports p:nth-child('+(j+1)+') strong'));fields.push(f('sport-label-'+j,'Спорт · подпись '+(j+1),'.atlas-sports p:nth-child('+(j+1)+') span'));});
    const title=tile.querySelector('h3,p')?.textContent||tile.textContent;
    result.push({id:'fact-'+source.replaceAll(',','-'),label:'Карточка '+(i+1)+' · '+title.trim().slice(0,65),group,selector,tab:id,fields});
   });
  });
  doc.querySelectorAll('.program-card[data-program-id]').forEach(card=>{
   const id=card.dataset.programId,name=card.querySelector('h3').textContent;
   result.push({id:'program-'+id,label:name+' · '+card.dataset.programLevel,group:'Направления · '+card.dataset.programLevel,selector:'.program-card[data-program-id="'+id+'"]',programId:id,fields:[f('title','Название направления','h3','programs.'+id+'.name'),f('faculty','Название факультета','.faculty','programs.'+id+'.faculty'),f('meta','Уровень и код · оформление','.program-top>span:first-child',null,'style'),f('hint','Надпись «О направлении» · оформление','.card-hint',null,'style'),f('compare','Кнопка сравнения · оформление','.compare-toggle',null,'style')]});
  });
  const entries=result.filter(b=>doc.querySelector(b.selector)).map(b=>{
   const root=doc.querySelector(b.selector);
   return {...b,previewLabel:b.label,style:snapshot(root),fields:b.fields.filter(e=>(e.global?doc:root).querySelector(e.selector)||e.selector===':scope').map(e=>{
    const node=e.selector===':scope'?root:(e.global?doc:root).querySelector(e.selector);
    return {...e,text:textOf(node,e.type),style:snapshot(node),href:node.getAttribute('href')||'',src:node.getAttribute('src')||'',alt:node.getAttribute('alt')||'',placeholder:node.getAttribute('placeholder')||''};
   })};
  });
  if(overrides)overrides.disabled=disabled;
  return entries;
 }
 window.MGTU_blockCatalog=catalog;
 const originals=new WeakMap();
 function remember(node){if(!originals.has(node))originals.set(node,{html:node.innerHTML,attrs:{href:node.getAttribute('href'),src:node.getAttribute('src'),alt:node.getAttribute('alt'),placeholder:node.getAttribute('placeholder')},hidden:node.hidden});return originals.get(node);}
 function safeUrl(value,image=false){return typeof value==='string'&&(/^(https?:\/\/|\/?[a-zA-Z0-9_#?./-])/.test(value))&&!/^(javascript|data|vbscript):/i.test(value)&&(!image||!value.startsWith('#'));}
 function cssValue(key,value){
  if(value===''||value==null)return '';
  if(limits[key]){const [min,max,unit]=limits[key],n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n+unit:'';}
  if(['color','backgroundColor'].includes(key))return /^#[\da-f]{6}$/i.test(value)?value:'';
  if(key==='fontFamily')return fonts.includes(value)?'"'+value+'",sans-serif':'';
  if(key==='fontWeight')return /^(400|500|600|700|800)$/.test(value)?value:'';
  if(key==='textAlign')return /^(left|center|right)$/.test(value)?value:'';
  if(key==='objectFit')return /^(cover|contain)$/.test(value)?value:'';
  return '';
 }
 function styleRules(selector,style={}){
  let rules='',mobile=style.fontSize&&!style.mobileFontSize&&cssValue('fontSize',style.fontSize)?`font-size:min(${cssValue('fontSize',style.fontSize)},8.8vw)!important;`:'';
  for(const [key,value] of Object.entries(style)){const v=cssValue(key,value);if(!v)continue;if(key==='mobileFontSize'){mobile+=`font-size:${v}!important;`;continue;}const prop=styleProperties[key];if(!prop)continue;rules+=`${prop}:${v}!important;`;}
  const childProperties=Object.entries(style).filter(([k])=>['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color'].includes(k)).map(([k,v])=>{const parsed=cssValue(k,v);return parsed?`${styleProperties[k]}:${parsed}!important;`:'';}).join('');
  return (rules?`${selector}{${rules}}`:'')+(childProperties?`${selector} :is(em,span,strong,b,small){${childProperties}}`:'')+(mobile?`@media(max-width:760px){${selector},${selector} :is(em,span,strong,b,small){${mobile}}}`:'');
 }
 window.MGTU_validateBlockSettings=content=>{
  for(const block of Object.values(content.blocks||{}))for(const element of [block,...Object.values(block.elements||{})]){
   for(const key of ['href','src'])if(Object.hasOwn(element,key)&&!safeUrl(element[key],key==='src'))return 'Укажите корректный адрес ссылки или фотографии: https://…, assets/… или #раздел.';
   for(const [key,value] of Object.entries(element.style||{}))if(value!==''&&!cssValue(key,value))return 'Проверьте значения оформления: размер, интервал, цвет или шрифт.';
  }
  return '';
 };
 let currentCatalog=[],selection=null,selecting=false,settings={};
 function send(type,extra={}){if(window.parent!==window)window.parent.postMessage({type,...extra},location.origin);}
 window.MGTU_applyBlocks=function(content){
  settings=content;currentCatalog=catalog();let css='';
  currentCatalog.forEach(block=>{
   const patch=content.blocks?.[block.id]||{},roots=[...document.querySelectorAll(block.selector)];
   if(block.id==='atlas-'+block.tab){const tab=document.querySelector('#atlas-tab-'+block.tab);if(tab)tab.hidden=!!patch.hidden;}
   roots.forEach(root=>{const original=remember(root);root.dataset.editBlock=block.id;if(!block.section){if(Object.hasOwn(patch,'hidden')){root.hidden=patch.hidden;root.dataset.editHiddenOwner=block.id;}else if(root.dataset.editHiddenOwner===block.id){root.hidden=original.hidden;delete root.dataset.editHiddenOwner;}}});
   const rootSelector=block.template?block.selector:`[data-edit-block="${block.id}"][data-edit-block]`;
   css+=styleRules(rootSelector,patch.style);
   block.fields.forEach(field=>{
    const change=patch.elements?.[field.id]||{},nodes=field.global?[...document.querySelectorAll(field.selector)]:roots.flatMap(root=>targets(root,field.selector));
    nodes.forEach(node=>{
     const original=remember(node);node.dataset.editElement=block.id+'--'+field.id;
     if(!field.path&&field.type!=='image'&&field.type!=='linkOnly'&&field.type!=='placeholder'&&field.type!=='style'){
      if(Object.hasOwn(change,'text')){
       if(field.type==='firstText'){const textNodes=[...node.childNodes].filter(n=>n.nodeType===3);textNodes.forEach(n=>n.remove());node.prepend(document.createTextNode(change.text));}
       else if(field.type==='ticker'){const unit=String(change.text).split('\n').filter(x=>x.trim()).map(x=>'<span>'+esc(x)+'</span><i aria-hidden="true">✳</i>').join('');node.innerHTML=unit;const width=Math.max(1,node.getBoundingClientRect().width);node.innerHTML=unit.repeat(Math.max(1,Math.ceil(node.closest('.ticker').clientWidth/width)));}
       else node.innerHTML=esc(change.text).replace(/\n/g,'<br>');
      }else if(node.dataset.editOverridden==='true')node.innerHTML=original.html;
     }
     for(const key of ['href','src','alt','placeholder']){
      if(Object.hasOwn(change,key)){if(['href','src'].includes(key)&&!safeUrl(change[key],key==='src'))continue;node.setAttribute(key,change[key]);}
      else if(node.dataset.editOverridden==='true'){if(original.attrs[key]===null)node.removeAttribute(key);else node.setAttribute(key,original.attrs[key]);}
     }
     node.dataset.editOverridden=String(Object.keys(change).some(k=>k!=='style'));
    });
    css+=styleRules(block.template?`${block.selector} ${field.selector}`:`[data-edit-element="${block.id}--${field.id}"][data-edit-element]`,change.style);
   });
  });
  let style=document.querySelector('#blockOverrides');if(!style){style=document.createElement('style');style.id='blockOverrides';document.head.append(style);}style.textContent=css;
  const active=document.querySelector('[data-atlas-tab][aria-selected="true"]');if(active?.hidden)document.querySelector('[data-atlas-tab]:not([hidden])')?.click();
  if(selection)highlight(false);
 };
 function highlight(scroll=true){
  document.querySelectorAll('[data-editor-selected]').forEach(n=>n.removeAttribute('data-editor-selected'));
  const block=currentCatalog.find(b=>b.id===selection?.block);if(!block)return;
  if(block.tab){const tab=document.querySelector('#atlas-tab-'+block.tab);if(tab?.hidden)return;tab?.click();}
  const root=document.querySelector(block.selector),field=block.fields.find(e=>e.id===selection.field);
  if(root?.tagName==='DETAILS')root.open=true;
  const node=field?(field.global?document:root).querySelector(field.selector===':scope'?block.selector:field.selector):root;
  const target=node||root;if(!target)return;target.setAttribute('data-editor-selected','');
  if(scroll)window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-window.innerHeight*.3),behavior:'instant'});
 }
 if(window.parent!==window&&new URLSearchParams(location.search).has('editor')){
  const style=document.createElement('style');style.textContent='[data-editor-selected]{outline:3px solid #2785ff!important;outline-offset:5px!important}html[data-editor-picking] [data-edit-element]{cursor:crosshair!important}';document.head.append(style);
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==window.parent)return;
   if(e.data?.type==='mgtu-editor-select'){selection=e.data.selection;highlight();}
   if(e.data?.type==='mgtu-editor-picking'){selecting=!!e.data.enabled;document.documentElement.toggleAttribute('data-editor-picking',selecting);}
   if(e.data?.type==='mgtu-editor-catalog')send('mgtu-editor-catalog',{catalog:catalog()});
  });
  document.addEventListener('click',e=>{
   if(!selecting||e.target.closest('[data-atlas-tab],#levelTabs button,#showMore'))return;
   const element=e.target.closest('[data-edit-element]'),root=e.target.closest('[data-edit-block]');if(!element&&!root)return;
   e.preventDefault();e.stopImmediatePropagation();
   const id=element?.dataset.editElement,parts=id?.split('--');selection={block:parts?.[0]||root.dataset.editBlock,field:parts?.[1]||'block'};
   highlight(false);send('mgtu-editor-selection',{selection});
  },true);
  window.addEventListener('mgtu-page-ready',()=>send('mgtu-editor-catalog',{catalog:catalog()}));
 }
})();
