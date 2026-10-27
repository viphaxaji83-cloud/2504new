(() => {
 'use strict';
 const esc=MGTU_escape,$=s=>document.querySelector(s);
 let api,catalog=[],selection={block:'hero',field:'title'},picking=true,timer;
 const read=(object,path)=>path?.split('.').reduce((v,k)=>v?.[k],object);
 const set=(object,path,value)=>{const keys=path.split('.');let node=object;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=value;};
 const post=data=>$('#sitePreview')?.contentWindow?.postMessage(data,location.origin);
 const selected=()=>catalog.find(b=>b.id===selection.block)||catalog.find(b=>b.id==='hero');
 const fieldPatch=()=>`blocks.${selection.block}.elements.${selection.field}`;
 function allBlocks(){
  const present=new Set(catalog.map(b=>b.id)),template=catalog.find(b=>b.id==='program-template');
  const programs=(api?.getPrograms()||[]).filter(p=>!present.has('program-'+p.id)).map(p=>({id:'program-'+p.id,label:p.name+' · '+p.level,group:'Направления · '+p.level,selector:'.program-card[data-program-id="'+p.id+'"]',programId:p.id,style:template?.style||{},fields:[{id:'title',label:'Название направления',path:'programs.'+p.id+'.name',type:'text',text:p.name,style:template?.fields.find(e=>e.id==='title')?.style||{}},{id:'faculty',label:'Название факультета',path:'programs.'+p.id+'.faculty',type:'text',text:p.faculty,style:template?.fields.find(e=>e.id==='faculty')?.style||{}},...(template?.fields.filter(e=>!['title','faculty'].includes(e.id))||[])]}));
  return [...catalog,...programs];
 }
 function select(block,field='block'){
  const item=allBlocks().find(b=>b.id===block);if(!item)return;
  selection={block,field:item.fields.some(e=>e.id===field)?field:'block'};
  if(item.programId)post({type:'mgtu-editor-show-program',programId:item.programId});
  api.render();post({type:'mgtu-editor-select',selection});
 }
 function rgb(value){if(/^#[\da-f]{6}$/i.test(value||''))return value;const values=String(value).match(/\d+/g);return values?.length>=3?'#'+values.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#0b2a4a';}
 function input(label,key,value='',hint='',type='text',placeholder=''){
  return `<label>${esc(label)}<input type="${type}" data-field="${key}" value="${esc(value??'')}" placeholder="${esc(placeholder)}">${hint?`<small>${esc(hint)}</small>`:''}</label>`;
 }
 function number(label,key,value,placeholder,min,max,step=1){return `<label>${esc(label)}<input type="number" min="${min}" max="${max}" step="${step}" data-field="${key}" value="${esc(value??'')}" placeholder="${esc(placeholder||'По макету')}"><small>Пустое поле — исходное значение.</small></label>`;}
 function color(label,key,value,baseline){return `<label>${esc(label)}<span class="color-row"><input type="color" data-color="${key}" value="${rgb(value||baseline)}" aria-label="${esc(label)}: выбор цвета"><input data-field="${key}" value="${esc(value||'')}" placeholder="${rgb(baseline)}" pattern="#[0-9a-fA-F]{6}" maxlength="7" aria-label="${esc(label)}: HEX"></span><small>Пустое поле — цвет по макету.</small></label>`;}
 function choice(label,key,value,options){return `<label>${esc(label)}<select data-field="${key}"><option value="">Как в макете</option>${options.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
 function typography(prefix,style={},baseline={},image=false){
  const s=prefix+'.style.';
  if(image)return choice('Как заполнить рамку',s+'objectFit',style.objectFit,[['cover','Заполнить с обрезкой'],['contain','Показать целиком']])+number('Скругление, px',s+'borderRadius',style.borderRadius,baseline.borderRadius,0,100);
  return choice('Шрифт',s+'fontFamily',style.fontFamily,MGTU_EDITOR_FONTS.map(n=>[n,n]))+
   `<div class="settings-grid">${number('Размер на компьютере, px',s+'fontSize',style.fontSize,baseline.fontSize,8,180)}${number('Размер на телефоне, px',s+'mobileFontSize',style.mobileFontSize,'Автоматически',8,100)}</div>`+
   choice('Начертание',s+'fontWeight',style.fontWeight,[['400','Обычное · 400'],['500','Среднее · 500'],['600','Полужирное · 600'],['700','Жирное · 700'],['800','Очень жирное · 800']])+
   color('Цвет текста',s+'color',style.color,baseline.color)+
   choice('Выравнивание текста',s+'textAlign',style.textAlign,[['left','По левому краю'],['center','По центру'],['right','По правому краю']])+
   `<div class="settings-grid">${number('Межстрочный интервал',s+'lineHeight',style.lineHeight,'Например, 1.3',.8,3,.05)}${number('Расстояние между буквами, px',s+'letterSpacing',style.letterSpacing,baseline.letterSpacing,-8,20,.1)}</div>`+
   color('Цвет фона',s+'backgroundColor',style.backgroundColor,baseline.backgroundColor)+
   `<div class="settings-grid">${number('Внутренний отступ, px',s+'padding',style.padding,'По макету',0,160)}${number('Скругление, px',s+'borderRadius',style.borderRadius,baseline.borderRadius,0,100)}</div>`;
 }
 window.MGTU_editor={
  init(options){
   api=options;
   window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==$('#sitePreview').contentWindow)return;
    if(e.data?.type==='mgtu-editor-catalog'){
     catalog=e.data.catalog;api.renderPage();post({type:'mgtu-editor-picking',enabled:picking});
    }
    if(e.data?.type==='mgtu-editor-selection'){selection=e.data.selection;api.openPage();}
   });
   $('#sitePreview').addEventListener('load',()=>{this.preview();post({type:'mgtu-editor-catalog'});post({type:'mgtu-editor-picking',enabled:picking});});
   $('#editorPanel').addEventListener('change',e=>{
    if(e.target.id==='blockSelect')select(e.target.value);
    if(e.target.id==='elementSelect')select(selection.block,e.target.value);
    if(e.target.id==='blockVisible'){
     const b=selected(),path=b.section?'sections.'+b.section:'blocks.'+b.id+'.hidden';set(api.getDraft(),path,b.section?e.target.checked:!e.target.checked);api.dirty();this.preview();
    }
   });
   $('#editorPanel').addEventListener('input',e=>{
    if(!e.target.matches('[data-field],[data-color]'))return;
    clearTimeout(timer);timer=setTimeout(()=>this.preview(),160);
   });
   $('#editorPanel').addEventListener('click',e=>{
    const reset=e.target.closest('[data-reset-style]');if(reset){set(api.getDraft(),reset.dataset.resetStyle,{});api.dirty();api.render();this.preview();}
    const program=e.target.closest('[data-edit-program-content]');if(program)api.openProgram(program.dataset.editProgramContent);
   });
   $('#pickElement').addEventListener('click',()=>{picking=!picking;$('#pickElement').setAttribute('aria-pressed',String(picking));$('#pickElement').textContent=picking?'Выбор на странице включён':'Выбрать элемент на странице';post({type:'mgtu-editor-picking',enabled:picking});});
   this.preview();post({type:'mgtu-editor-catalog'});post({type:'mgtu-editor-picking',enabled:picking});
  },
  preview(){if(!api)return;post({type:'mgtu-editor-draft',content:api.getDraft()});post({type:'mgtu-editor-select',selection});},
  saved(){this.preview();},
  render(){
   if(!catalog.length)return '<div class="editor-card"><h2>Загружаем блоки страницы</h2><p>Сейчас появятся названия блоков и их настройки.</p></div>';
   const restricted=window.MGTU_currentUser?.role!=='admin';
   const draft=api.getDraft(),available=allBlocks().map(b=>restricted?{...b,fields:b.fields.filter(f=>!['style','linkOnly'].includes(f.type))}:b).filter(b=>b.fields.length),block=available.find(b=>b.id===selection.block)||available.find(b=>b.id==='hero');selection.block=block.id;if(restricted&&!block.fields.some(f=>f.id===selection.field))selection.field=block.fields[0].id;
   const field=block.fields.find(f=>f.id===selection.field),patch=draft.blocks?.[block.id]||{},element=patch.elements?.[field?.id]||{},prefix=field?fieldPatch():'blocks.'+block.id;
   const order=['Верх страницы','Об университете','Об университете · Образование','Об университете · Наука','Об университете · Кампус','Об университете · Студенческая жизнь','Об университете · Карьера и мир','Знакомство','Направления','Направления · Бакалавриат','Направления · Специалитет','Направления · Магистратура','Памятки','Вопросы','Низ страницы'];const groups=[...new Set(available.map(b=>b.group))].sort((a,b)=>order.indexOf(a)-order.indexOf(b));$('#selectionContext').textContent='Выбрано: '+block.label+' / '+(field?.label||'весь блок');
   const controls=`<div class="block-picker"><label>Блок страницы<select id="blockSelect">${groups.map(g=>`<optgroup label="${esc(g)}">${available.filter(b=>b.group===g).map(b=>`<option value="${b.id}" ${b.id===block.id?'selected':''}>${esc(b.label)}</option>`).join('')}</optgroup>`).join('')}</select></label><label>Что редактируем<select id="elementSelect">${restricted?'':`<option value="block" ${!field?'selected':''}>Весь блок · фон, отступы, видимость</option>`}${block.fields.map(f=>`<option value="${f.id}" ${f.id===field?.id?'selected':''}>${esc(f.label)}</option>`).join('')}</select></label><p>Или нажмите нужный элемент в предпросмотре справа. Синяя рамка показывает выбранный элемент.</p></div>`;
   let body='';
   if(field){
    const key=field.path||prefix+'.text',text=read(draft,key)??field.text;
    body+=`<div class="selected-element"><span>${esc(block.group)}</span><h2>${esc(field.label)}</h2><p>${esc(block.label)}</p></div><div class="editor-fields element-content">`;
    if(field.type==='image')body+=(restricted?'':input('Файл или URL фотографии',prefix+'.src',element.src??field.src,'Можно указать assets/имя-файла.jpg или https://…'))+input('Описание фотографии для доступности',prefix+'.alt',element.alt??field.alt);
    else if(field.type==='placeholder')body+=input('Текст подсказки',prefix+'.placeholder',element.placeholder??field.placeholder);
    else if(!['style','linkOnly'].includes(field.type))body+=`<label>${field.type==='ticker'?'Фразы · одна на строку':'Текст выбранного элемента'}<textarea data-field="${key}" rows="${field.type==='ticker'?6:3}">${esc(text)}</textarea><small>${field.type==='ticker'?'Обе копии бегущей строки обновляются вместе.':'Переносы строк сохраняются.'}</small></label>`;
    if(!restricted&&['link','linkOnly'].includes(field.type)&&field.href)body+=input('Куда ведёт ссылка',prefix+'.href',element.href??field.href,'Адрес https://… или якорь #programs. Кнопки регистрации сохраняют своё действие.');
    if(field.type==='style')body+='<p class="setting-hint">Оформление применяется ко всем карточкам. Содержание каждой программы доступно в разделе «Направления».</p>';
    body+='</div>';if(!restricted)body+='<details class="element-appearance" open><summary>Оформление: '+esc(field.label)+'</summary><div class="editor-fields">'+typography(prefix,element.style,field.style,field.type==='image')+`<button type="button" class="admin-row-button" data-reset-style="${prefix}.style">Сбросить оформление элемента</button></div></details>`;
   }else{
    const visible=block.section?draft.sections[block.section]!==false:!patch.hidden;
    body=`<div class="selected-element"><span>${esc(block.group)}</span><h2>${esc(block.label)}</h2><p>Эти настройки относятся к контейнеру всего блока. Чтобы изменить текст, выберите элемент выше.</p></div><div class="editor-fields"><label class="toggle-field">Показывать блок<input type="checkbox" id="blockVisible" ${visible?'checked':''}></label>${color('Фон всего блока',prefix+'.style.backgroundColor',patch.style?.backgroundColor,block.style.backgroundColor)}<div class="settings-grid">${number('Внутренний отступ, px',prefix+'.style.padding',patch.style?.padding,'По макету',0,160)}${number('Скругление, px',prefix+'.style.borderRadius',patch.style?.borderRadius,block.style.borderRadius,0,100)}</div><button class="admin-row-button" data-reset-style="${prefix}.style">Сбросить оформление блока</button></div>`;
   }
   if(block.programId)body+=`<div class="editor-fields"><button class="admin-row-button" data-edit-program-content="${block.programId}">Условия приёма и данные направления</button></div>`;
   return controls+'<div class="block-settings">'+body+'</div><p class="save-note">Предпросмотр меняется сразу. «Сохранить на сайте» публикует правки для всех посетителей.</p>';
  },
  showProgram(id){select('program-'+id,'title');}
 };
})();
