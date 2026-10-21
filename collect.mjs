import fs from 'node:fs/promises';
const base = 'https://2504.mkgtu.ru/';
const raw = await fs.readFile(new URL('./source-original.html',import.meta.url),'utf8');
const html = raw.replace(/<!--[\s\S]*?-->/g,'');
const clean = s => s.replace(/<br\s*\/?\s*>/gi,' · ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const programs=[];
let level='Бакалавриат', faculty='';
for (const match of html.matchAll(/id="(pills-home|pills-profile|pills-contact)"|<a role="button"[^>]*>([\s\S]*?)<\/a>|<button[^>]*class="[^"]*show_modal[^"]*"[^>]*data-target="#([^"]+)"[^>]*>(.*?)<\/button>/g)) {
  if(match[1]) level=({'pills-home':'Бакалавриат','pills-profile':'Специалитет','pills-contact':'Магистратура'})[match[1]];
  if(match[2]) faculty=clean(match[2]);
  if(match[3]) programs.push({id:match[3],name:clean(match[4]),faculty,level});
}
for(let offset=0;offset<programs.length;offset+=6) {
 await Promise.all(programs.slice(offset,offset+6).map(async p=>{
  try {
   const res=await fetch(base+'index.php',{method:'POST',body:new URLSearchParams({ajdes:'show_modal',id:p.id})});
   const detail=await res.json();
   p.image=new URL(detail.body.match(/<img[^>]+src="([^"]+)/)?.[1]||'',base).href;
   const hrefs=[...detail.body.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1],base).href);
   p.document=hrefs.find(x=>/\.pdf/.test(x))||base;
   p.cost=hrefs.find(x=>/paid_edu/.test(x))||'https://mkgtu.ru/sveden/paid_edu/';
   const image=await fetch(p.image); if(!image.ok) throw Error('image '+image.status);
   const imageFile='assets/program-'+p.id+'.jpg';
   await fs.writeFile(new URL('./dist/'+imageFile,import.meta.url),Buffer.from(await image.arrayBuffer()));
   p.image=imageFile;
  } catch(err) { p.error=String(err); }
 }));
}
const about=html.slice(html.indexOf('<a id="about"'),html.indexOf('<a id="special"'));
const facts=[...about.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m=>clean(m[1]));
await fs.writeFile(new URL('./dist/data.json',import.meta.url),JSON.stringify({programs,facts},null,2));
console.log(JSON.stringify({programs:programs.length,levels:[...new Set(programs.map(p=>p.level))],facts:facts.length,errors:programs.filter(p=>p.error)},null,2));
