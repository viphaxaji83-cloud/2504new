import {defaults} from './store.mjs';
import {fail} from './policy.mjs';

export const SOURCE='https://abit.mkgtu.ru';
const levels={'Бакалавриат':'bak','Специалитет':'spec','Магистратура':'mag'};
const routes={bak:'bachelor',spec:'specialist',mag:'master'};
export const lockedProgramPath=path=>/^programs\.[^.]+\.(admission(?:\.|$)|document$|cost$|admissionSource(?:\.|$))/.test(path);
const clean=value=>typeof value==='string'?value.trim().slice(0,10000):'';
const safeLink=value=>{try{const url=new URL(value,SOURCE);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};

// Read only serialized JSON in the server-rendered catalogue. Never execute scripts from the source.
export function parseCatalogue(html) {
 const chunks=[...html.matchAll(/\.rsc\.push\(("(?:[^"\\]|\\.)*")\)/g)].map(m=>JSON.parse(m[1]));
 const candidates=[];
 const visit=value=>{
  if(!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&Array.isArray(value.programs)&&value.programs.length>30&&value.programs.every(p=>p&&typeof p.id==='string'&&typeof p.code==='string'))candidates.push(value.programs);
  for(const child of Object.values(value))visit(child);
 };
 for(const chunk of chunks){const match=/^[a-f\d]+:([\[{][\s\S]*)\n?$/.exec(chunk);if(match){try{visit(JSON.parse(match[1]));}catch{}}}
 if(candidates.length!==1)throw Error('SOURCE_SCHEMA_CHANGED');
 return candidates[0];
}
export function mapCatalogue(rows, local=defaults.programs) {
 const result={};let matched=0;
 for(const [id,p]of Object.entries(local)){
  const level=levels[p.level];
  const matches=rows.filter(row=>row.level===level&&row.code===p.admission.code&&row.id.startsWith(level+'_'));
  if(matches.length>1)throw Error('AMBIGUOUS_PROGRAM');
  const a={code:p.admission.code,year:'',profile:'',status:'',headers:[],rows:[],ege:'',spo:'',entrance:'',duration:'',notes:''};
  if(!matches.length){a.status='Актуальные условия приёма не найдены в источнике.';result[id]={admission:a,document:SOURCE+'/programs',cost:SOURCE+'/programs',admissionSource:{url:SOURCE+'/programs',found:false}};continue;}
  const s=matches[0];matched++;
  if(typeof s.active!=='boolean'||!Number.isInteger(s.placesYear)||s.placesYear<2020||s.placesYear>2100)throw Error('INVALID_PROGRAM');
  for(const key of ['budgetPlaces','paidPlaces'])if(s[key]!==null&&s[key]!==undefined&&(!Number.isInteger(s[key])||s[key]<0||s[key]>100000))throw Error('INVALID_PLACES');
  for(const key of ['required','choice'])if(!Array.isArray(s[key])||s[key].some(x=>typeof x.name!=='string'||!Number.isInteger(x.min)||x.min<0||x.min>100))throw Error('INVALID_EXAMS');
  const exams=list=>list.map(x=>`${clean(x.name)} — минимум ${x.min}`).join('\n');
  a.year=String(s.placesYear);a.profile=clean(s.profile);a.duration=clean(s.duration).replace(/\s+(?=(?:Заочная|Очно-заочная) форма)/g,'\n');
  a.status=s.active?(s.confirmed?'Набор подтверждён':'Условия набора уточняются'):'Набор не ведётся';
  if(s.active){a.headers=['Места по всем формам обучения','Количество'];a.rows=[['Бюджетные (включая квоты)',s.budgetPlaces==null?'Уточняется':String(s.budgetPlaces)],['Платные',s.paidPlaces==null?'Уточняется':String(s.paidPlaces)]];}
  a.ege=[s.required.length?'Обязательные предметы (нужен каждый):\n'+exams(s.required):'',s.choice.length?'Один предмет на выбор:\n'+exams(s.choice):''].filter(Boolean).join('\n\n');
  a.notes=[clean(s.placesNote),clean(s.extra),a.ege?'Минимальные баллы ЕГЭ дают право участвовать в конкурсе и не являются проходными.':'', 'Сведения, которых нет в источнике, уточняйте на сайте приёмной комиссии.'].filter(Boolean).join('\n');
  const url=SOURCE+`/programs/${routes[level]}/`+encodeURIComponent(s.id);
  result[id]={admission:a,document:safeLink(s.url)||url,cost:url,admissionSource:{url,found:true,placesSources:(s.placesSources||[]).map(safeLink).filter(Boolean)}};
 }
 if(matched<Math.ceil(Object.keys(local).length*.9))throw Error('CATALOGUE_INCOMPLETE');
 return {programs:result,matched,missing:Object.keys(result).filter(id=>!result[id].admissionSource.found)};
}
export function admissionsService(db,{fetcher=fetch}={}){
 db.exec('CREATE TABLE IF NOT EXISTS admissions_source(id INTEGER PRIMARY KEY CHECK(id=1),json TEXT NOT NULL,synced_at INTEGER NOT NULL);');
 let running=null,timer=null,error='',attemptedAt=null,stopped=false;
 const cached=()=>db.prepare('SELECT * FROM admissions_source WHERE id=1').get();
 function status(){const row=cached();return {source:SOURCE+'/programs',syncedAt:row?.synced_at||null,attemptedAt,error,running:!!running,matched:row?JSON.parse(row.json).matched:0,missing:row?JSON.parse(row.json).missing:[]};}
 function overlay(content){const row=cached();if(!row)return content;const source=JSON.parse(row.json);const programs={...content.programs};for(const[id,patch]of Object.entries(source.programs))programs[id]={...defaults.programs[id],...programs[id],...patch};return {...content,programs};}
 async function fetchCatalogue(){
  const response=await fetcher(SOURCE+'/programs',{redirect:'error',signal:AbortSignal.timeout(25000),headers:{Accept:'text/html','User-Agent':'MGTU-Open-Day-Catalogue/1.0'}});
  if(!response.ok)throw Error('SOURCE_HTTP_'+response.status);
  let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=chunk.length;if(bytes>8*1024*1024)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}
  return mapCatalogue(parseCatalogue(Buffer.concat(chunks).toString('utf8')));
 }
 function sync(){
  if(running)return running;
  if(stopped)return Promise.resolve(status());
  attemptedAt=Date.now();
  running=(async()=>{try{
   const data=await fetchCatalogue();if(stopped)return;
   const json=JSON.stringify(data),old=cached();
   db.exec('BEGIN IMMEDIATE');try{
    db.prepare('INSERT INTO admissions_source(id,json,synced_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json,synced_at=excluded.synced_at').run(json,Date.now());
    if(old?.json!==json)db.prepare('UPDATE content SET revision=revision+1 WHERE id=1').run();
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   error='';
  }catch(e){error=String(e.cause?.code||e.message||'SYNC_ERROR').slice(0,100);}finally{running=null;}})();
  return running.then(status);
 }
 function assertUnlocked(changes){if(changes.some(c=>lockedProgramPath(c.path)))fail(403,'Условия приёма и ссылки направлений загружаются с abit.mkgtu.ru. Обновите страницу, чтобы получить актуальные сведения.');}
 return {overlay,status,sync,assertUnlocked,start(){if(timer)return;void sync();timer=setInterval(()=>void sync(),6*60*60*1000);timer.unref();},async stop(){stopped=true;clearInterval(timer);await running;}};
}
