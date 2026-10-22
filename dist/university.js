/* All original university facts, grouped into an inline, keyboard-accessible atlas. */
window.MGTU_renderUniversity = function(facts) {
 const host=document.querySelector('#universityAtlas');if(!host)return;
 const esc=MGTU_escape;
 const text=i=>String(facts[i]||'').replace(/учавствуют/g,'участвуют').replace(/учёным степенями/g,'учёными степенями').replace('4388 место','4388 мест').replace('техобсуживания','техобслуживания').replace('г.Майкопе','г. Майкопе').replace('Автошкола ,','Автошкола,').replace('материально- технической','материально-технической');
 const metric=(i,kind='')=>{
  const source=text(i),m=source.match(/^(?:Более |Всего )?(\d+(?:[ \u00a0]\d{3})*(?:[.,]\d+)?)(%)?(?:\s+(тысяч))?\s*(.*)$/i);
  if(i===34){const country=source.match(/^Иностранные студенты из (\d+) (.+)$/);if(country)return `<article class="atlas-tile atlas-metric atlas-countries" data-fact-source="34"><strong><span class="atlas-number-value">${esc(country[1])}</span></strong><p>${esc(country[2])} представлены иностранными студентами</p></article>`;}
  if(!m)return `<article class="atlas-tile atlas-copy ${kind}" data-fact-source="${i}"><p>${esc(source)}</p></article>`;
  const more=/^Более /.test(source)||/^и более /.test(m[4].trim()),percent=!!m[2],description=m[4].trim().replace(/^и более /,''),number=m[3]?String(Number(m[1].replace(/\s/g,''))*1000):m[1],value=number.replace(/\B(?=(\d{3})+(?!\d))/g,' ')+(percent?'%':'');
  return `<article class="atlas-tile atlas-metric ${kind}" data-fact-source="${i}"><strong><span class="atlas-number-value">${esc(value)}</span>${more&&!percent?'<span class="atlas-plus">+</span>':''}</strong><p>${esc(description)}</p></article>`;
 };
 const bundle=(title,indices,kind='')=>`<article class="atlas-tile atlas-bundle ${kind}" data-fact-source="${indices.join(',')}"><h3>${esc(title)}</h3><ul>${indices.map(i=>`<li>${esc(text(i).replace(/^•\s*/,''))}</li>`).join('')}</ul></article>`;
 const places=()=>{
  const t=text(0),m=t.match(/4388.*1679.*2709/);
  return m?`<article class="atlas-tile atlas-places" data-fact-source="0"><span class="atlas-kicker">ПРИЁМ · 2026</span><strong>4 388</strong><p>мест для поступающих</p><div class="atlas-place-split"><span><b>1 679</b> бюджетных</span><span><b>2 709</b> по договору</span></div></article>`:metric(0,'atlas-places');
 };
 const levels=`<article class="atlas-tile atlas-levels" data-fact-source="20,21,22,23,24"><h3>${esc(text(20).replace(/:$/,''))}</h3><ol>${[21,22,23,24].map(i=>`<li>${esc(text(i).replace(/^•\s*/,''))}</li>`).join('')}</ol></article>`;
 const groups=[
  {id:'education',label:'Образование',title:'От первого интереса — к профессии',html:places()+metric(10,'atlas-blue')+metric(3,'atlas-lavender')+levels+bundle('Университет в разных форматах',[4,6,8])+metric(27,'atlas-extra')},
  {id:'science',label:'Наука',title:'Есть где пробовать и открывать',html:metric(12,'atlas-blue')+metric(25,'atlas-lavender')+metric(26)+metric(28,'atlas-wide atlas-investment')+bundle('Исследовательская среда',[7,9,13])},
  {id:'campus',label:'Кампус',title:'Всё для учёбы и жизни рядом',html:metric(11,'atlas-blue')+metric(14,'atlas-lavender')+bundle('За пределами Майкопа',[5])+`<article class="atlas-tile atlas-sports atlas-wide" data-fact-source="16,17,18,19"><h3>Движение — часть жизни</h3><div>${[16,17,18,19].map(i=>{const m=text(i).match(/^(\d+)\s+(.*)/);return `<p><strong>${esc(m?.[1]||'')}</strong><span>${esc(m?.[2]||text(i))}</span></p>`;}).join('')}</div></article>`+bundle('Больше практики',[15])},
  {id:'community',label:'Студенческая жизнь',title:'Твои люди. Твоя поддержка.',html:metric(1,'atlas-blue')+metric(2,'atlas-lavender')+metric(31)+metric(29,'atlas-support atlas-wide')+metric(30)},
  {id:'world',label:'Карьера и мир',title:'Возможности за пределами аудитории',html:metric(32,'atlas-blue')+metric(33,'atlas-lavender')+metric(34)+metric(35,'atlas-wide')+metric(36)}
 ];
 if(facts.length>37)groups[0].html+=bundle('Ещё возможности',Array.from({length:facts.length-37},(_,i)=>37+i));
 const active=host.querySelector('[role="tab"][aria-selected="true"]')?.dataset.atlasTab||'education';
 host.innerHTML=`<div class="atlas-tabs" role="tablist" aria-label="Возможности МГТУ">${groups.map(g=>`<button role="tab" id="atlas-tab-${g.id}" aria-controls="atlas-panel-${g.id}" aria-selected="${g.id===active}" tabindex="${g.id===active?0:-1}" data-atlas-tab="${g.id}">${esc(g.label)}</button>`).join('')}</div>${groups.map(g=>`<div class="atlas-panel" role="tabpanel" id="atlas-panel-${g.id}" aria-labelledby="atlas-tab-${g.id}" ${g.id!==active?'hidden':''} tabindex="0"><div class="atlas-panel-title"><h3>${esc(g.title)}</h3></div><div class="atlas-grid atlas-${g.id}">${g.html}</div></div>`).join('')}`;
 function choose(id,focus=false){host.querySelectorAll('[role="tab"]').forEach(b=>{const selected=b.dataset.atlasTab===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;if(selected&&focus)b.focus();});host.querySelectorAll('[role="tabpanel"]').forEach(p=>p.hidden=p.id!=='atlas-panel-'+id);}
 host.onclick=e=>{const b=e.target.closest('[data-atlas-tab]');if(b)choose(b.dataset.atlasTab);};
 host.onkeydown=e=>{const b=e.target.closest('[data-atlas-tab]');if(!b||!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const idx=groups.findIndex(g=>g.id===b.dataset.atlasTab),next=e.key==='Home'?0:e.key==='End'?groups.length-1:(idx+(e.key==='ArrowRight'?1:-1)+groups.length)%groups.length;choose(groups[next].id,true);};
};
